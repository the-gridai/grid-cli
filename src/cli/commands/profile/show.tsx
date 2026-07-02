import React from 'react';
import { Command } from 'commander';
import { render } from 'ink';
import { getProfile, getActiveProfileName, getCredentialsPath } from '../../../core/config/profiles';
import { ProfileDetailView, ProfileDetailData } from '../../ui/views';

export const profileShowCommand = new Command('show')
  .description('Show details of a profile')
  .argument('[name]', 'Profile name (defaults to active profile)')
  .option('--show-secrets', 'Show secret values (signing key)')
  .action(async (name: string | undefined, options: { showSecrets?: boolean }) => {
    const profileName = name || getActiveProfileName() || '';
    const credentialsPath = getCredentialsPath();
    
    if (!profileName) {
      const { waitUntilExit } = render(
        <ProfileDetailView
          profile={null}
          profileName=""
          credentialsPath={credentialsPath}
          error="No profile specified and no active profile found."
        />
      );
      await waitUntilExit();
      return;
    }
    
    const rawProfile = getProfile(profileName);
    
    const profile: ProfileDetailData | null = rawProfile ? {
      name: profileName,
      description: rawProfile.description,
      apiUrl: rawProfile.api_url,
      consumptionApiUrl: rawProfile.consumption_api_url,
      wsUrl: rawProfile.ws_url,
      signingKey: rawProfile.signing_key,
      fingerprint: rawProfile.signing_key_fingerprint || rawProfile.api_key_fingerprint,
      apiKey: rawProfile.api_key,
      consumption: rawProfile.consumption ? {
        defaultSpec: rawProfile.consumption.default_spec,
        defaultInstructions: rawProfile.consumption.default_instructions,
        autoFund: rawProfile.consumption.auto_fund,
        autoFundAmount: rawProfile.consumption.auto_fund_amount,
        defaultTemperature: rawProfile.consumption.default_temperature,
        defaultMaxTokens: rawProfile.consumption.default_max_tokens,
      } : undefined,
    } : null;

    const { waitUntilExit } = render(
      <ProfileDetailView
        profile={profile}
        profileName={profileName}
        showSecrets={options.showSecrets}
        credentialsPath={credentialsPath}
        error={profile ? undefined : `Profile '${profileName}' not found.`}
      />
    );
    
    await waitUntilExit();
  });
