import React from 'react';
import { Text, Box } from 'ink';
import { colors, logoCompact, tagline, boxChars } from '../theme';

export interface HeaderProps {
  /** Title text (will have trailing underscore added) */
  title?: string;
  /** Show the Grid logo/brand */
  showLogo?: boolean;
  /** Show tagline */
  showTagline?: boolean;
  /** Right-aligned status text */
  status?: React.ReactNode;
  /** Show separator line below header */
  showSeparator?: boolean;
  /** Width of the header */
  width?: number;
}

/**
 * Grid-branded header component
 * 
 * @example
 * <Header title="ORDERS" showLogo />
 * <Header showLogo showTagline />
 */
export function Header({
  title,
  showLogo = false,
  showTagline = false,
  status,
  showSeparator = true,
  width = 50,
}: HeaderProps): React.ReactElement {
  return (
    <Box flexDirection="column" width={width}>
      {/* Main header row */}
      <Box justifyContent="space-between">
        <Box>
          {showLogo && (
            <Text color={colors.text} bold>
              {logoCompact}
            </Text>
          )}
          {title && !showLogo && (
            <Text color={colors.text} bold>
              {title}_
            </Text>
          )}
          {title && showLogo && (
            <Text color={colors.textMuted}> {title}_</Text>
          )}
        </Box>
        {status && (
          <Box>
            {status}
          </Box>
        )}
      </Box>

      {/* Separator line */}
      {showSeparator && (
        <Text color={colors.textMuted}>
          {boxChars.horizontal.repeat(width)}
        </Text>
      )}

      {/* Tagline */}
      {showTagline && (
        <Text color={colors.textMuted} dimColor>
          {tagline}
        </Text>
      )}
    </Box>
  );
}

export default Header;
