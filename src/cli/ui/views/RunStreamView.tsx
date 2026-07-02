import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { colors, formatLabel } from '../theme';
import { Spinner } from '../components';
import { ReadlineInput } from '../components/ReadlineInput';
import { ResponsesClient } from '../../../sdk/responses/client';
import type { Item, Session, CreateResponseRequest, StreamingEvent } from '../../../sdk/responses/types';
import fs from 'fs';

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

interface RunStreamViewProps {
  client: ResponsesClient;
  initialItems: Item[];
  model: string;
  instructions?: string;
  maxTurns?: number;
  temperature?: number;
  maxTokens?: number;
  saveFile?: string;
  session?: Session;
}

export const RunStreamView: React.FC<RunStreamViewProps> = ({
  client,
  initialItems,
  model,
  instructions,
  maxTurns,
  temperature,
  maxTokens,
  saveFile,
  session: initialSession,
}) => {
  const { exit } = useApp();
  const [items, setItems] = useState<ItemWithStats[]>(initialItems);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [turn, setTurn] = useState(initialSession?.turn || 0);
  const [error, setError] = useState<string | null>(null);
  const [inputMode, setInputMode] = useState(initialItems.length === 0);
  const [showStats, setShowStats] = useState(false);
  
  // Stats tracking refs
  const streamStartTime = useRef<number>(0);
  const firstTokenTime = useRef<number>(0);

  // Start streaming if we have initial items
  useEffect(() => {
    if (initialItems.length > 0 && !isStreaming) {
      runStream(initialItems);
    }
  }, []);

  const runStream = useCallback(async (currentItems: ItemWithStats[]) => {
    setIsStreaming(true);
    setStreamingContent('');
    setError(null);
    
    // Reset stats
    streamStartTime.current = Date.now();
    firstTokenTime.current = 0;

    const request: CreateResponseRequest = {
      model,
      input: currentItems as Item[],
      instructions,
      max_turns: maxTurns,
      temperature,
      max_tokens: maxTokens,
      stream: true,
    };

    try {
      let fullContent = '';
      
      for await (const event of client.stream(request)) {
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
          
          if (saveFile) {
            const sessionData: Session = {
              id: event.response.id,
              model: event.response.model,
              items: newItems,
              turn: turn + 1,
              created: event.response.created,
              updated: event.response.created,
              status: 'active',
            };
            fs.writeFileSync(saveFile, JSON.stringify({ version: 1, session: sessionData }, null, 2));
          }
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsStreaming(false);
      setStreamingContent('');
      setInputMode(true);
    }
  }, [client, model, instructions, maxTurns, temperature, maxTokens, saveFile, turn]);

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
    setInputMode(false);
    runStream(newItems);
  }, [items, isStreaming, runStream]);

  useInput((inputChar, key) => {
    if (key.escape) {
      exit();
      return;
    }
    if (key.ctrl && inputChar === 'c') {
      exit();
      return;
    }
    
    // Toggle stats with Cmd+S (Mac) or Ctrl+S (others)
    const modPressed = isMac ? key.meta : key.ctrl;
    if (modPressed && inputChar === 's') {
      setShowStats(s => !s);
    }
  });

  const maxTurnsDisplay = maxTurns ? String(maxTurns) : '∞';

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text color={colors.text} bold>{formatLabel('RUN')}</Text>
        <Text color={colors.textMuted}> | </Text>
        <Text color={colors.primary}>{model}</Text>
        <Text color={colors.textMuted}> | </Text>
        <Text color={colors.textDim}>Turn: {turn}/{maxTurnsDisplay}</Text>
        {showStats && (
          <>
            <Text color={colors.textMuted}> | </Text>
            <Text color={colors.success}>stats: on</Text>
          </>
        )}
      </Box>

      {/* Messages */}
      <Box flexDirection="column" marginBottom={1}>
        {items.map((item, i) => (
          <ItemDisplay key={i} item={item} showStats={showStats} />
        ))}
        
        {/* Streaming content */}
        {isStreaming && streamingContent && (
          <Box marginTop={1} flexDirection="column">
            <Box>
              <Text color={colors.textMuted}>Assistant: </Text>
              <Text color={colors.text}>{streamingContent}</Text>
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
        
        {/* Loading indicator */}
        {isStreaming && !streamingContent && (
          <Box marginTop={1}>
            <Spinner label="Thinking..." type="grid" />
          </Box>
        )}
      </Box>

      {/* Error */}
      {error && (
        <Box marginBottom={1}>
          <Text color={colors.error}>Error: {error}</Text>
        </Box>
      )}

      {/* Input */}
      {inputMode && !isStreaming && (
        <Box>
          <Text color={colors.accent}>&gt; </Text>
          <ReadlineInput
            value={input}
            onChange={setInput}
            onSubmit={handleSubmit}
            placeholder="Type your message..."
          />
        </Box>
      )}

      {/* Help */}
      <Box marginTop={1}>
        <Text color={colors.textDim}>
          [Esc] quit [{modKey}+S] stats [Ctrl+A/E] nav [Ctrl+W] del word [Alt+B/F] word nav
        </Text>
      </Box>
    </Box>
  );
};

interface ItemDisplayProps {
  item: ItemWithStats;
  showStats: boolean;
}

const ItemDisplay: React.FC<ItemDisplayProps> = ({ item, showStats }) => {
  if (item.type === 'message') {
    const roleColor = item.role === 'user' ? colors.primary : 
                      item.role === 'assistant' ? colors.text : colors.textMuted;
    const roleLabel = item.role === 'user' ? 'You' : 
                      item.role === 'assistant' ? 'Assistant' : 'System';
    
    return (
      <Box marginTop={1} flexDirection="column">
        <Box>
          <Text color={roleColor} bold>{roleLabel}: </Text>
          <Text color={colors.text}>{item.content}</Text>
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
      <Box marginTop={1} flexDirection="column">
        <Text color={colors.warning} bold>Tool: {item.name}</Text>
        <Text color={colors.textDim}>{item.arguments}</Text>
      </Box>
    );
  }
  
  if (item.type === 'tool_result') {
    return (
      <Box marginTop={1} flexDirection="column">
        <Text color={colors.success} bold>Result:</Text>
        <Text color={colors.text}>{item.content}</Text>
      </Box>
    );
  }
  
  return null;
};
