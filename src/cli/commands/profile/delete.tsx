import React from 'react';
import { Command } from 'commander';
import { render } from 'ink';
import { Box, Text } from 'ink';
import { deleteProfile, profileExists } from '../../../core/config/profiles';
import { ActionFeedbackView } from '../../ui/views';
import { Header, Divider } from '../../ui/components';
import { colors } from '../../ui/theme';

interface ConfirmDeleteViewProps {
  profileName: string;
}

function ConfirmDeleteView({ profileName }: ConfirmDeleteViewProps): React.ReactElement {
  return (
    <Box flexDirection="column" paddingY={1}>
      <Header title="DELETE PROFILE" showSeparator width={50} />
      <Box paddingX={2} marginTop={1}>
        <Text color={colors.warning}>⚠ Are you sure you want to delete profile '{profileName}'?</Text>
      </Box>
      <Box paddingX={2} marginTop={1}>
        <Text color={colors.textMuted}>Run with --force to skip this confirmation.</Text>
      </Box>
      <Box marginTop={1}>
        <Divider width={50} />
      </Box>
      <Box paddingX={2}>
        <Text color={colors.text}>To confirm: </Text>
        <Text color={colors.accent}>grid profile delete {profileName} --force</Text>
      </Box>
    </Box>
  );
}

export const profileDeleteCommand = new Command('delete')
  .alias('rm')
  .description('Delete a profile')
  .argument('<name>', 'Profile name to delete')
  .option('-f, --force', 'Skip confirmation')
  .action(async (name: string, options: { force?: boolean }) => {
    if (!profileExists(name)) {
      const { waitUntilExit } = render(
        <ActionFeedbackView
          title="Profile Not Found"
          status="error"
          error={`Profile '${name}' does not exist.`}
        />
      );
      await waitUntilExit();
      process.exit(1);
    }
    
    if (!options.force) {
      const { waitUntilExit } = render(<ConfirmDeleteView profileName={name} />);
      await waitUntilExit();
      return;
    }
    
    const deleted = deleteProfile(name);
    
    if (deleted) {
      const { waitUntilExit } = render(
        <ActionFeedbackView
          title="Profile Deleted"
          status="success"
          details={[
            { label: 'Profile', value: name },
          ]}
        />
      );
      await waitUntilExit();
    } else {
      const { waitUntilExit } = render(
        <ActionFeedbackView
          title="Delete Failed"
          status="error"
          error={`Failed to delete profile '${name}'`}
        />
      );
      await waitUntilExit();
      process.exit(1);
    }
  });
