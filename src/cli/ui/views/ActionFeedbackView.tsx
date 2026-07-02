import React from 'react';
import { Box, Text } from 'ink';
import { Spinner, StatusBadge, KeyValue, Header } from '../components';
import { colors, tagline } from '../theme';

export type ActionStatus = 'pending' | 'success' | 'error';

export interface ActionFeedbackViewProps {
  /** Action title (e.g., "Creating order...", "Order created") */
  title: string;
  /** Current status */
  status: ActionStatus;
  /** Details to show (key-value pairs) */
  details?: { label: string; value: string }[];
  /** Error message if status is error */
  error?: string;
  /** Additional message */
  message?: string;
}

/**
 * Generic action feedback view - shows progress/result of CLI actions
 */
export function ActionFeedbackView({
  title,
  status,
  details,
  error,
  message,
}: ActionFeedbackViewProps): React.ReactElement {
  return (
    <Box flexDirection="column" paddingY={1}>
      {/* Status indicator */}
      <Box>
        {status === 'pending' ? (
          <Spinner label={title} type="grid" />
        ) : (
          <StatusBadge
            status={status === 'success' ? 'success' : 'error'}
            label={title}
            showDot
            withUnderscore
          />
        )}
      </Box>

      {/* Error message */}
      {error && (
        <Box paddingX={2} marginTop={1}>
          <Text color={colors.error}>{error}</Text>
        </Box>
      )}

      {/* Details */}
      {details && details.length > 0 && (
        <Box paddingX={2} marginTop={1}>
          <KeyValue
            items={details.map(d => ({
              label: d.label,
              value: d.value,
              valueColor: colors.text,
            }))}
            labelWidth={16}
          />
        </Box>
      )}

      {/* Message */}
      {message && (
        <Box paddingX={2} marginTop={1}>
          <Text color={colors.textMuted}>{message}</Text>
        </Box>
      )}
    </Box>
  );
}

export default ActionFeedbackView;
