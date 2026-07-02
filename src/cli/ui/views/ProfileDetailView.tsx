import React from 'react';
import { Box, Text } from 'ink';
import { Header, KeyValue, Divider, StatusBadge } from '../components';
import { colors, tagline } from '../theme';

export interface ConsumptionConfigData {
  defaultSpec?: string;
  defaultInstructions?: string;
  autoFund?: boolean;
  autoFundAmount?: number;
  defaultTemperature?: number;
  defaultMaxTokens?: number;
}

export interface ProfileDetailData {
  name: string;
  description?: string;
  apiUrl?: string;
  wsUrl?: string;
  consumptionApiUrl?: string;
  signingKey?: string;
  fingerprint?: string;
  apiKey?: string;
  consumption?: ConsumptionConfigData;
}

export interface ProfileDetailViewProps {
  profile: ProfileDetailData | null;
  profileName: string;
  showSecrets?: boolean;
  credentialsPath: string;
  error?: string;
}

/**
 * Profile detail view - displays individual profile configuration
 */
export function ProfileDetailView({
  profile,
  profileName,
  showSecrets = false,
  credentialsPath,
  error,
}: ProfileDetailViewProps): React.ReactElement {
  if (error) {
    return (
      <Box flexDirection="column" paddingY={1}>
        <Header title="PROFILE" showSeparator width={55} />
        <Box paddingX={2} marginTop={1}>
          <StatusBadge status="error" label={error} showDot />
        </Box>
        <Box paddingX={2} marginTop={1}>
          <Text color={colors.textDim}>Run: grid profile list</Text>
        </Box>
      </Box>
    );
  }

  if (!profile) {
    return (
      <Box flexDirection="column" paddingY={1}>
        <Header title="PROFILE" showSeparator width={55} />
        <Box paddingX={2} marginTop={1}>
          <Text color={colors.warning}>Profile '{profileName}' not found.</Text>
        </Box>
        <Box paddingX={2} marginTop={1}>
          <Text color={colors.textDim}>Run: grid profile list</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingY={1}>
      <Header title={`PROFILE: ${profileName.toUpperCase()}`} showSeparator width={55} />
      
      <Box flexDirection="column" paddingX={2} marginTop={1}>
        <KeyValue
          labelWidth={18}
          items={[
            { label: 'Description', value: profile.description || '-', valueColor: colors.text },
            { label: 'API URL', value: profile.apiUrl || '-', valueColor: colors.text },
            { label: 'Consumption URL', value: profile.consumptionApiUrl || '-', valueColor: colors.text },
            { label: 'WebSocket URL', value: profile.wsUrl || '-', valueColor: colors.text },
            { 
              label: 'Signing Key', 
              value: profile.signingKey 
                ? (showSecrets ? profile.signingKey : maskSecret(profile.signingKey))
                : '(not set)',
              valueColor: profile.signingKey ? colors.success : colors.textDim,
            },
            { 
              label: 'Fingerprint', 
              value: profile.fingerprint || '(not set)',
              valueColor: profile.fingerprint ? colors.text : colors.textDim,
            },
            { 
              label: 'API Key', 
              value: profile.apiKey 
                ? (showSecrets ? profile.apiKey : maskSecret(profile.apiKey))
                : '(not set)',
              valueColor: profile.apiKey ? colors.success : colors.textDim,
            },
          ]}
        />
      </Box>

      {profile.consumption && hasConsumptionConfig(profile.consumption) && (
        <>
          <Box marginTop={1} paddingX={2}>
            <Text color={colors.textMuted}>Consumption Settings:</Text>
          </Box>
          <Box flexDirection="column" paddingX={2}>
            <KeyValue
              labelWidth={18}
              items={[
                ...(profile.consumption.defaultSpec ? [{ 
                  label: 'Default Spec', 
                  value: profile.consumption.defaultSpec, 
                  valueColor: colors.text 
                }] : []),
                ...(profile.consumption.autoFund !== undefined ? [{ 
                  label: 'Auto Fund', 
                  value: profile.consumption.autoFund ? 'Enabled' : 'Disabled', 
                  valueColor: profile.consumption.autoFund ? colors.success : colors.textDim 
                }] : []),
                ...(profile.consumption.autoFundAmount ? [{ 
                  label: 'Auto Fund Amount', 
                  value: String(profile.consumption.autoFundAmount), 
                  valueColor: colors.text 
                }] : []),
                ...(profile.consumption.defaultTemperature !== undefined ? [{ 
                  label: 'Temperature', 
                  value: String(profile.consumption.defaultTemperature), 
                  valueColor: colors.text 
                }] : []),
                ...(profile.consumption.defaultMaxTokens ? [{ 
                  label: 'Max Tokens', 
                  value: String(profile.consumption.defaultMaxTokens), 
                  valueColor: colors.text 
                }] : []),
                ...(profile.consumption.defaultInstructions ? [{ 
                  label: 'Instructions', 
                  value: truncate(profile.consumption.defaultInstructions, 30), 
                  valueColor: colors.text 
                }] : []),
              ]}
            />
          </Box>
        </>
      )}

      <Box marginTop={1}>
        <Divider width={55} />
      </Box>

      <Box paddingX={2}>
        <Text color={colors.textDim}>Source: {credentialsPath}</Text>
      </Box>

      {!showSecrets && (profile.signingKey || profile.apiKey) && (
        <Box paddingX={2}>
          <Text color={colors.textDim}>Use --show-secrets to reveal secret values</Text>
        </Box>
      )}
    </Box>
  );
}

function maskSecret(secret: string): string {
  if (secret.length <= 8) return '****';
  return secret.substring(0, 4) + '...' + secret.substring(secret.length - 4);
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen - 3) + '...';
}

function hasConsumptionConfig(config: ConsumptionConfigData): boolean {
  return !!(
    config.defaultSpec ||
    config.defaultInstructions ||
    config.autoFund !== undefined ||
    config.autoFundAmount ||
    config.defaultTemperature !== undefined ||
    config.defaultMaxTokens
  );
}

export default ProfileDetailView;
