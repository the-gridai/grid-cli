import React, { useState, useEffect } from 'react';
import { Command } from 'commander';
import { render } from 'ink';
import { Box, Text } from 'ink';
import path from 'path';
import fs from 'fs';
import { Header, Spinner, StatusBadge, KeyValue, Divider } from '../../ui/components';
import { ActionFeedbackView } from '../../ui/views';
import { colors, tagline } from '../../ui/theme';

interface StrategyStartViewProps {
  strategyName: string;
  strategyPath: string;
  configPath?: string;
  config: Record<string, any>;
}

function StrategyStartView({ strategyName, strategyPath, configPath, config }: StrategyStartViewProps): React.ReactElement {
  const [status, setStatus] = useState<'loading' | 'running' | 'error'>('loading');
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    async function runStrategy() {
      try {
        // Set env vars for strategy
        if (config.marketId) process.env.MARKET_ID = config.marketId;
        if (config.spreadPercentage) process.env.SPREAD_PERCENTAGE = config.spreadPercentage.toString();
        if (config.orderSize) process.env.ORDER_SIZE = config.orderSize.toString();
        if (config.refreshIntervalMs) process.env.REFRESH_INTERVAL_MS = config.refreshIntervalMs.toString();
        if (configPath) process.env.CONFIG_PATH = configPath;

        const strategyModule = await import(strategyPath);

        if (typeof strategyModule.run !== 'function') {
          setError('Strategy does not export a run() function');
          setStatus('error');
          return;
        }

        setStatus('running');
        await strategyModule.run();

      } catch (err: any) {
        setError(err.message);
        setStatus('error');
      }
    }

    runStrategy();
  }, [strategyPath, config]);

  if (status === 'error') {
    return (
      <ActionFeedbackView
        title="Strategy Failed"
        status="error"
        error={error}
        message="Run: grid strategy list"
      />
    );
  }

  const configItems = Object.entries(config)
    .filter(([_, v]) => v !== undefined)
    .map(([k, v]) => ({
      label: k,
      value: typeof v === 'object' ? JSON.stringify(v) : String(v),
    }));

  return (
    <Box flexDirection="column" paddingY={1}>
      <Header title="STRATEGY RUNNER" showSeparator width={60} />

      <Box flexDirection="column" paddingX={2} marginTop={1}>
        <KeyValue
          labelWidth={18}
          items={[
            { label: 'Strategy', value: strategyName, valueColor: colors.accent },
            { label: 'Path', value: strategyPath, valueColor: colors.textDim },
            ...(configPath ? [{ label: 'Config', value: configPath, valueColor: colors.textDim }] : []),
          ]}
        />
      </Box>

      {configItems.length > 0 && (
        <Box flexDirection="column" paddingX={2} marginTop={1}>
          <Text color={colors.textMuted}>Configuration_</Text>
          <Box paddingLeft={2} marginTop={1}>
            <KeyValue items={configItems} labelWidth={18} />
          </Box>
        </Box>
      )}

      <Box marginTop={1}>
        <Divider width={60} />
      </Box>

      <Box paddingX={2} marginTop={1}>
        {status === 'loading' ? (
          <Spinner label="Loading strategy..." type="grid" />
        ) : (
          <StatusBadge status="success" label="Strategy Running" showDot withUnderscore />
        )}
      </Box>

      <Box paddingX={2} marginTop={1}>
        <Text color={colors.textDim}>{tagline}</Text>
      </Box>
    </Box>
  );
}

/**
 * Resolve strategy name to file path
 * Search order:
 * 1. Exact path (if contains / or .ts)
 * 2. strategies/<name>/index.ts (module-style strategies)
 * 3. strategies/examples/<name>.ts (example strategies)
 * 4. strategies/dev-bots/<name>.ts (legacy development bots)
 */
function resolveStrategyPath(strategyName: string): { strategyPath: string; configPath: string } | null {
  // If it's an explicit path, use it directly
  if (strategyName.endsWith('.ts') || strategyName.includes('/') || strategyName.includes('\\')) {
    const strategyPath = path.resolve(strategyName);
    const strategyDir = path.dirname(strategyPath);
    const strategyBaseName = path.basename(strategyPath, '.ts');
    const configPath = path.join(strategyDir, `${strategyBaseName}.config.json`);
    return { strategyPath, configPath };
  }

  const strategiesDir = path.resolve(process.cwd(), 'strategies');

  // Try module-style strategy (e.g., strategies/my-strategy/index.ts)
  const modulePath = path.join(strategiesDir, strategyName, 'index.ts');
  if (fs.existsSync(modulePath)) {
    const configPath = path.join(strategiesDir, strategyName, `${strategyName}.config.json`);
    return { strategyPath: modulePath, configPath };
  }

  // Try example strategy (e.g., strategies/examples/simple-market-maker.ts)
  const examplePath = path.join(strategiesDir, 'examples', `${strategyName}.ts`);
  if (fs.existsSync(examplePath)) {
    const configPath = path.join(strategiesDir, 'examples', `${strategyName}.config.json`);
    return { strategyPath: examplePath, configPath };
  }

  // Legacy fallback: flat dev-bots files
  const devBotPath = path.join(strategiesDir, 'dev-bots', `${strategyName}.ts`);
  if (fs.existsSync(devBotPath)) {
    const configPath = path.join(strategiesDir, 'dev-bots', `${strategyName}.config.json`);
    return { strategyPath: devBotPath, configPath };
  }

  return null;
}

export const startStrategyCommand = new Command('start')
  .description('Start a trading strategy')
  .argument('<strategy>', 'Strategy name (e.g., simple-market-maker, multi-market-maker)')
  .option('-c, --config <path>', 'Path to strategy config file (JSON)')
  .option('--market <marketId>', 'Market ID to trade (overrides config)')
  .option('--spread <percentage>', 'Spread percentage (overrides config)')
  .option('--size <amount>', 'Order size (overrides config)')
  .option('--interval <ms>', 'Refresh interval in ms (overrides config, default: 3000)')
  .option('--control-port <port>', 'Enable control API on specified port for dynamic config updates')
  .action(async (strategyName: string, options) => {
    // Resolve strategy path
    const resolved = resolveStrategyPath(strategyName);

    let strategyPath: string;
    let defaultConfigPath: string;

    if (resolved) {
      strategyPath = resolved.strategyPath;
      defaultConfigPath = resolved.configPath;
    } else {
      // Fallback for backward compat - will fail with proper error below
      strategyPath = path.resolve(process.cwd(), `strategies/examples/${strategyName}.ts`);
      defaultConfigPath = path.resolve(process.cwd(), `strategies/examples/${strategyName}.config.json`);
    }

    // If a TypeScript strategy was provided, try to use the compiled output
    if (strategyPath.endsWith('.ts')) {
      const relative = path.relative(process.cwd(), strategyPath);
      const compiledCandidate = path.resolve(process.cwd(), 'dist', relative).replace(/\.ts$/, '.js');
      if (fs.existsSync(compiledCandidate)) {
        strategyPath = compiledCandidate;
      }
    }

    // Check if strategy exists
    if (!fs.existsSync(strategyPath)) {
      const { waitUntilExit } = render(
        <ActionFeedbackView
          title="Strategy Not Found"
          status="error"
          error={`Strategy file not found: ${strategyPath}`}
          details={[
            { label: 'Built-in', value: 'grid strategy start simple-market-maker' },
            { label: 'External', value: 'grid strategy start /path/to/strategy.ts' },
          ]}
          message="Run: grid strategy list"
        />
      );
      await waitUntilExit();
      process.exit(1);
    }

    // Load config
    let config: Record<string, any> = {};
    const configPath = options.config || defaultConfigPath;

    if (fs.existsSync(configPath)) {
      try {
        const configContent = fs.readFileSync(configPath, 'utf8');
        config = JSON.parse(configContent);
      } catch (err: any) {
        const { waitUntilExit } = render(
          <ActionFeedbackView
            title="Config Error"
            status="error"
            error={`Failed to parse config: ${err.message}`}
          />
        );
        await waitUntilExit();
        process.exit(1);
      }
    } else if (options.config) {
      const { waitUntilExit } = render(
        <ActionFeedbackView
          title="Config Not Found"
          status="error"
          error={`Config file not found: ${options.config}`}
        />
      );
      await waitUntilExit();
      process.exit(1);
    }

    // CLI options override config
    if (options.market) config.marketId = options.market;
    if (options.spread) config.spreadPercentage = parseFloat(options.spread);
    if (options.size) config.orderSize = parseInt(options.size);
    if (options.interval) config.refreshIntervalMs = parseInt(options.interval);

    // Set control port environment variable for strategies that support it
    if (options.controlPort) {
      process.env.CONTROL_PORT = options.controlPort;
    }

    const { waitUntilExit } = render(
      <StrategyStartView
        strategyName={strategyName}
        strategyPath={strategyPath}
        configPath={fs.existsSync(configPath) ? configPath : undefined}
        config={config}
      />
    );

    await waitUntilExit();
  });
