import React from 'react';
import { Box, Text } from 'ink';
import { colors } from '../theme';

export interface BarChartData {
  label: string;
  value: number;
  color?: string;
}

export interface BarChartProps {
  /** Data to display */
  data: BarChartData[];
  /** Chart title */
  title?: string;
  /** Chart width */
  width?: number;
  /** Show values */
  showValue?: 'right' | 'inside' | 'none';
  /** Sort order */
  sort?: 'none' | 'asc' | 'desc';
  /** Format function for values */
  format?: (value: number) => string;
  /** Label width */
  labelWidth?: number;
}

/**
 * Grid-styled bar chart (simple ASCII implementation)
 * 
 * @example
 * <BarChart
 *   title="Balances"
 *   data={[
 *     { label: 'USDC', value: 5000, color: colors.accent },
 *     { label: 'IU', value: 1250, color: colors.primary },
 *   ]}
 * />
 */
export function BarChart({
  data,
  title,
  width = 40,
  showValue = 'right',
  sort = 'none',
  format = (v) => v.toLocaleString(),
  labelWidth = 12,
}: BarChartProps): React.ReactElement {
  if (data.length === 0) {
    return <Box />;
  }

  // Sort data if requested
  let sortedData = [...data];
  if (sort === 'asc') {
    sortedData.sort((a, b) => a.value - b.value);
  } else if (sort === 'desc') {
    sortedData.sort((a, b) => b.value - a.value);
  }

  // Calculate max value for scaling
  const maxValue = Math.max(...sortedData.map(d => d.value), 1);
  const barWidth = width - labelWidth - (showValue === 'right' ? 12 : 0);

  return (
    <Box flexDirection="column">
      {title && (
        <Text color={colors.text} bold>
          {title}_
        </Text>
      )}
      {sortedData.map((item, index) => {
        const barLength = Math.round((item.value / maxValue) * barWidth);
        const barColor = item.color || (index % 2 === 0 ? colors.primary : colors.accent);
        
        return (
          <Box key={index}>
            <Box width={labelWidth}>
              <Text color={colors.textMuted}>{item.label}</Text>
            </Box>
            <Text color={barColor}>{'█'.repeat(barLength)}</Text>
            <Text color={colors.textDim}>{'░'.repeat(barWidth - barLength)}</Text>
            {showValue === 'right' && (
              <Text color={colors.text}> {format(item.value)}</Text>
            )}
          </Box>
        );
      })}
    </Box>
  );
}

export default BarChart;
