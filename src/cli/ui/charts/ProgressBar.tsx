import React from 'react';
import { Box, Text } from 'ink';
import { colors } from '../theme';

export interface ProgressBarProps {
  /** Progress value (0-100) */
  value: number;
  /** Total width */
  width?: number;
  /** Show percentage label */
  showLabel?: boolean;
  /** Label position */
  labelPosition?: 'right' | 'inside';
  /** Filled bar color */
  color?: string;
  /** Empty bar color */
  emptyColor?: string;
  /** Characters to use */
  chars?: {
    filled: string;
    empty: string;
  };
}

/**
 * Progress bar component
 * 
 * @example
 * <ProgressBar value={75} />
 * <ProgressBar value={30} showLabel labelPosition="right" />
 */
export function ProgressBar({
  value,
  width = 30,
  showLabel = false,
  labelPosition = 'right',
  color = colors.primary,
  emptyColor = colors.textDim,
  chars = { filled: '█', empty: '░' },
}: ProgressBarProps): React.ReactElement {
  const percent = Math.max(0, Math.min(100, value));
  const filledWidth = Math.round((percent / 100) * width);
  const emptyWidth = width - filledWidth;

  const bar = (
    <Box>
      <Text color={color}>{chars.filled.repeat(filledWidth)}</Text>
      <Text color={emptyColor}>{chars.empty.repeat(emptyWidth)}</Text>
    </Box>
  );

  const label = <Text color={colors.textMuted}> {percent.toFixed(0)}%</Text>;

  if (!showLabel) {
    return bar;
  }

  if (labelPosition === 'inside') {
    return (
      <Box>
        <Text color={color}>{chars.filled.repeat(filledWidth)}</Text>
        {filledWidth > 3 && (
          <Text color={colors.text}>{percent.toFixed(0)}%</Text>
        )}
        <Text color={emptyColor}>{chars.empty.repeat(Math.max(0, emptyWidth - 4))}</Text>
      </Box>
    );
  }

  return (
    <Box>
      {bar}
      {label}
    </Box>
  );
}

/**
 * Compact progress indicator
 */
export function ProgressIndicator({
  current,
  total,
  label,
}: {
  current: number;
  total: number;
  label?: string;
}): React.ReactElement {
  const percent = total > 0 ? (current / total) * 100 : 0;
  
  return (
    <Box>
      {label && <Text color={colors.textMuted}>{label} </Text>}
      <ProgressBar value={percent} width={20} />
      <Text color={colors.textMuted}> {current}/{total}</Text>
    </Box>
  );
}

export default ProgressBar;
