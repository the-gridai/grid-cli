import React from 'react';
import { Box, Text } from 'ink';
import { colors, formatLabel } from '../theme';

interface RunViewProps {
  error?: string;
  hint?: string;
  message?: string;
}

export const RunView: React.FC<RunViewProps> = ({ error, hint, message }) => {
  if (error) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color={colors.text} bold>{formatLabel('RUN')}</Text>
        <Box marginTop={1}>
          <Text color={colors.error}>Error: {error}</Text>
        </Box>
        {hint && (
          <Box marginTop={1}>
            <Text color={colors.textDim}>{hint}</Text>
          </Box>
        )}
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Text color={colors.text} bold>{formatLabel('RUN')}</Text>
      {message && (
        <Box marginTop={1}>
          <Text color={colors.text}>{message}</Text>
        </Box>
      )}
    </Box>
  );
};
