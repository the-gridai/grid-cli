/**
 * HOTWIRE View - Grid Neural AI Chat Interface
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import { ReadlineInput } from '../../components';
import { useContentFocused } from '../FocusContext';
import { useConnection } from '../App';
import { ResponsesClient } from '../../../../sdk/responses/client';
import type { Item, Model } from '../../../../sdk/responses/types';
import { colors } from '../../theme';
import { isMacKeyboard } from '../../keyboard';
import { getConsumptionConfig } from '../../../../core/config/profiles';
import {
  statusIcons,
  getRandomTagline,
} from '../../hotwire/theme';
import {
  HotwireHeader,
  HotwireText,
  ThinkingAnimation,
  MessageBubble,
  StreamingContent,
  HotwireFooter,
  ModelSelector,
} from '../../hotwire/components';

// Keyboard detection (respects GRID_KEYBOARD env var for dev containers)
const isMac = isMacKeyboard();

// Stats for a message
interface MessageStats {
  ttft?: number;
  totalTime?: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  tps?: number;
}

type ItemWithStats = Item & { stats?: MessageStats };

export function HotwireView(): React.ReactElement {
  const isContentFocused = useContentFocused();
  const { status: connectionStatus } = useConnection();
  
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [items, setItems] = useState<ItemWithStats[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [turn, setTurn] = useState(0);
  const [showModelSelect, setShowModelSelect] = useState(false);
  const [modelIndex, setModelIndex] = useState(0);
  const [showStats, setShowStats] = useState(false);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [tagline] = useState(getRandomTagline);
  
  // Stats tracking refs
  const streamStartTime = useRef<number>(0);
  const firstTokenTime = useRef<number>(0);
  const [elapsedTime, setElapsedTime] = useState(0);

  const client = ResponsesClient.getInstance();

  // Load models on mount and set default from profile
  useEffect(() => {
    const loadModels = async () => {
      // Check profile for default spec first (set it before API call)
      const consumptionConfig = getConsumptionConfig();
      const defaultSpec = consumptionConfig.default_spec;
      
      // Set default spec from config immediately (don't wait for validation)
      if (defaultSpec) {
        setSelectedModel(defaultSpec);
      }
      
      try {
        const modelList = await client.listModels();
        setModels(modelList);
        
        // Validate default spec against available models
        if (defaultSpec && modelList.some(m => m.id === defaultSpec)) {
          // Already set, confirmed valid
        } else if (!defaultSpec && modelList.length > 0) {
          // No default spec configured, use first available
          setSelectedModel(modelList[0].id);
        }
      } catch (err: any) {
        // Models list failed, but we can still use the default spec from config
        // The actual API call will validate if the spec is valid
        if (!defaultSpec) {
          setError('Failed to load specs: ' + err.message);
        }
        // Otherwise silently continue with the configured default spec
      } finally {
        setLoading(false);
      }
    };
    loadModels();
  }, []);

  // Update elapsed time during streaming - throttled to reduce re-renders
  useEffect(() => {
    if (!isStreaming) return;
    const interval = setInterval(() => {
      setElapsedTime((Date.now() - streamStartTime.current) / 1000);
    }, 500); // Update every 500ms instead of 100ms
    return () => clearInterval(interval);
  }, [isStreaming]);

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
    setElapsedTime(0);
    
    streamStartTime.current = Date.now();
    firstTokenTime.current = 0;

    try {
      let fullContent = '';
      let lastUpdateTime = 0;
      const UPDATE_THROTTLE = 50; // Minimum ms between state updates
      
      for await (const event of client.stream({
        model: selectedModel,
        input: currentItems as Item[],
        stream: true,
      })) {
        if (event.type === 'response.item.delta' && event.delta.content) {
          if (firstTokenTime.current === 0) {
            firstTokenTime.current = Date.now();
          }
          
          fullContent += event.delta.content;
          
          // Throttle state updates to prevent excessive re-renders
          const now = Date.now();
          if (now - lastUpdateTime >= UPDATE_THROTTLE) {
            setStreamingContent(fullContent);
            lastUpdateTime = now;
          }
        } else if (event.type === 'error') {
          setError(event.error.message);
          break;
        } else if (event.type === 'response.done') {
          const endTime = Date.now();
          const totalTime = endTime - streamStartTime.current;
          const ttft = firstTokenTime.current ? firstTokenTime.current - streamStartTime.current : undefined;
          
          const usage = event.response.usage;
          const completionTokens = usage?.completion_tokens;
          const tps = (completionTokens && totalTime > 0) 
            ? (completionTokens / (totalTime / 1000)) 
            : undefined;
          
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
      // Provide helpful error messages
      const errorMsg = err.message || 'Unknown error';
      if (errorMsg.includes('ECONNREFUSED') || errorMsg.includes('ENOTFOUND')) {
        setError('Server unavailable - check if the API server is running');
      } else if (errorMsg.includes('401') || errorMsg.includes('Unauthorized')) {
        setError('Authentication failed - check your API key');
      } else if (errorMsg.includes('402') || errorMsg.includes('insufficient')) {
        setError('Insufficient balance - run: grid consumption transfer --to-consumption');
      } else if (errorMsg.includes('timeout') || errorMsg.includes('ETIMEDOUT')) {
        setError('Request timed out - server may be overloaded');
      } else if (errorMsg === 'Error' || !errorMsg) {
        setError('Connection failed - is the server running?');
      } else {
        setError(errorMsg);
      }
    } finally {
      setIsStreaming(false);
      setStreamingContent('');
    }
  }, [client, selectedModel]);

  // Use ref to avoid recreating handleSubmit on items change
  const itemsRef = useRef(items);
  itemsRef.current = items;
  
  const handleSubmit = useCallback((value: string) => {
    if (isStreaming) return;
    
    const userItem: ItemWithStats = {
      type: 'message',
      role: 'user',
      content: value,
    };
    
    const newItems = [...itemsRef.current, userItem];
    setItems(newItems);
    runStream(newItems);
  }, [isStreaming, runStream]);

  useInput((inputChar, key) => {
    if (!isContentFocused) return;

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

    // Accept both Ctrl and Cmd for devcontainer compatibility
    // In devcontainers, Mac keyboards may send either key depending on settings
    const modPressed = key.meta || key.ctrl;

    if (modPressed && inputChar === 'm' && !isStreaming) {
      setShowModelSelect(true);
      setModelIndex(models.findIndex(m => m.id === selectedModel) || 0);
    }
    if (modPressed && inputChar === 'n' && !isStreaming) {
      setItems([]);
      setTurn(0);
      setError(null);
      setScrollOffset(0);
      // Input is managed by IsolatedInput, no need to clear here
    }
    if (modPressed && inputChar === 's') {
      setShowStats(s => !s);
    }
    if (modPressed && key.upArrow) {
      setScrollOffset(o => Math.max(0, o - 1));
    }
    if (modPressed && key.downArrow) {
      setScrollOffset(o => Math.min(Math.max(0, items.length - 5), o + 1));
    }
  });

  // Loading state
  if (loading) {
    return (
      <Box flexDirection="column">
        <HotwireText />
        <Box marginTop={1}>
          <ThinkingAnimation />
        </Box>
      </Box>
    );
  }

  // Model selection overlay
  if (showModelSelect) {
    return <ModelSelector models={models} selectedIndex={modelIndex} />;
  }

  // Calculate visible items
  const maxVisibleItems = 5;
  const visibleItems = items.slice(scrollOffset, scrollOffset + maxVisibleItems);
  const hasMoreAbove = scrollOffset > 0;
  const hasMoreBelow = scrollOffset + maxVisibleItems < items.length;

  return (
    <Box flexDirection="column">
      {/* Header */}
      <HotwireHeader 
        model={selectedModel || 'No spec'} 
        turn={turn}
        connected={connectionStatus === 'connected'}
        showStats={showStats}
        inputActive={!isStreaming && (isContentFocused || items.length > 0)}
      />
      
      {/* Welcome message if no items */}
      {items.length === 0 && !isStreaming && (
        <Box flexDirection="column" marginY={1}>
          <Text color={colors.textMuted} italic>
            {tagline}
          </Text>
          <Box marginTop={1}>
            <Text color={colors.textDim}>
              What would you like to explore?
            </Text>
          </Box>
        </Box>
      )}

      {/* Scroll indicator - above */}
      {hasMoreAbove && (
        <Text color={colors.textDim}>  ▲ {scrollOffset} more above</Text>
      )}

      {/* Messages */}
      <Box flexDirection="column">
        {visibleItems.map((item, i) => (
          item.type === 'message' && (
            <MessageBubble 
              key={scrollOffset + i} 
              role={item.role} 
              content={item.content}
              stats={item.stats}
              showStats={showStats}
            />
          )
        ))}
        
        {/* Streaming content */}
        {isStreaming && streamingContent && (
          <StreamingContent 
            content={streamingContent}
            showStats={showStats}
            stats={{
              elapsed: elapsedTime,
              ttft: firstTokenTime.current ? firstTokenTime.current - streamStartTime.current : undefined,
            }}
          />
        )}
        
        {/* Loading animation */}
        {isStreaming && !streamingContent && (
          <Box marginTop={1}>
            <ThinkingAnimation />
          </Box>
        )}
      </Box>

      {/* Scroll indicator - below */}
      {hasMoreBelow && (
        <Text color={colors.textDim}>  ▼ {items.length - scrollOffset - maxVisibleItems} more below</Text>
      )}

      {/* Error */}
      {error && (
        <Box marginY={1}>
          <Text color={colors.error}>{statusIcons.error} Error: {error}</Text>
        </Box>
      )}

      {/* Input - isolated to prevent re-renders */}
      <IsolatedInput 
        onSubmit={handleSubmit}
        disabled={isStreaming || !isContentFocused || showModelSelect}
        focus={isContentFocused && !showModelSelect}
      />

      {/* Footer */}
      <HotwireFooter 
        hasMoreAbove={hasMoreAbove}
        hasMoreBelow={hasMoreBelow}
        aboveCount={scrollOffset}
        belowCount={items.length - scrollOffset - maxVisibleItems}
      />
    </Box>
  );
}

// Isolated input component - manages its own state to prevent parent re-renders
interface IsolatedInputProps {
  onSubmit: (value: string) => void;
  disabled: boolean;
  focus: boolean;
}

const IsolatedInput: React.FC<IsolatedInputProps> = React.memo(({ onSubmit, disabled, focus }) => {
  const [localInput, setLocalInput] = useState('');
  
  const handleSubmit = useCallback((value: string) => {
    if (!value.trim() || disabled) return;
    onSubmit(value.trim());
    setLocalInput('');
  }, [onSubmit, disabled]);
  
  if (disabled) return null;
  
  return (
    <Box 
      borderStyle="single" 
      borderColor={colors.primary}
      paddingX={1}
      marginTop={1}
    >
      <Text color={colors.accent}>▶ </Text>
      <ReadlineInput
        value={localInput}
        onChange={setLocalInput}
        onSubmit={handleSubmit}
        placeholder="Ask anything..."
        focus={focus}
      />
    </Box>
  );
});

export default HotwireView;
