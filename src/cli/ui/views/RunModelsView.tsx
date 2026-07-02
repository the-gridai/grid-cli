import React from 'react';
import { Box, Text } from 'ink';
import { colors, formatLabel } from '../theme';
import { Table } from '../components';
import type { Model } from '../../../sdk/responses/types';

interface RunModelsViewProps {
  models: Model[];
  verbose?: boolean;
  error?: string;
}

export const RunModelsView: React.FC<RunModelsViewProps> = ({ models, verbose, error }) => {
  if (error) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color={colors.text} bold>{formatLabel('MODELS')}</Text>
        <Box marginTop={1}>
          <Text color={colors.error}>Error: {error}</Text>
        </Box>
        <Box marginTop={1}>
          <Text color={colors.textDim}>
            Make sure you have a valid API key configured.
          </Text>
        </Box>
      </Box>
    );
  }

  if (models.length === 0) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color={colors.text} bold>{formatLabel('MODELS')}</Text>
        <Box marginTop={1}>
          <Text color={colors.textMuted}>No models available.</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text color={colors.text} bold>{formatLabel('MODELS')}</Text>
        <Text color={colors.textMuted}> | </Text>
        <Text color={colors.textDim}>{models.length} available</Text>
      </Box>

      <Table
        data={models}
        columns={[
          { 
            header: 'ID', 
            accessor: 'id', 
            width: 30,
            color: () => colors.primary,
          },
          { 
            header: 'NAME', 
            accessor: 'display_name', 
            width: 40,
          },
        ]}
      />

      <Box marginTop={1}>
        <Text color={colors.textDim}>
          Usage: grid run -m {'<model-id>'} "Your prompt here"
        </Text>
      </Box>
    </Box>
  );
};
