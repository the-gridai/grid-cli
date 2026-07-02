import React from 'react';
import { Box, Text } from 'ink';
import { Header, Divider } from '../components';
import { colors, tagline } from '../theme';

export interface AuthLoginViewProps {
  credentialsPath: string;
}

/**
 * Auth login view - displays setup instructions in Grid style
 */
export function AuthLoginView({
  credentialsPath,
}: AuthLoginViewProps): React.ReactElement {
  return (
    <Box flexDirection="column" paddingY={1}>
      <Header title="CREDENTIALS SETUP" showSeparator width={65} />
      
      {/* Option 1: Manual */}
      <Box flexDirection="column" paddingX={2} marginTop={1}>
        <Text color={colors.primary} bold>OPTION 1: PROFILE CONFIGURATION_</Text>
        <Divider width={45} char="─" />
        <Box marginTop={1}>
          <Text color={colors.textMuted}>If you have credentials, create a profile:</Text>
        </Box>
        <Box flexDirection="column" paddingLeft={2} marginTop={1}>
          <Text color={colors.accent}>grid profile set myprofile \</Text>
          <Text color={colors.accent}>  --api-url "https://api.example.com/v1" \</Text>
          <Text color={colors.accent}>  --signing-key "base64-encoded-key" \</Text>
          <Text color={colors.accent}>  --fingerprint "key-fingerprint"</Text>
        </Box>
      </Box>

      {/* Option 2: Env vars */}
      <Box flexDirection="column" paddingX={2} marginTop={2}>
        <Text color={colors.primary} bold>OPTION 2: ENVIRONMENT VARIABLES_</Text>
        <Divider width={45} char="─" />
        <Box marginTop={1}>
          <Text color={colors.textMuted}>Set these environment variables:</Text>
        </Box>
        <Box flexDirection="column" paddingLeft={2} marginTop={1}>
          <Text color={colors.accent}>export API_URL="https://api.example.com/v1"</Text>
          <Text color={colors.accent}>export SIGNING_KEY="base64-encoded-key"</Text>
          <Text color={colors.accent}>export SIGNING_KEY_FINGERPRINT="key-fingerprint"</Text>
        </Box>
      </Box>

      <Box marginTop={2}>
        <Divider width={65} />
      </Box>

      <Box flexDirection="column" paddingX={2}>
        <Text color={colors.textDim}>Credentials file: {credentialsPath}</Text>
        <Box marginTop={1}>
          <Text color={colors.text}>After configuring, verify with: </Text>
          <Text color={colors.success}>grid auth status</Text>
        </Box>
      </Box>
    </Box>
  );
}

export default AuthLoginView;
