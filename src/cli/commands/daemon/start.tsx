import React from 'react';
import { Command } from 'commander';
import { render } from 'ink';
import { Box, Text } from 'ink';
import { main as startDaemon } from '../../../daemon';
import { Header, KeyValue, Divider, Spinner } from '../../ui/components';
import { colors, tagline } from '../../ui/theme';

interface DaemonStartViewProps {
  strategy: string;
  configPath?: string;
  healthPort: string;
}

function DaemonStartView({ strategy, configPath, healthPort }: DaemonStartViewProps): React.ReactElement {
  return (
    <Box flexDirection="column" paddingY={1}>
      <Header title="DAEMON STARTING" showSeparator width={55} />
      
      <Box flexDirection="column" paddingX={2} marginTop={1}>
        <KeyValue
          labelWidth={16}
          items={[
            { label: 'Strategy', value: strategy, valueColor: colors.accent },
            { label: 'Config Path', value: configPath || '(default)', valueColor: colors.textDim },
            { label: 'Health Port', value: healthPort, valueColor: colors.primary },
          ]}
        />
      </Box>

      <Box marginTop={1}>
        <Divider width={55} />
      </Box>

      <Box paddingX={2} marginTop={1}>
        <Spinner label="Starting daemon..." type="grid" />
      </Box>

      <Box paddingX={2} marginTop={1}>
        <Text color={colors.textDim}>{tagline}</Text>
      </Box>
    </Box>
  );
}

export const daemonStartCommand = new Command('start')
  .description('Start the grid-cli daemon in production mode')
  .option('-s, --strategy <strategy>', 'Deprecated: prefer --config multi-strategy config path')
  .option('-c, --config <path>', 'Path to strategy configuration file')
  .option('-p, --port <port>', 'Health check port', '8080')
  .action(async (options) => {
    // The daemon always reads a multi-strategy config from CONFIG_PATH.
    // Keep --strategy for backward compatibility but do not treat it as a runner selector.
    if (options.strategy && !options.config) {
      console.log(
        '[daemon] --strategy is deprecated and ignored unless you also provide a compatible --config file.'
      );
    }
    if (options.config) {
      process.env.CONFIG_PATH = options.config;
    }
    if (options.port) {
      process.env.HEALTH_PORT = options.port;
    }

    // Show startup view briefly
    const { unmount } = render(
      <DaemonStartView
        strategy={options.strategy || 'multi-strategy'}
        configPath={process.env.CONFIG_PATH}
        healthPort={process.env.HEALTH_PORT || '8080'}
      />
    );

    // Give a moment for the view to render, then start daemon
    await new Promise(resolve => setTimeout(resolve, 500));
    unmount();

    // Start the actual daemon (this takes over)
    await startDaemon();
  });

export const daemonCommand = new Command('daemon')
  .description('Daemon management commands')
  .addCommand(daemonStartCommand);
