import React from 'react';
import { Text, Box } from 'ink';
import InkSpinner from 'ink-spinner';
import { colors, spinnerFrames } from '../theme';

export interface SpinnerProps {
  /** Text to display next to the spinner */
  label?: string;
  /** Type of spinner animation */
  type?: 'dots' | 'grid' | 'default';
  /** Color of the spinner */
  color?: string;
}

/**
 * Grid-branded loading spinner
 * 
 * @example
 * <Spinner label="Loading..." />
 * <Spinner type="grid" label="Fetching data..." />
 */
export function Spinner({ 
  label, 
  type = 'default',
  color = colors.primary 
}: SpinnerProps): React.ReactElement {
  if (type === 'grid') {
    // Custom Grid-branded spinner using braille characters
    return (
      <Box>
        <Text color={color}>
          <GridSpinner />
        </Text>
        {label && <Text color={colors.text}> {label}</Text>}
      </Box>
    );
  }

  return (
    <Box>
      <Text color={color}>
        <InkSpinner type={type === 'dots' ? 'dots' : 'dots'} />
      </Text>
      {label && <Text color={colors.text}> {label}</Text>}
    </Box>
  );
}

/**
 * Custom Grid-branded spinner component
 */
function GridSpinner(): React.ReactElement {
  const [frame, setFrame] = React.useState(0);

  React.useEffect(() => {
    const timer = setInterval(() => {
      setFrame(prev => (prev + 1) % spinnerFrames.length);
    }, 100);
    return () => clearInterval(timer);
  }, []);

  return <Text>{spinnerFrames[frame]}</Text>;
}

export default Spinner;
