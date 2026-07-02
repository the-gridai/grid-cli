import React from 'react';
import { Command } from 'commander';
import { render } from 'ink';
import { setProfile, getProfile, profileExists, setCurrentProfile, type Profile } from '../../../core/config/profiles';
import { ActionFeedbackView } from '../../ui/views';

export const profileSetCommand = new Command('set')
  .description('Create or update a profile')
  .argument('<name>', 'Profile name')
  .option('--api-url <url>', 'API base URL')
  .option('--ws-url <url>', 'WebSocket URL')
  .option('--consumption-api-url <url>', 'Consumption API URL for inference')
  .option('--signing-key <key>', 'Ed25519 signing key (base64)')
  .option('--fingerprint <fingerprint>', 'Signing key fingerprint')
  .option('--api-key <key>', 'API key for bearer auth')
  .option('--description <desc>', 'Profile description')
  .option('--default-spec <spec>', 'Default inference spec (e.g., fast-inference)')
  .option('--default-instructions <instructions>', 'Default system instructions for hotwire')
  .option('--auto-fund', 'Auto-transfer from trading when consumption balance is low')
  .option('--no-auto-fund', 'Disable auto-fund')
  .option('--auto-fund-amount <amount>', 'Amount to transfer when auto-funding', parseInt)
  .option('--default-temperature <temp>', 'Default temperature for inference (0-2)', parseFloat)
  .option('--default-max-tokens <tokens>', 'Default max tokens for inference', parseInt)
  .option('--use', 'Switch to this profile after creating/updating')
  .action(async (name: string, options: {
    apiUrl?: string;
    wsUrl?: string;
    consumptionApiUrl?: string;
    signingKey?: string;
    fingerprint?: string;
    apiKey?: string;
    description?: string;
    defaultSpec?: string;
    defaultInstructions?: string;
    autoFund?: boolean;
    autoFundAmount?: number;
    defaultTemperature?: number;
    defaultMaxTokens?: number;
    use?: boolean;
  }) => {
    const isNew = !profileExists(name);
    const existingProfile = getProfile(name) || {};
    const existingConsumption = existingProfile.consumption || {};
    
    // Build consumption config if any consumption options provided
    const hasConsumptionOptions = options.defaultSpec !== undefined ||
      options.defaultInstructions !== undefined ||
      options.autoFund !== undefined ||
      options.autoFundAmount !== undefined ||
      options.defaultTemperature !== undefined ||
      options.defaultMaxTokens !== undefined;
    
    const consumptionConfig = hasConsumptionOptions || existingConsumption ? {
      default_spec: options.defaultSpec ?? existingConsumption.default_spec,
      default_instructions: options.defaultInstructions ?? existingConsumption.default_instructions,
      auto_fund: options.autoFund ?? existingConsumption.auto_fund,
      auto_fund_amount: options.autoFundAmount ?? existingConsumption.auto_fund_amount,
      default_temperature: options.defaultTemperature ?? existingConsumption.default_temperature,
      default_max_tokens: options.defaultMaxTokens ?? existingConsumption.default_max_tokens,
    } : undefined;
    
    // Merge with existing profile (update mode)
    const profile: Profile = {
      description: options.description ?? existingProfile.description,
      api_url: options.apiUrl ?? existingProfile.api_url,
      ws_url: options.wsUrl ?? existingProfile.ws_url,
      consumption_api_url: options.consumptionApiUrl ?? existingProfile.consumption_api_url,
      signing_key: options.signingKey ?? existingProfile.signing_key,
      signing_key_fingerprint: options.fingerprint ?? existingProfile.signing_key_fingerprint,
      api_key: options.apiKey ?? existingProfile.api_key,
      consumption: consumptionConfig,
    };
    
    try {
      setProfile(name, profile);
      
      const details: { label: string; value: string }[] = [];
      
      if (isNew) {
        details.push({ label: 'Action', value: 'Created new profile' });
      } else {
        details.push({ label: 'Action', value: 'Updated existing profile' });
      }
      
      details.push({ label: 'Profile', value: name });
      
      if (profile.api_url) {
        details.push({ label: 'API URL', value: profile.api_url });
      }
      
      if (options.use) {
        setCurrentProfile(name);
        details.push({ label: 'Current', value: 'Yes (switched to this profile)' });
      }
      
      // Warn if incomplete config
      let message: string | undefined;
      if (isNew && !profile.api_url && !profile.signing_key) {
        message = 'Warning: Profile has no API URL or credentials. Update with:\n  grid profile set ' + name + ' --api-url <url> --signing-key <key>';
      } else {
        message = 'Usage: grid profile use ' + name + ' | grid --profile ' + name + ' <command>';
      }

      const { waitUntilExit } = render(
        <ActionFeedbackView
          title={isNew ? 'Profile Created' : 'Profile Updated'}
          status="success"
          details={details}
          message={message}
        />
      );
      
      await waitUntilExit();
      
    } catch (error) {
      const { waitUntilExit } = render(
        <ActionFeedbackView
          title="Profile Save Failed"
          status="error"
          error={error instanceof Error ? error.message : String(error)}
        />
      );
      await waitUntilExit();
      process.exit(1);
    }
  });
