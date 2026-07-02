/**
 * HOTWIRE Stream View - Standalone Grid AI Chat Interface
 * 
 * Full-screen interactive mode for `grid hotwire`
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { ReadlineInput } from '../components';
import { ResponsesClient } from '../../../sdk/responses/client';
import { ApiClient } from '../../../sdk/http/client';
import type { Item, Session, CreateResponseRequest } from '../../../sdk/responses/types';
import fs from 'fs';
import { colors } from '../theme';
import { isMacKeyboard, getModifierKey } from '../keyboard';
import {
  statusIcons,
  getRandomTagline,
} from '../hotwire/theme';
import { HotwireText } from '../hotwire/components';

// Keyboard detection (respects GRID_KEYBOARD env var for dev containers)
const isMac = isMacKeyboard();
const modKey = getModifierKey();

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

interface HotwireStreamViewProps {
  client: ResponsesClient;
  initialItems: Item[];
  model: string;
  instructions?: string;
  maxTurns?: number;
  temperature?: number;
  maxTokens?: number;
  saveFile?: string;
  session?: Session;
  autoFund?: boolean;
  autoFundAmount?: number;
}

export const HotwireStreamView: React.FC<HotwireStreamViewProps> = ({
  client,
  initialItems,
  model,
  instructions,
  maxTurns,
  temperature,
  maxTokens,
  saveFile,
  session: initialSession,
  autoFund,
  autoFundAmount = 1000,
}) => {
  const { exit } = useApp();
  const [items, setItems] = useState<ItemWithStats[]>(initialItems);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [turn, setTurn] = useState(initialSession?.turn || 0);
  const [error, setError] = useState<string | null>(null);
  const [inputMode, setInputMode] = useState(initialItems.length === 0);
  const [showStats, setShowStats] = useState(false);
  const [tagline] = useState(getRandomTagline);
  
  // Stats tracking refs
  const streamStartTime = useRef<number>(0);
  const firstTokenTime = useRef<number>(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const autoFundRetried = useRef(false);

  // Update elapsed time during streaming
  // Throttled elapsed time updates to reduce re-renders
  useEffect(() => {
    if (!isStreaming) return;
    const interval = setInterval(() => {
      setElapsedTime((Date.now() - streamStartTime.current) / 1000);
    }, 500); // Update every 500ms instead of 100ms
    return () => clearInterval(interval);
  }, [isStreaming]);

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
    setElapsedTime(0);
    
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
      let lastUpdateTime = 0;
      const UPDATE_THROTTLE = 50; // Minimum ms between state updates
      
      for await (const event of client.stream(request)) {
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
          // Check for 402 (insufficient balance) and try auto-fund
          const is402 = event.error.message?.includes('402');
          if (is402 && autoFund && !autoFundRetried.current) {
            autoFundRetried.current = true;
            setError('Insufficient balance. Auto-funding...');
            try {
              const instrument = model.toUpperCase();
              const apiClient = ApiClient.getInstance();
              await apiClient.transferToConsumption(instrument, autoFundAmount);
              setError(null);
              // Retry the stream after a short delay
              setTimeout(() => {
                setIsStreaming(false);
                setStreamingContent('');
                runStream(currentItems);
              }, 500);
              return;
            } catch (fundErr: any) {
              setError(`Auto-fund failed: ${fundErr.message}. Try: grid consumption transfer --to-consumption`);
            }
          } else {
            setError(event.error.message);
          }
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
          
          if (saveFile) {
            const sessionData: Session = {
              id: event.response.id,
              model: event.response.model,
              items: newItems as Item[],
              turn: turn + 1,
              created: event.response.created,
              updated: event.response.created,
              status: 'active',
            };
            fs.writeFileSync(saveFile, JSON.stringify({ version: 1, session: sessionData }, null, 2));
          }
        }
      }
      // Success - cleanup
      setIsStreaming(false);
      setStreamingContent('');
      setInputMode(true);
      autoFundRetried.current = false; // Reset for next request
    } catch (err: any) {
      // Check for 402 (Payment Required / Insufficient Balance)
      const is402 = err.message?.includes('402') || 
                    err.response?.status === 402 || 
                    err.statusCode === 402;
      
      if (is402 && autoFund && !autoFundRetried.current) {
        autoFundRetried.current = true;
        setError('Insufficient balance. Auto-funding...');
        try {
          const instrument = model.toUpperCase();
          const apiClient = ApiClient.getInstance();
          await apiClient.transferToConsumption(instrument, autoFundAmount);
          setError(null);
          // Retry the stream after a short delay
          setTimeout(() => {
            setIsStreaming(false);
            setStreamingContent('');
            runStream(currentItems);
          }, 500);
          return;
        } catch (fundErr: any) {
          setError(`Auto-fund failed: ${fundErr.message}. Try: grid consumption transfer --to-consumption`);
        }
      } else {
        // Provide helpful error messages
        const errorMsg = err.message || 'Unknown error';
        if (errorMsg.includes('ECONNREFUSED') || errorMsg.includes('ENOTFOUND')) {
          setError('Server unavailable - check if the API server is running');
        } else if (errorMsg.includes('401') || errorMsg.includes('Unauthorized')) {
          setError('Authentication failed - check your API key');
        } else if (errorMsg.includes('timeout') || errorMsg.includes('ETIMEDOUT')) {
          setError('Request timed out - server may be overloaded');
        } else if (errorMsg === 'Error' || !errorMsg) {
          setError('Connection failed - is the server running?');
        } else {
          setError(errorMsg);
        }
      }
      setIsStreaming(false);
      setStreamingContent('');
      setInputMode(true);
    }
  }, [client, model, instructions, maxTurns, temperature, maxTokens, saveFile, turn, autoFund, autoFundAmount]);

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
    setInputMode(false);
    runStream(newItems);
  }, [isStreaming, runStream]);

  useInput((inputChar, key) => {
    if (key.escape) {
      exit();
      return;
    }
    if (key.ctrl && inputChar === 'c') {
      exit();
      return;
    }
    
    // Accept both Ctrl and Cmd for devcontainer compatibility
    const modPressed = key.meta || key.ctrl;
    if (modPressed && inputChar === 's') {
      setShowStats(s => !s);
    }
  });

  const maxTurnsDisplay = maxTurns ? String(maxTurns) : '∞';

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header - animation paused when reading content or typing */}
      <Box flexDirection="column" marginBottom={1}>
        <Box>
          <HotwireText paused={items.length > 0 || (inputMode && !isStreaming)} />
          <Text color={colors.textDim}> │ </Text>
          <Text color={colors.primary}>{model}</Text>
          <Text color={colors.textDim}> │ </Text>
          <Text color={colors.success}>Turn {turn}/{maxTurnsDisplay}</Text>
          {showStats && (
            <>
              <Text color={colors.textDim}> │ </Text>
              <Text color={colors.accent}>STATS</Text>
            </>
          )}
        </Box>
        <Text color={colors.textDim}>{'━'.repeat(60)}</Text>
      </Box>

      {/* Welcome message */}
      {items.length === 0 && !isStreaming && (
        <Box marginBottom={1}>
          <Text color={colors.textMuted} italic>{tagline}</Text>
        </Box>
      )}

      {/* Messages - memoized to prevent re-renders during input */}
      <MemoizedMessageList items={items} showStats={showStats} />
        
      {/* Streaming content with spark effect */}
      {isStreaming && streamingContent && (
        <StreamingText 
          content={streamingContent}
          showStats={showStats}
          elapsed={elapsedTime}
          ttft={firstTokenTime.current > 0 ? firstTokenTime.current - streamStartTime.current : undefined}
        />
      )}
      
      {/* Loading animation */}
      {isStreaming && !streamingContent && (
        <Box marginTop={1}>
          <ThinkingDots />
        </Box>
      )}

      {/* Error */}
      {error && (
        <Box marginBottom={1}>
          <Text color={colors.error}>{statusIcons.error} Error: {error}</Text>
        </Box>
      )}

      {/* Input - isolated to prevent re-renders */}
      <IsolatedInput 
        onSubmit={handleSubmit} 
        disabled={!inputMode || isStreaming} 
      />

      {/* Footer */}
      <Box marginTop={1}>
        <Text color={colors.textDim}>{'━'.repeat(60)}</Text>
      </Box>
      <Box>
        <Text color={colors.textDim}>
          [Esc] <Text color={colors.error}>exit</Text>
          {' '}[{modKey}+S] <Text color={colors.success}>stats</Text>
          {' '}[Ctrl+A/E] <Text color={colors.primary}>nav</Text>
          {' '}[Ctrl+W] <Text color={colors.accent}>del</Text>
        </Text>
      </Box>
    </Box>
  );
};

// Isolated input component - manages its own state to prevent parent re-renders
interface IsolatedInputProps {
  onSubmit: (value: string) => void;
  disabled: boolean;
}

const IsolatedInput: React.FC<IsolatedInputProps> = React.memo(({ onSubmit, disabled }) => {
  const [localInput, setLocalInput] = useState('');
  
  const handleSubmit = useCallback((value: string) => {
    if (!value.trim() || disabled) return;
    onSubmit(value.trim());
    setLocalInput('');
  }, [onSubmit, disabled]);
  
  if (disabled) return null;
  
  return (
    <Box borderStyle="single" borderColor={colors.primary} paddingX={1}>
      <Text color={colors.accent}>▶ </Text>
      <ReadlineInput
        value={localInput}
        onChange={setLocalInput}
        onSubmit={handleSubmit}
        placeholder="Ask anything..."
      />
    </Box>
  );
});

// Animated loading indicator - visual only, no text
const ThinkingDots: React.FC = () => {
  const [frame, setFrame] = useState(0);
  const frames = ['⣿⣶⣦⣤⣀', '⣶⣦⣤⣀⣀', '⣦⣤⣀⣀⣤', '⣤⣀⣀⣤⣦', '⣀⣀⣤⣦⣶', '⣀⣤⣦⣶⣿', '⣤⣦⣶⣿⣶', '⣦⣶⣿⣶⣦'];
  
  useEffect(() => {
    const interval = setInterval(() => {
      setFrame(f => (f + 1) % frames.length);
    }, 120);
    return () => clearInterval(interval);
  }, []);
  
  return (
    <Box>
      <Text color={colors.accent}>{frames[frame]}</Text>
    </Box>
  );
};

// Memoized message list to prevent re-renders during input
interface MessageListProps {
  items: ItemWithStats[];
  showStats: boolean;
}

const MessageList: React.FC<MessageListProps> = ({ items, showStats }) => (
  <Box flexDirection="column" marginBottom={1}>
    {items.map((item, i) => (
      item.type === 'message' && (
        <Box key={i} marginTop={1} flexDirection="column">
          <Box>
            <Text color={item.role === 'user' ? colors.primary : colors.accent}>
              {item.role === 'user' ? statusIcons.user : statusIcons.ai}{' '}
            </Text>
            <Text color={item.role === 'user' ? colors.primary : colors.accent} bold>
              {item.role === 'user' ? 'YOU' : 'HOTWIRE'}
            </Text>
            {item.role === 'assistant' && <Text color={colors.accent}>_</Text>}
          </Box>
          <Box marginLeft={2}>
            <Text color={colors.text}>{item.content}</Text>
          </Box>
          {showStats && item.stats && (
            <Box marginLeft={2}>
              <Text color={colors.textDim}>└─ </Text>
              <Text color={colors.success} dimColor>
                {item.stats.ttft !== undefined && `⚡${item.stats.ttft}ms`}
                {item.stats.completionTokens !== undefined && ` │ ${item.stats.completionTokens}tok`}
                {item.stats.tps !== undefined && ` │ ${item.stats.tps}t/s`}
                {item.stats.totalTime !== undefined && ` │ ${(item.stats.totalTime / 1000).toFixed(1)}s`}
              </Text>
            </Box>
          )}
        </Box>
      )
    ))}
  </Box>
);

// Memoize the message list - only re-render when items or showStats change
const MemoizedMessageList = React.memo(MessageList, (prevProps, nextProps) => {
  return prevProps.items === nextProps.items && prevProps.showStats === nextProps.showStats;
});

// Streaming text with electric spark effect - OPTIMIZED
const sparkAnsi = [
  '\x1b[1;38;5;231m',  // White, bold
  '\x1b[1;38;5;226m',  // Bright yellow, bold  
  '\x1b[38;5;220m',    // Gold
  '\x1b[38;5;214m',    // Orange
  '\x1b[38;5;208m',    // Dark orange
  '\x1b[38;5;202m',    // Deeper orange
  '\x1b[38;5;166m',    // Red-orange
];
const resetAnsi = '\x1b[0m';
const SPARK_SIZE = 15;
const FADE_INTERVAL = 100;

interface StreamingTextProps {
  content: string;
  showStats?: boolean;
  elapsed?: number;
  ttft?: number;
}

const StreamingText: React.FC<StreamingTextProps> = ({ content, showStats, elapsed, ttft }) => {
  const [sparkOffset, setSparkOffset] = useState(0);
  const prevLengthRef = useRef(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Track new content
  useEffect(() => {
    if (content.length > prevLengthRef.current) {
      setSparkOffset(0);
      prevLengthRef.current = content.length;
    }
  }, [content.length]);
  
  // Animation interval - runs once
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setSparkOffset(o => {
        const next = o + 1;
        if (next > SPARK_SIZE + sparkAnsi.length) return o;
        return next;
      });
    }, FADE_INTERVAL);
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);
  
  // Memoized content
  const coloredContent = useMemo(() => {
    if (!content) return '';
    if (sparkOffset > SPARK_SIZE + sparkAnsi.length) return content;
    
    const sparkStart = Math.max(0, content.length - SPARK_SIZE + sparkOffset);
    if (sparkStart >= content.length) return content;
    
    let result = content.slice(0, sparkStart);
    for (let i = sparkStart; i < content.length; i++) {
      const distanceFromEnd = content.length - 1 - i;
      const colorIndex = Math.min(distanceFromEnd + sparkOffset, sparkAnsi.length - 1);
      if (colorIndex >= 0 && colorIndex < sparkAnsi.length) {
        result += sparkAnsi[colorIndex] + content[i] + resetAnsi;
      } else {
        result += content[i];
      }
    }
    return result;
  }, [content, sparkOffset]);
  
  const cursorColor = sparkOffset < 3 ? '#FFFFFF' : colors.primary;
  
  return (
    <Box marginTop={1} flexDirection="column">
      <Box>
        <Text color={colors.accent}>{statusIcons.ai} </Text>
        <Text color={colors.accent} bold>HOTWIRE</Text>
        <Text color={colors.accent}>_</Text>
      </Box>
      <Box marginLeft={2}>
        <Text color={colors.text}>{coloredContent}</Text>
        <Text color={cursorColor}>▊</Text>
      </Box>
      {showStats && elapsed !== undefined && (
        <Box marginLeft={2}>
          <Text color={colors.textDim}>└─ </Text>
          <Text color={colors.success} dimColor>
            ⏱{elapsed.toFixed(1)}s
            {ttft !== undefined && ` │ TTFT: ${ttft}ms`}
          </Text>
        </Box>
      )}
    </Box>
  );
};

export default HotwireStreamView;
