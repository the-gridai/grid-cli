import React from 'react';
import { Box, Text } from 'ink';
import { Header, Divider } from '../components';
import { colors, tagline } from '../theme';

export interface StrategyInfo {
  name: string;
  description?: string;
}

export interface StrategyListViewProps {
  strategies: StrategyInfo[];
  error?: string;
}

/**
 * Strategy list view - displays available trading strategies
 */
export function StrategyListView({
  strategies,
  error,
}: StrategyListViewProps): React.ReactElement {
  if (error) {
    return (
      <Box flexDirection="column" paddingY={1}>
        <Header title="STRATEGIES" showSeparator width={50} />
        <Box paddingX={2} marginTop={1}>
          <Text color={colors.error}>Error: {error}</Text>
        </Box>
      </Box>
    );
  }

  if (strategies.length === 0) {
    return (
      <Box flexDirection="column" paddingY={1}>
        <Header title="STRATEGIES" showSeparator width={50} />
        <Box paddingX={2} marginTop={1}>
          <Text color={colors.warning}>No strategies found.</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingY={1}>
      <Header title="STRATEGIES" showSeparator width={50} />
      
      <Box flexDirection="column" paddingX={2} marginTop={1}>
        {strategies.map((strategy, index) => (
          <Box key={index}>
            <Text color={colors.success}>▸ </Text>
            <Text color={colors.text}>{strategy.name}</Text>
            {strategy.description && (
              <Text color={colors.textMuted}> - {strategy.description}</Text>
            )}
          </Box>
        ))}
      </Box>

      <Box marginTop={1}>
        <Divider width={50} />
      </Box>

      <Box paddingX={2}>
        <Text color={colors.textMuted}>Run a strategy with: </Text>
        <Text color={colors.accent}>grid strategy start {'<strategy-name>'}</Text>
      </Box>
    </Box>
  );
}

export default StrategyListView;
