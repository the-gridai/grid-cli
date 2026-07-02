import { Command } from 'commander';
import { ApiClient } from '../../../../sdk/http/client.js';
import { getProfile, setProfile } from '../../../../core/config/profiles.js';
import { resolveInstrumentId } from '../../supply/utils.js';
import {
  buildUpdatedProfile,
  maxAvailableBalance,
  parsePositiveNumber,
} from './activity-simulator-helpers.js';

interface ActivitySimulatorSetupOptions {
  makerProfile: string;
  takerProfile: string;
  supplierProfile: string;
  apiUrl?: string;
  wsUrl?: string;
  makerSigningKey?: string;
  makerFingerprint?: string;
  takerSigningKey?: string;
  takerFingerprint?: string;
  fundInstrument?: string;
  fundQuantity?: string;
  minAvailableBalance: string;
}

interface SetupReport {
  warnings: string[];
  actions: string[];
}

async function setupActivitySimulator(options: ActivitySimulatorSetupOptions): Promise<SetupReport> {
  const warnings: string[] = [];
  const actions: string[] = [];

  const minAvailableBalance = parsePositiveNumber(options.minAvailableBalance, 'min-available-balance');
  const fundQuantity = options.fundQuantity ? parsePositiveNumber(options.fundQuantity, 'fund-qty') : undefined;

  const makerExisting = getProfile(options.makerProfile);
  const takerExisting = getProfile(options.takerProfile);

  const makerProfile = buildUpdatedProfile(makerExisting, {
    apiUrl: options.apiUrl,
    wsUrl: options.wsUrl,
    signingKey: options.makerSigningKey,
    fingerprint: options.makerFingerprint,
    roleLabel: 'maker',
  });
  const takerProfile = buildUpdatedProfile(takerExisting, {
    apiUrl: options.apiUrl,
    wsUrl: options.wsUrl,
    signingKey: options.takerSigningKey,
    fingerprint: options.takerFingerprint,
    roleLabel: 'taker',
  });

  setProfile(options.makerProfile, makerProfile);
  setProfile(options.takerProfile, takerProfile);
  actions.push(`Updated profiles: ${options.makerProfile}, ${options.takerProfile}`);

  const makerClient = ApiClient.getInstanceForProfile(options.makerProfile);
  const takerClient = ApiClient.getInstanceForProfile(options.takerProfile);

  await makerClient.getMarkets();
  actions.push(`Verified API connectivity using profile: ${options.makerProfile}`);

  let makerAccounts = await makerClient.getTradingAccounts();
  let takerAccounts = await takerClient.getTradingAccounts();
  actions.push('Verified both profiles can access trading accounts');

  if (options.fundInstrument && fundQuantity) {
    const supplierClient = ApiClient.getInstanceForProfile(options.supplierProfile);
    const resolved = await resolveInstrumentId(supplierClient, options.fundInstrument);

    await supplierClient.issueSupply(resolved.id, fundQuantity);
    await makerClient.transferToTradingAccount(resolved.id, undefined, fundQuantity);
    await takerClient.transferToTradingAccount(resolved.id, undefined, fundQuantity);
    actions.push(
      `Issued and transferred ${fundQuantity} ${resolved.symbol} to maker+taker trading accounts`
    );

    makerAccounts = await makerClient.getTradingAccounts();
    takerAccounts = await takerClient.getTradingAccounts();
  }

  const makerMaxBalance = maxAvailableBalance(makerAccounts);
  const takerMaxBalance = maxAvailableBalance(takerAccounts);

  if (makerMaxBalance < minAvailableBalance) {
    warnings.push(
      `Maker profile "${options.makerProfile}" max available balance (${makerMaxBalance}) is below threshold (${minAvailableBalance}).`
    );
  }
  if (takerMaxBalance < minAvailableBalance) {
    warnings.push(
      `Taker profile "${options.takerProfile}" max available balance (${takerMaxBalance}) is below threshold (${minAvailableBalance}).`
    );
  }

  return { warnings, actions };
}

export const setupActivitySimulatorCommand = new Command('activity-simulator')
  .description('Bootstrap local prerequisites for the noisy dual-account activity simulator')
  .option('--maker-profile <name>', 'Maker profile name', 'marketmaker')
  .option('--taker-profile <name>', 'Taker profile name', 'activity-taker')
  .option('--supplier-profile <name>', 'Supplier profile used for optional funding', 'supplier')
  .option('--api-url <url>', 'API URL for both profiles')
  .option('--ws-url <url>', 'WebSocket URL for both profiles')
  .option('--maker-signing-key <base64>', 'Maker profile signing key')
  .option('--maker-fingerprint <fingerprint>', 'Maker profile signing key fingerprint')
  .option('--taker-signing-key <base64>', 'Taker profile signing key')
  .option('--taker-fingerprint <fingerprint>', 'Taker profile signing key fingerprint')
  .option('--fund-instrument <instrument>', 'Optional instrument ID or symbol to issue+transfer')
  .option('--fund-qty <qty>', 'Optional quantity to issue+transfer to each profile')
  .option('--min-available-balance <amount>', 'Warn when max available balance is below this', '1')
  .action(async (options: ActivitySimulatorSetupOptions) => {
    const report = await setupActivitySimulator(options);

    console.log('\nActivity simulator setup complete');
    for (const action of report.actions) {
      console.log(`  - ${action}`);
    }

    if (report.warnings.length > 0) {
      console.log('\nWarnings:');
      for (const warning of report.warnings) {
        console.log(`  - ${warning}`);
      }
    }

    console.log('\nNext step:');
    console.log('  grid strategy start activity-simulator');
  });

export { setupActivitySimulator };
