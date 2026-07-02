import React from 'react';
import { Text, Box } from 'ink';
import { colors, boxChars } from '../theme';

export interface DividerProps {
  /** Width of the divider */
  width?: number;
  /** Character to use for the line */
  char?: string;
  /** Color of the divider */
  color?: string;
  /** Title in the middle of the divider */
  title?: string;
}

/**
 * Horizontal divider line
 * 
 * @example
 * <Divider />
 * <Divider title="Section" />
 */
export function Divider({
  width = 50,
  char = boxChars.horizontal,
  color = colors.textMuted,
  title,
}: DividerProps): React.ReactElement {
  if (title) {
    const titleLen = title.length + 2; // Add padding
    const sideLen = Math.floor((width - titleLen) / 2);
    return (
      <Box>
        <Text color={color}>{char.repeat(sideLen)}</Text>
        <Text color={colors.text}> {title} </Text>
        <Text color={color}>{char.repeat(width - sideLen - titleLen)}</Text>
      </Box>
    );
  }

  return <Text color={color}>{char.repeat(width)}</Text>;
}

export default Divider;
