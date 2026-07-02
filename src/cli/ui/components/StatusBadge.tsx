import React from 'react';
import { Text, Box } from 'ink';
import { colors, getStatusColor } from '../theme';

export type StatusType = 'success' | 'warning' | 'error' | 'info' | 'muted';

export interface StatusBadgeProps {
  /** Status type determines color */
  status: StatusType;
  /** Text to display */
  label: string;
  /** Show status dot indicator */
  showDot?: boolean;
  /** Use trailing underscore (Grid style) */
  withUnderscore?: boolean;
}

/**
 * Status indicator with colored badge
 * 
 * @example
 * <StatusBadge status="success" label="Connected" showDot />
 * <StatusBadge status="error" label="Failed" />
 */
export function StatusBadge({
  status,
  label,
  showDot = false,
  withUnderscore = false,
}: StatusBadgeProps): React.ReactElement {
  const color = getStatusColor(status);
  const displayLabel = withUnderscore ? `${label}_` : label;

  return (
    <Box>
      {showDot && (
        <Text color={color}>● </Text>
      )}
      <Text color={color}>{displayLabel}</Text>
    </Box>
  );
}

/**
 * Inline status dot
 */
export function StatusDot({ status }: { status: StatusType }): React.ReactElement {
  const color = getStatusColor(status);
  return <Text color={color}>●</Text>;
}

/**
 * Status text with semantic coloring
 */
export function StatusText({ 
  status, 
  children 
}: { 
  status: StatusType; 
  children: React.ReactNode;
}): React.ReactElement {
  const color = getStatusColor(status);
  return <Text color={color}>{children}</Text>;
}

export default StatusBadge;
