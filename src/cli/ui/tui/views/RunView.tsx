import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import { colors } from '../../theme';
import { Spinner, ReadlineInput } from '../../components';
import { useContentFocused } from '../FocusContext';
import { ResponsesClient } from '../../../../sdk/responses/client';
import type { Item, Model, StreamingEvent } from '../../../../sdk/responses/types';
import { getConsumptionConfig } from '../../../../core/config/profiles';

// Detect platform for keyboard shortcuts
const isMac = process.platform === 'darwin';
const modKey = isMac ? '⌘' : 'Ctrl';

// Stats for a message
interface MessageStats {
  ttft?: number;            // Time to first token (ms)
  totalTime?: number;       // Total generation time (ms)
  promptTokens?: number;    // Input tokens (from API)
  completionTokens?: number; // Output tokens (from API)
  totalTokens?: number;     // Total tokens (from API)
  tps?: number;             // Tokens per second
}

// Extended item with stats
type ItemWithStats = Item & { stats?: MessageStats };

export function RunView(): React.ReactElement {
  const isContentFocused = useContentFocused();
  
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [items, setItems] = useState<ItemWithStats[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [turn, setTurn] = useState(0);
  const [showModelSelect, setShowModelSelect] = useState(false);
  const [modelIndex, setModelIndex] = useState(0);
  const [showStats, setShowStats] = useState(false);
  const [scrollOffset, setScrollOffset] = useState(0);
  
  // Stats tracking refs
  const streamStartTime = useRef<number>(0);
  const firstTokenTime = useRef<number>(0);

  const client = ResponsesClient.getInstance();

  // Load models on mount and set default from profile
  useEffect(() => {
    const loadModels = async () => {
      try {
        const modelList = await client.listModels();
        setModels(modelList);
        
        // Check profile for default spec first
        const consumptionConfig = getConsumptionConfig();
        const defaultSpec = consumptionConfig.default_spec;
        
        if (defaultSpec && modelList.some(m => m.id === defaultSpec)) {
          setSelectedModel(defaultSpec);
        } else if (modelList.length > 0) {
          setSelectedModel(modelList[0].id);
        }
      } catch (err: any) {
        setError('Failed to load specs: ' + err.message);
      } finally {
        setLoading(false);
      }
    };
    loadModels();
  }, []);

  // Auto-scroll to bottom when new items added
  useEffect(() => {
    if (items.length > 0) {
      setScrollOffset(Math.max(0, items.length - 5));
    }
  }, [items.length]);

  const runStream = useCallback(async (currentItems: ItemWithStats[]) => {
    if (!selectedModel) {
      setError('No spec selected');
      return;
    }

    setIsStreaming(true);
    setStreamingContent('');
    setError(null);
    
    // Reset stats
    streamStartTime.current = Date.now();
    firstTokenTime.current = 0;

    try {
      let fullContent = '';
      
      for await (const event of client.stream({
        model: selectedModel,
        input: currentItems as Item[],
        stream: true,
      })) {
        if (event.type === 'response.item.delta' && event.delta.content) {
          // Track first token time
          if (firstTokenTime.current === 0) {
            firstTokenTime.current = Date.now();
          }
          
          fullContent += event.delta.content;
          setStreamingContent(fullContent);
        } else if (event.type === 'error') {
          setError(event.error.message);
          break;
        } else if (event.type === 'response.done') {
          const endTime = Date.now();
          const totalTime = endTime - streamStartTime.current;
          const ttft = firstTokenTime.current ? firstTokenTime.current - streamStartTime.current : undefined;
          
          // Get actual token counts from API response
          const usage = event.response.usage;
          const completionTokens = usage?.completion_tokens;
          const tps = (completionTokens && totalTime > 0) 
            ? (completionTokens / (totalTime / 1000)) 
            : undefined;
          
          // Add stats to the assistant message
          const responseItems = event.response.items.map((item: Item) => ({
            ...item,
            stats: (item.type === 'message' && item.role === 'assistant') ? {
              ttft,
              totalTime,
              promptTokens: usage?.prompt_tokens,
              completionTokens: usage?.completion_tokens,
              totalTokens: usage?.total_tokens,
              tps: tps ? Math.round(tps * 10) / 10 : undefined,
            } : undefined,
          }));
          
          const newItems = [...currentItems, ...responseItems];
          setItems(newItems);
          setTurn(t => t + 1);
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsStreaming(false);
      setStreamingContent('');
    }
  }, [client, selectedModel]);

  const handleSubmit = useCallback((value: string) => {
    if (!value.trim() || isStreaming) return;
    
    const userItem: ItemWithStats = {
      type: 'message',
      role: 'user',
      content: value.trim(),
    };
    
    const newItems = [...items, userItem];
    setItems(newItems);
    setInput('');
    runStream(newItems);
  }, [items, isStreaming, runStream]);

  useInput((inputChar, key) => {
    if (!isContentFocused) return;

    // Model selection mode
    if (showModelSelect) {
      if (key.upArrow && modelIndex > 0) {
        setModelIndex(modelIndex - 1);
      }
      if (key.downArrow && modelIndex < models.length - 1) {
        setModelIndex(modelIndex + 1);
      }
      if (key.return) {
        setSelectedModel(models[modelIndex].id);
        setShowModelSelect(false);
      }
      if (key.escape) {
        setShowModelSelect(false);
      }
      return;
    }

    // Use meta (Cmd) on Mac, ctrl elsewhere
    const modPressed = isMac ? key.meta : key.ctrl;

    // Shortcuts with modifier key
    if (modPressed && inputChar === 'm' && !isStreaming) {
      setShowModelSelect(true);
      setModelIndex(models.findIndex(m => m.id === selectedModel) || 0);
    }
    if (modPressed && inputChar === 'n' && !isStreaming) {
      setItems([]);
      setTurn(0);
      setError(null);
      setInput('');
      setScrollOffset(0);
    }
    if (modPressed && inputChar === 's') {
      setShowStats(s => !s);
    }
    
    // Scroll with Page Up/Down or Ctrl/Cmd + Up/Down
    if (modPressed && key.upArrow) {
      setScrollOffset(o => Math.max(0, o - 1));
    }
    if (modPressed && key.downArrow) {
      setScrollOffset(o => Math.min(Math.max(0, items.length - 5), o + 1));
    }
  });

  if (loading) {
    return (
      <Box flexDirection="column">
        <Text color={colors.text} bold>RUN_</Text>
        <Box marginTop={1}>
          <Spinner label="Loading models..." type="grid" />
        </Box>
      </Box>
    );
  }

  // Model selection overlay
  if (showModelSelect) {
    return (
      <Box flexDirection="column">
        <Text color={colors.text} bold>SELECT MODEL_</Text>
        <Box marginTop={1} flexDirection="column">
          {models.map((model, i) => (
            <Box key={model.id}>
              <Text color={i === modelIndex ? colors.primary : colors.textMuted}>
                {i === modelIndex ? '> ' : '  '}{model.id}
              </Text>
              {model.display_name && (
                <Text color={colors.textDim}> - {model.display_name}</Text>
              )}
            </Box>
          ))}
        </Box>
        <Box marginTop={1}>
          <Text color={colors.textDim}>[Enter] select [Esc] cancel</Text>
        </Box>
      </Box>
    );
  }

  // Calculate visible items (manual scrolling since Ink doesn't support native scroll)
  const maxVisibleItems = 6;
  const visibleItems = items.slice(scrollOffset, scrollOffset + maxVisibleItems);
  const hasMoreAbove = scrollOffset > 0;
  const hasMoreBelow = scrollOffset + maxVisibleItems < items.length;

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box marginBottom={1}>
        <Text color={colors.text} bold>
          {isContentFocused && <Text color={colors.primary}>◆ </Text>}
          RUN_
        </Text>
        <Text color={colors.textMuted}> | </Text>
        <Text color={colors.primary}>{selectedModel || 'No spec'}</Text>
        <Text color={colors.textMuted}> | </Text>
        <Text color={colors.textDim}>Turn: {turn}</Text>
        {showStats && (
          <>
            <Text color={colors.textMuted}> | </Text>
            <Text color={colors.success}>stats: on</Text>
          </>
        )}
      </Box>

      {/* Scroll indicator - above */}
      {hasMoreAbove && (
        <Box>
          <Text color={colors.textDim}>  ↑ {scrollOffset} more above</Text>
        </Box>
      )}

      {/* Messages - fixed height container */}
      <Box flexDirection="column" marginBottom={1}>
        {visibleItems.map((item, i) => (
          <ItemDisplay key={scrollOffset + i} item={item} showStats={showStats} />
        ))}
        
        {/* Streaming content */}
        {isStreaming && streamingContent && (
          <Box marginTop={1} flexDirection="column">
            <Box>
              <Text color={colors.textMuted}>AI: </Text>
              <Text color={colors.text}>{streamingContent.slice(-300)}</Text>
              <Text color={colors.accent}>▌</Text>
            </Box>
            {showStats && (
              <Box marginLeft={4}>
                <Text color={colors.textDim} dimColor>
                  ⏱ {((Date.now() - streamStartTime.current) / 1000).toFixed(1)}s
                  {firstTokenTime.current > 0 && ` | TTFT: ${firstTokenTime.current - streamStartTime.current}ms`}
                </Text>
              </Box>
            )}
          </Box>
        )}
        
        {isStreaming && !streamingContent && (
          <Box marginTop={1}>
            <Spinner label="Thinking..." type="grid" />
          </Box>
        )}
      </Box>

      {/* Scroll indicator - below */}
      {hasMoreBelow && (
        <Box>
          <Text color={colors.textDim}>  ↓ {items.length - scrollOffset - maxVisibleItems} more below</Text>
        </Box>
      )}

      {/* Error */}
      {error && (
        <Box marginBottom={1}>
          <Text color={colors.error}>Error: {error}</Text>
        </Box>
      )}

      {/* Input */}
      {!isStreaming && isContentFocused && (
        <Box borderStyle="single" borderColor={colors.surface} paddingX={1}>
          <Text color={colors.accent}>&gt; </Text>
          <ReadlineInput
            value={input}
            onChange={setInput}
            onSubmit={handleSubmit}
            placeholder="Type your message..."
            focus={isContentFocused && !showModelSelect}
          />
        </Box>
      )}

      {/* Help */}
      <Box marginTop={1}>
        <Text color={colors.textDim}>
          [{modKey}+M] models [{modKey}+N] new [{modKey}+S] stats [{modKey}+↑↓] scroll
        </Text>
      </Box>
    </Box>
  );
}

interface ItemDisplayProps {
  item: ItemWithStats;
  showStats: boolean;
}

const ItemDisplay: React.FC<ItemDisplayProps> = ({ item, showStats }) => {
  if (item.type === 'message') {
    const roleColor = item.role === 'user' ? colors.primary : colors.text;
    const label = item.role === 'user' ? 'You' : 'AI';
    
    return (
      <Box marginTop={1} flexDirection="column">
        <Box>
          <Text color={roleColor} bold>{label}: </Text>
          <Text color={colors.text} wrap="wrap">{item.content}</Text>
        </Box>
        {showStats && item.stats && (
          <Box marginLeft={4}>
            <Text color={colors.textDim} dimColor>
              {item.stats.ttft !== undefined && `TTFT: ${item.stats.ttft}ms`}
              {item.stats.completionTokens !== undefined && ` | ${item.stats.completionTokens} tokens`}
              {item.stats.tps !== undefined && ` | ${item.stats.tps} tok/s`}
              {item.stats.totalTime !== undefined && ` | ${(item.stats.totalTime / 1000).toFixed(1)}s`}
              {item.stats.promptTokens !== undefined && ` | in: ${item.stats.promptTokens}`}
            </Text>
          </Box>
        )}
      </Box>
    );
  }
  
  if (item.type === 'tool_call') {
    return (
      <Box marginTop={1}>
        <Text color={colors.warning}>Tool: {item.name}</Text>
      </Box>
    );
  }
  
  return null;
};
