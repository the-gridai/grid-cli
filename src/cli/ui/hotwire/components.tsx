/**
 * HOTWIRE Components - Grid-branded AI Interface Elements
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Box, Text } from 'ink';
import { hotwireColors, spinnerFrames, statusIcons, getRandomTagline, hotWireColors, sparkChars } from './theme';
import { colors } from '../theme';
import { isMacKeyboard, getModifierKey } from '../keyboard';

// Keyboard detection (respects GRID_KEYBOARD env var for dev containers)
const isMac = isMacKeyboard();
const modKey = getModifierKey();

/**
 * Animated HOTWIRE text with hot wire spark effect
 * - Spark travels through at random, longer intervals
 * - Spark shoots from underscore when animation reaches the end
 * - Animation pauses when paused=true to not interfere with input
 */
interface HotwireTextProps {
  size?: 'compact' | 'full';
  paused?: boolean; // Pause animation during input to prevent dropped characters
}

export const HotwireText: React.FC<HotwireTextProps> = ({ size = 'compact', paused = false }) => {
  const [sparkPosition, setSparkPosition] = useState(-1); // -1 = no spark active
  
  const text = 'HOTWIRE';
  const chars = text.split('');
  const underscoreIndex = chars.length; // Position of underscore
  
  useEffect(() => {
    // Don't run animation when paused
    if (paused) {
      setSparkPosition(-1);
      return;
    }
    
    let sparkTimeout: NodeJS.Timeout;
    let moveInterval: NodeJS.Timeout;
    
    const triggerSpark = () => {
      // Start spark at position 0
      let pos = 0;
      setSparkPosition(0);
      
      // Animate through the letters + underscore + fade out
      moveInterval = setInterval(() => {
        pos++;
        setSparkPosition(pos);
        
        // Animation finished after spark passes underscore and fades
        if (pos > underscoreIndex + 3) {
          setSparkPosition(-1);
          clearInterval(moveInterval);
          // Schedule next spark: 3-7 seconds
          sparkTimeout = setTimeout(triggerSpark, 3000 + Math.random() * 4000);
        }
      }, 70);
    };
    
    // Initial delay before first spark (1-2 seconds)
    sparkTimeout = setTimeout(triggerSpark, 1000 + Math.random() * 1000);
    
    return () => {
      clearTimeout(sparkTimeout);
      clearInterval(moveInterval);
    };
  }, [chars.length, underscoreIndex, paused]);
  
  // Get color for each character based on spark position
  const getCharColor = (index: number): string => {
    if (sparkPosition < 0) {
      return colors.textMuted; // No spark, cool state
    }
    
    const distance = sparkPosition - index;
    
    if (distance < 0 || distance > 4) {
      return colors.textMuted; // Not affected by spark
    }
    
    // Hot wire gradient: white-hot at spark → yellow → orange → cooling
    switch (distance) {
      case 0: return '#FFFFFF';   // White-hot (spark position)
      case 1: return '#FFDD00';   // Bright yellow (just passed)
      case 2: return '#FFAA00';   // Yellow-orange
      case 3: return '#FF7700';   // Orange
      case 4: return colors.textMuted; // Cooling back down
      default: return colors.textMuted;
    }
  };
  
  // Underscore color - same logic as letters, plus spark character change
  const getUnderscoreColor = (): string => {
    if (sparkPosition < 0) {
      return colors.textMuted; // Cool state, same as letters
    }
    
    const distance = sparkPosition - underscoreIndex;
    
    if (distance < 0 || distance > 4) {
      return colors.textMuted; // Not affected yet or cooled down
    }
    
    // Same hot wire gradient as letters
    switch (distance) {
      case 0: return '#FFFFFF';   // White-hot (spark at underscore)
      case 1: return '#FFDD00';   // Bright yellow
      case 2: return '#FFAA00';   // Yellow-orange
      case 3: return '#FF7700';   // Orange
      case 4: return colors.textMuted;
      default: return colors.textMuted;
    }
  };
  
  // Use single-width characters for spark effect to prevent layout shift
  // ⚡ can be double-width in some terminals, so use alternatives
  const getSparkDisplay = (): string => {
    if (sparkPosition < 0) return '_';
    const distance = sparkPosition - underscoreIndex;
    if (distance === 0) return '*';  // Spark hit - use asterisk (consistent width)
    if (distance === 1) return '+';  // Fading
    if (distance === 2) return '·';  // Fading more
    return '_';
  };
  
  return (
    <Box>
      {chars.map((char, i) => (
        <Text key={i} color={getCharColor(i)} bold>
          {char}
        </Text>
      ))}
      <Text color={getUnderscoreColor()} bold>{getSparkDisplay()}</Text>
    </Box>
  );
};

/**
 * Header component with animated HOTWIRE title
 */
interface HotwireHeaderProps {
  model: string;
  turn: number;
  connected?: boolean;
  showStats?: boolean;
  inputActive?: boolean; // When true, pauses animation to not interfere with typing
}

export const HotwireHeader: React.FC<HotwireHeaderProps> = ({ 
  model, 
  turn, 
  connected = true,
  showStats = false,
  inputActive = false
}) => {
  return (
    <Box flexDirection="column">
      <Box>
        <HotwireText paused={inputActive} />
        <Text color={colors.textDim}> │ </Text>
        <Text color={colors.primary}>{model}</Text>
        <Text color={colors.textDim}> │ </Text>
        <Text color={colors.success}>Turn {turn}</Text>
        <Text color={colors.textDim}> │ </Text>
        <Text color={connected ? colors.success : colors.error}>
          {connected ? statusIcons.connected : statusIcons.disconnected}
        </Text>
        {showStats && (
          <>
            <Text color={colors.textDim}> │ </Text>
            <Text color={colors.accent}>STATS</Text>
          </>
        )}
      </Box>
      <Box>
        <Text color={colors.textDim}>
          {'━'.repeat(60)}
        </Text>
      </Box>
    </Box>
  );
};

/**
 * Thinking/processing animation - visual only, no text
 */
interface ThinkingAnimationProps {
  message?: string; // Kept for backwards compat but not displayed
}

export const ThinkingAnimation: React.FC<ThinkingAnimationProps> = () => {
  const [frame, setFrame] = useState(0);
  const frames = spinnerFrames.blocks;
  
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

/**
 * Message bubble for chat
 */
interface MessageBubbleProps {
  role: 'user' | 'assistant' | 'system';
  content: string;
  stats?: {
    ttft?: number;
    completionTokens?: number;
    tps?: number;
    totalTime?: number;
    promptTokens?: number;
  };
  showStats?: boolean;
}

const MessageBubbleComponent: React.FC<MessageBubbleProps> = ({ 
  role, 
  content, 
  stats,
  showStats = false 
}) => {
  const isAssistant = role === 'assistant';
  
  const roleConfig = {
    user: {
      icon: statusIcons.user,
      label: 'YOU',
      color: colors.primary,
      labelColor: colors.text,
    },
    assistant: {
      icon: statusIcons.ai,
      label: 'HOTWIRE',
      color: colors.accent,
      labelColor: colors.text,
    },
    system: {
      icon: statusIcons.system,
      label: 'SYSTEM',
      color: colors.textMuted,
      labelColor: colors.textMuted,
    },
  };
  
  const config = roleConfig[role];
  
  return (
    <Box flexDirection="column" marginTop={1}>
      <Box>
        <Text color={config.color}>{config.icon} </Text>
        <Text color={config.labelColor} bold>{config.label}</Text>
        {role === 'assistant' && <Text color={colors.accent}>_</Text>}
      </Box>
      <Box marginLeft={2}>
        <Text color={colors.text} wrap="wrap">{content}</Text>
      </Box>
      {showStats && stats && isAssistant && (
        <Box marginLeft={2} marginTop={0}>
          <Text color={colors.textDim}>└─ </Text>
          <Text color={colors.success} dimColor>
            {stats.ttft !== undefined && `⚡${stats.ttft}ms`}
            {stats.completionTokens !== undefined && ` │ ${stats.completionTokens}tok`}
            {stats.tps !== undefined && ` │ ${stats.tps}t/s`}
            {stats.totalTime !== undefined && ` │ ${(stats.totalTime / 1000).toFixed(1)}s`}
          </Text>
        </Box>
      )}
    </Box>
  );
};

// Memoize to prevent re-renders during input typing
export const MessageBubble = React.memo(MessageBubbleComponent);

/**
 * Streaming content display with electric spark effect
 * New characters appear white-hot and fade through yellow → orange → normal
 * OPTIMIZED: Minimal re-renders, no string rebuilding on every frame
 */
interface StreamingContentProps {
  content: string;
  showCursor?: boolean;
  stats?: {
    elapsed: number;
    ttft?: number;
  };
  showStats?: boolean;
}

// Spark colors as ANSI 256 codes: white-hot → bright yellow → gold → orange
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
const SPARK_SIZE = 15; // Longer trail for chunked responses
const FADE_INTERVAL = 100; // Slower fade (was 60ms)

export const StreamingContent: React.FC<StreamingContentProps> = ({ 
  content, 
  showCursor = true,
  stats,
  showStats = false
}) => {
  const [sparkOffset, setSparkOffset] = useState(0);
  const prevLengthRef = useRef(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Track new content and manage spark animation
  useEffect(() => {
    // New content arrived - reset spark
    if (content.length > prevLengthRef.current) {
      setSparkOffset(0);
      prevLengthRef.current = content.length;
    }
  }, [content.length]);
  
  // Separate effect for animation interval - only runs once
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setSparkOffset(o => {
        const next = o + 1;
        // Stop updating once fully faded
        if (next > SPARK_SIZE + sparkAnsi.length) {
          return o; // No state change = no re-render
        }
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
  
  // Memoized content rendering - only recalculates when content or sparkOffset changes
  const coloredContent = useMemo(() => {
    if (!content) return '';
    
    // If spark fully faded, just return plain content
    if (sparkOffset > SPARK_SIZE + sparkAnsi.length) {
      return content;
    }
    
    const sparkStart = Math.max(0, content.length - SPARK_SIZE + sparkOffset);
    
    // If no spark visible, return plain
    if (sparkStart >= content.length) {
      return content;
    }
    
    // Build colored portion only
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
    <Box flexDirection="column" marginTop={1}>
      <Box>
        <Text color={colors.accent}>{statusIcons.ai} </Text>
        <Text color={colors.accent} bold>HOTWIRE</Text>
        <Text color={colors.accent}>_</Text>
      </Box>
      <Box marginLeft={2}>
        <Text color={colors.text}>{coloredContent}</Text>
        {showCursor && <Text color={cursorColor}>▊</Text>}
      </Box>
      {showStats && stats && (
        <Box marginLeft={2}>
          <Text color={colors.textDim}>└─ </Text>
          <Text color={colors.success} dimColor>
            ⏱{stats.elapsed.toFixed(1)}s
            {stats.ttft !== undefined && ` │ TTFT: ${stats.ttft}ms`}
          </Text>
        </Box>
      )}
    </Box>
  );
};

/**
 * Footer with shortcuts
 */
interface HotwireFooterProps {
  hasMoreAbove?: boolean;
  hasMoreBelow?: boolean;
  aboveCount?: number;
  belowCount?: number;
}

export const HotwireFooter: React.FC<HotwireFooterProps> = ({
  hasMoreAbove,
  hasMoreBelow,
  aboveCount = 0,
  belowCount = 0,
}) => {
  return (
    <Box flexDirection="column">
      {hasMoreAbove && (
        <Text color={colors.textDim}>  ▲ {aboveCount} more above</Text>
      )}
      {hasMoreBelow && (
        <Text color={colors.textDim}>  ▼ {belowCount} more below</Text>
      )}
      <Box marginTop={1}>
        <Text color={colors.textDim}>
          [{modKey}+M] <Text color={colors.primary}>model</Text>
          {' '}[{modKey}+N] <Text color={colors.accent}>new</Text>
          {' '}[{modKey}+S] <Text color={colors.success}>stats</Text>
          {' '}[{modKey}+↑↓] <Text color={colors.textMuted}>scroll</Text>
        </Text>
      </Box>
    </Box>
  );
};

/**
 * Welcome screen with tagline
 */
interface WelcomeScreenProps {
  onDismiss?: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = () => {
  const [tagline] = useState(getRandomTagline);
  
  return (
    <Box flexDirection="column" alignItems="center" paddingY={1}>
      <HotwireText />
      <Box marginTop={1}>
        <Text color={colors.textMuted} italic>
          {tagline}
        </Text>
      </Box>
    </Box>
  );
};

/**
 * Model selector overlay
 */
export const ModelSelector: React.FC<{
  models: Array<{ id: string; display_name?: string }>;
  selectedIndex: number;
}> = ({ models, selectedIndex }) => {
  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color={colors.text} bold>SELECT MODEL</Text>
        <Text color={colors.accent}>_</Text>
      </Box>
      {models.map((model, i) => (
        <Box key={model.id}>
          <Text color={i === selectedIndex ? colors.accent : colors.textDim}>
            {i === selectedIndex ? '▶ ' : '  '}
          </Text>
          <Text color={i === selectedIndex ? colors.text : colors.textMuted}>
            {model.id}
          </Text>
          {model.display_name && (
            <Text color={colors.textDim}> • {model.display_name}</Text>
          )}
        </Box>
      ))}
      <Box marginTop={1}>
        <Text color={colors.textDim}>
          [Enter] <Text color={colors.success}>select</Text>
          {' '}[Esc] <Text color={colors.error}>cancel</Text>
        </Text>
      </Box>
    </Box>
  );
};

/**
 * Grid-style spinner
 */
interface GridSpinnerProps {
  label?: string;
}

export const GridSpinner: React.FC<GridSpinnerProps> = ({ label = 'Loading' }) => {
  const [frame, setFrame] = useState(0);
  const frames = spinnerFrames.blocks;
  
  useEffect(() => {
    const interval = setInterval(() => {
      setFrame(f => (f + 1) % frames.length);
    }, 80);
    return () => clearInterval(interval);
  }, []);
  
  return (
    <Box>
      <Text color={colors.primary}>{frames[frame]} </Text>
      <Text color={colors.text}>{label}</Text>
    </Box>
  );
};
