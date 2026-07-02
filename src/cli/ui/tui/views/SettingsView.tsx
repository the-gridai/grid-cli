import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { colors } from '../../theme';
import { KeyValue, StatusBadge } from '../../components';
import { getConfig } from '../../../../core/config/config';
import { getActiveProfileName, listProfiles } from '../../../../core/config/profiles';
import { useContentFocused } from '../FocusContext';

interface ProfileInfo {
  name: string;
  isActive: boolean;
  hasCredentials: boolean;
}

export function SettingsView(): React.ReactElement {
  const isContentFocused = useContentFocused();
  
  const [profiles, setProfiles] = useState<ProfileInfo[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [config, setConfig] = useState<any>(null);

  useEffect(() => {
    const cfg = getConfig();
    setConfig(cfg);

    const activeProfile = getActiveProfileName() ?? 'default';
    const availableProfiles = listProfiles();
    
    const profileList: ProfileInfo[] = availableProfiles.map((p: { name: string; profile: any; isCurrent: boolean }) => ({
      name: p.name,
      isActive: p.isCurrent,
      hasCredentials: !!p.profile?.signing_key,
    }));
    
    setProfiles(profileList);
    
    // Set selected to active profile
    const activeIdx = profileList.findIndex(p => p.isActive);
    if (activeIdx >= 0) setSelectedIndex(activeIdx);
  }, []);

  // Keyboard navigation - ONLY when content is focused
  useInput((input, key) => {
    // Skip if content area is not focused
    if (!isContentFocused) return;
    
    if (key.upArrow && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1);
    }
    if (key.downArrow && selectedIndex < profiles.length - 1) {
      setSelectedIndex(selectedIndex + 1);
    }
    
    // Enter could switch profile in the future
    if (key.return && profiles.length > 0) {
      // Future: Switch to selected profile
    }
  });

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <ViewHeader title="SETTINGS" isContentFocused={isContentFocused} />
      </Box>

      {/* Connection Settings */}
      <Box flexDirection="column" marginBottom={1}>
        <Text color={colors.textMuted} dimColor>CONNECTION_</Text>
        <Box marginLeft={2} flexDirection="column">
          <KeyValue
            items={[
              { label: 'API URL', value: config?.API_URL || 'N/A' },
              { label: 'WS URL', value: config?.WS_URL || 'N/A' },
              { label: 'DB Host', value: config?.DB_HOST || 'N/A' },
            ]}
            labelWidth={12}
          />
        </Box>
      </Box>

      {/* Profile Settings */}
      <Box flexDirection="column" marginBottom={1}>
        <Text color={colors.textMuted} dimColor>PROFILES_</Text>
        <Box marginLeft={2} flexDirection="column" marginTop={1}>
          {profiles.length === 0 ? (
            <Text color={colors.textDim}>No profiles configured</Text>
          ) : (
            profiles.map((profile, index) => (
              <Box key={profile.name} marginBottom={1}>
                <Text color={isContentFocused && index === selectedIndex ? colors.accent : colors.text}>
                  {isContentFocused && index === selectedIndex ? '▶ ' : '  '}
                  {profile.name}
                </Text>
                {profile.isActive && (
                  <Text color={colors.success}> (active)</Text>
                )}
                <Text color={colors.textMuted}> │ </Text>
                <StatusBadge
                  status={profile.hasCredentials ? 'success' : 'warning'}
                  label={profile.hasCredentials ? 'Configured' : 'No credentials'}
                  showDot
                />
              </Box>
            ))
          )}
        </Box>
      </Box>

      {/* Environment */}
      <Box flexDirection="column" marginBottom={1}>
        <Text color={colors.textMuted} dimColor>ENVIRONMENT_</Text>
        <Box marginLeft={2} flexDirection="column">
          <KeyValue
            items={[
              { label: 'NODE_ENV', value: process.env.NODE_ENV || 'development' },
              { label: 'LOG_LEVEL', value: process.env.LOG_LEVEL || 'info' },
            ]}
            labelWidth={12}
          />
        </Box>
      </Box>

      {/* Help */}
      <Box marginTop={1} borderStyle="single" borderColor={colors.surface} padding={1}>
        <Box flexDirection="column">
          <Text color={colors.textMuted}>Quick Commands:</Text>
          <Box marginTop={1} flexDirection="column">
            <Text color={colors.textDim}>
              <Text color={colors.accent}>grid profile use &lt;name&gt;</Text> - Switch profile
            </Text>
            <Text color={colors.textDim}>
              <Text color={colors.accent}>grid auth login</Text> - Configure credentials
            </Text>
            <Text color={colors.textDim}>
              <Text color={colors.accent}>grid profile set</Text> - Create new profile
            </Text>
          </Box>
        </Box>
      </Box>
      
      {/* Focus hint */}
      {isContentFocused && profiles.length > 0 && (
        <Box marginTop={1}>
          <Text color={colors.textDim} dimColor>
            [↑↓] navigate profiles
          </Text>
        </Box>
      )}
    </Box>
  );
}

/**
 * View header component with focus indicator
 */
function ViewHeader({ title, isContentFocused }: { title: string; isContentFocused: boolean }): React.ReactElement {
  return (
    <Text color={colors.text} bold>
      {isContentFocused && <Text color={colors.primary}>◆ </Text>}
      {title}_
    </Text>
  );
}
