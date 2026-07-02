import React from 'react';
import { Box, Text } from 'ink';
import { Header, Table, KeyValue } from '../components';
import { colors, tagline } from '../theme';

export interface ProfileInfo {
  name: string;
  description?: string;
  apiUrl?: string;
  hasCredentials: boolean;
  isCurrent: boolean;
  isActive: boolean;
}

export interface ProfileListViewProps {
  profiles: ProfileInfo[];
  activeProfile?: string;
  credentialsPath: string;
}

/**
 * Profile list view - displays available profiles in Grid style
 */
export function ProfileListView({
  profiles,
  activeProfile,
  credentialsPath,
}: ProfileListViewProps): React.ReactElement {
  if (profiles.length === 0) {
    return (
      <Box flexDirection="column" paddingY={1}>
        <Header title="PROFILES" showSeparator width={65} />
        <Box flexDirection="column" paddingX={2} marginTop={1}>
          <Text color={colors.warning}>No profiles configured.</Text>
          <Box marginTop={1}>
            <Text color={colors.textMuted}>To create a profile:</Text>
          </Box>
          <Box paddingLeft={2}>
            <Text color={colors.textDim}>
              grid profile set {'<name>'} --api-url {'<url>'} --signing-key {'<key>'} --fingerprint {'<fp>'}
            </Text>
          </Box>
          <Box marginTop={1}>
            <KeyValue
              items={[
                { label: 'Credentials file', value: credentialsPath, valueColor: colors.textDim },
              ]}
              labelWidth={18}
            />
          </Box>
        </Box>
      </Box>
    );
  }

  const tableData = profiles.map(p => ({
    active: p.isActive ? '▶' : ' ',
    name: p.name + (p.isCurrent ? ' (current)' : ''),
    description: p.description || '-',
    apiUrl: truncate(p.apiUrl || '-', 35),
    credentials: p.hasCredentials ? '✓' : '✗',
  }));

  return (
    <Box flexDirection="column" paddingY={1}>
      <Table
        title="PROFILES"
        data={tableData}
        columns={[
          { header: '', accessor: 'active', width: 3, color: colors.success },
          { header: 'PROFILE', accessor: 'name', width: 20 },
          { header: 'DESCRIPTION', accessor: 'description', width: 20, color: colors.textMuted },
          { header: 'API URL', accessor: 'apiUrl', width: 35, color: colors.textDim },
          { 
            header: 'CREDS', 
            accessor: 'credentials', 
            width: 6,
            color: (v) => v === '✓' ? colors.success : colors.error,
          },
        ]}
      />
      
      <Box paddingX={2} marginTop={1}>
        <KeyValue
          items={[
            ...(activeProfile ? [{ label: 'Active profile', value: activeProfile, valueColor: colors.success }] : []),
            { label: 'Credentials file', value: credentialsPath, valueColor: colors.textDim },
          ]}
          labelWidth={18}
        />
      </Box>

      <Box paddingX={2} marginTop={1}>
        <Text color={colors.textDim}>
          Use: grid --profile {'<name>'} {'<command>'} | GRID_PROFILE={'<name>'} grid {'<command>'}
        </Text>
      </Box>
    </Box>
  );
}

function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}

export default ProfileListView;
