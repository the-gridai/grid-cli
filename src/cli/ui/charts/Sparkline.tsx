import React from 'react';
import { Box, Text } from 'ink';
import { colors } from '../theme';

export interface SparklineProps {
  /** Data points to display */
  data: number[];
  /** Chart width */
  width?: number;
  /** Color for the sparkline */
  color?: string;
  /** Optional caption */
  caption?: string;
}

// Block characters for vertical height representation
const BLOCKS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];

/**
 * Grid-styled sparkline chart (simple ASCII implementation)
 * 
 * @example
 * <Sparkline data={[1, 3, 2, 5, 4, 6]} />
 * <Sparkline data={prices} color={colors.primary} caption="Price trend" />
 */
export function Sparkline({
  data,
  width,
  color = colors.primary,
  caption,
}: SparklineProps): React.ReactElement {
  if (data.length === 0) {
    return <Text color={colors.textMuted}>No data</Text>;
  }

  const displayData = width ? data.slice(-width) : data;
  const min = Math.min(...displayData);
  const max = Math.max(...displayData);
  const range = max - min || 1;

  const sparkline = displayData.map(value => {
    const normalized = (value - min) / range;
    const blockIndex = Math.floor(normalized * (BLOCKS.length - 1));
    return BLOCKS[blockIndex];
  }).join('');

  return (
    <Box flexDirection="column">
      <Text color={color}>{sparkline}</Text>
      {caption && (
        <Text color={colors.textMuted} dimColor>
          {caption}
        </Text>
      )}
    </Box>
  );
}

/**
 * Inline sparkline for use in tables
 */
export function InlineSparkline({ 
  data, 
  width = 10,
}: { 
  data: number[]; 
  width?: number;
}): React.ReactElement {
  if (data.length === 0) {
    return <Text color={colors.textMuted}>-</Text>;
  }

  // Simple ASCII sparkline using block characters
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  
  const blocks = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
  
  const normalized = data.slice(-width).map(v => {
    const level = Math.floor(((v - min) / range) * (blocks.length - 1));
    return blocks[level];
  });

  // Determine color based on trend
  const trend = data[data.length - 1] - data[0];
  const color = trend > 0 ? colors.success : trend < 0 ? colors.error : colors.textMuted;

  return <Text color={color}>{normalized.join('')}</Text>;
}

export default Sparkline;
