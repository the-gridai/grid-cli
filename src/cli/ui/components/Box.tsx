import React from 'react';
import { Box as InkBox, Text } from 'ink';
import { colors, boxChars, formatLabel } from '../theme';

export interface StyledBoxProps {
  /** Box title (will have trailing underscore added) */
  title?: string;
  /** Content inside the box */
  children: React.ReactNode;
  /** Width of the box */
  width?: number | string;
  /** Padding inside the box */
  padding?: number;
  /** Border style */
  borderStyle?: 'single' | 'double' | 'none';
  /** Border color */
  borderColor?: string;
  /** Background variant */
  variant?: 'default' | 'surface' | 'primary';
}

/**
 * Grid-styled container with optional title and borders
 * 
 * @example
 * <StyledBox title="STATUS">
 *   <Text>Connected</Text>
 * </StyledBox>
 */
export function StyledBox({
  title,
  children,
  width,
  padding = 1,
  borderStyle = 'single',
  borderColor = colors.textMuted,
  variant = 'default',
}: StyledBoxProps): React.ReactElement {
  const showBorder = borderStyle !== 'none';

  if (!showBorder) {
    return (
      <InkBox flexDirection="column" paddingX={padding}>
        {title && (
          <Text color={colors.text} bold>
            {formatLabel(title)}
          </Text>
        )}
        {children}
      </InkBox>
    );
  }

  // Calculate content width for border drawing
  const contentWidth = typeof width === 'number' ? width - 2 : 40;

  return (
    <InkBox flexDirection="column" width={width}>
      {/* Title or top border */}
      <Text color={borderColor}>
        {boxChars.topLeft}
        {title ? (
          <>
            {boxChars.horizontal}
            <Text color={colors.text} bold> {formatLabel(title)} </Text>
            {boxChars.horizontal.repeat(Math.max(0, contentWidth - title.length - 5))}
          </>
        ) : (
          boxChars.horizontal.repeat(contentWidth)
        )}
        {boxChars.topRight}
      </Text>

      {/* Content */}
      <InkBox flexDirection="column">
        {React.Children.map(children, child => (
          <InkBox>
            <Text color={borderColor}>{boxChars.vertical}</Text>
            <InkBox paddingX={padding} flexGrow={1}>
              {child}
            </InkBox>
            <Text color={borderColor}>{boxChars.vertical}</Text>
          </InkBox>
        ))}
      </InkBox>

      {/* Bottom border */}
      <Text color={borderColor}>
        {boxChars.bottomLeft}
        {boxChars.horizontal.repeat(contentWidth)}
        {boxChars.bottomRight}
      </Text>
    </InkBox>
  );
}

export { StyledBox as GridBox };
export default StyledBox;
