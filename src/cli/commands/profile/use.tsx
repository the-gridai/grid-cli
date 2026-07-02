import React from 'react';
import { Command } from 'commander';
import { render } from 'ink';
import { setCurrentProfile, profileExists } from '../../../core/config/profiles';
import { ActionFeedbackView } from '../../ui/views';

export const profileUseCommand = new Command('use')
  .description('Switch to a profile (sets it as the current active profile)')
  .argument('<name>', 'Profile name to switch to')
  .action(async (name: string) => {
    if (!profileExists(name)) {
      const { waitUntilExit } = render(
        <ActionFeedbackView
          title="Profile Not Found"
          status="error"
          error={`Profile '${name}' does not exist.`}
          message="Run: grid profile list"
        />
      );
      await waitUntilExit();
      process.exit(1);
    }
    
    try {
      setCurrentProfile(name);
      
      const { waitUntilExit } = render(
        <ActionFeedbackView
          title="Switched Profile"
          status="success"
          details={[
            { label: 'Current profile', value: name },
          ]}
          message="All subsequent commands will use this profile.\nUse --profile <name> to temporarily use a different profile."
        />
      );
      await waitUntilExit();
      
    } catch (error) {
      const { waitUntilExit } = render(
        <ActionFeedbackView
          title="Switch Profile Failed"
          status="error"
          error={error instanceof Error ? error.message : String(error)}
        />
      );
      await waitUntilExit();
      process.exit(1);
    }
  });
