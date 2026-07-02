import React from 'react';
import { Text, Box } from 'ink';
import { colors } from '../theme';

export interface KeyValuePair {
  /** Label/key */
  label: string;
  /** Value to display */
  value: React.ReactNode;
  /** Color for the value */
  valueColor?: string;
}

export interface KeyValueProps {
  /** Array of key-value pairs */
  items: KeyValuePair[];
  /** Width for the label column */
  labelWidth?: number;
  /** Separator between label and value */
  separator?: string;
  /** Label color */
  labelColor?: string;
}

/**
 * Key-value pair display
 * 
 * @example
 * <KeyValue
 *   items={[
 *     { label: 'API URL', value: 'https://api.thegrid.ai' },
 *     { label: 'Status', value: 'Connected', valueColor: colors.success },
 *   ]}
 * />
 */
export function KeyValue({
  items,
  labelWidth = 15,
  separator = '',
  labelColor = colors.textMuted,
}: KeyValueProps): React.ReactElement {
  return (
    <Box flexDirection="column">
      {items.map((item, index) => (
        <Box key={index}>
          <Box width={labelWidth}>
            <Text color={labelColor}>{item.label}</Text>
          </Box>
          <Text color={colors.textMuted}>{separator}</Text>
          <Text color={item.valueColor || colors.text}>
            {item.value}
          </Text>
        </Box>
      ))}
    </Box>
  );
}

/**
 * Single key-value row
 */
export function KeyValueRow({
  label,
  value,
  labelWidth = 15,
  labelColor = colors.textMuted,
  valueColor = colors.text,
}: {
  label: string;
  value: React.ReactNode;
  labelWidth?: number;
  labelColor?: string;
  valueColor?: string;
}): React.ReactElement {
  return (
    <Box>
      <Box width={labelWidth}>
        <Text color={labelColor}>{label}</Text>
      </Box>
      <Text color={valueColor}>{value}</Text>
    </Box>
  );
}

export default KeyValue;
