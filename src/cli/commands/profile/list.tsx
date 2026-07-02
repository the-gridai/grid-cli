import React from 'react';
import { Command } from 'commander';
import { render } from 'ink';
import { listProfiles, getCredentialsPath, getActiveProfileName } from '../../../core/config/profiles';
import { ProfileListView, ProfileInfo } from '../../ui/views';

export const profileListCommand = new Command('list')
  .alias('ls')
  .description('List all available profiles')
  .action(async () => {
    const rawProfiles = listProfiles();
    const activeProfile = getActiveProfileName();
    const credentialsPath = getCredentialsPath();
    
    const profiles: ProfileInfo[] = rawProfiles.map(({ name, profile, isCurrent }) => ({
      name,
      description: profile.description,
      apiUrl: profile.api_url,
      hasCredentials: !!(profile.signing_key || profile.api_key),
      isCurrent,
      isActive: name === activeProfile,
    }));

    const { waitUntilExit } = render(
      <ProfileListView
        profiles={profiles}
        activeProfile={activeProfile ?? undefined}
        credentialsPath={credentialsPath}
      />
    );
    
    await waitUntilExit();
  });
