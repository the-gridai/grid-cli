import React, { useState, useEffect } from 'react';
import { Command } from 'commander';
import { render } from 'ink';
import { Box, Text } from 'ink';
import { AutomationEngine } from '../../../core/automation/engine';
import { StateManager } from '../../../core/state/store';
import { logger } from '../../../core/logging/logger';
import { Header, Spinner, StatusBadge, Divider } from '../../ui/components';
import { colors, tagline } from '../../ui/theme';

type DaemonStatus = 'starting' | 'connecting' | 'running' | 'error' | 'shutdown';

interface SystemStartViewProps {
  onReady: () => void;
}

function SystemStartView({ onReady }: SystemStartViewProps): React.ReactElement {
  const [status, setStatus] = useState<DaemonStatus>('starting');
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    async function initialize() {
      const state = StateManager.getInstance();
      
      try {
        setStatus('connecting');
        await state.initSchema();
        
        setStatus('running');
        
        // Start automation engine
        const engine = AutomationEngine.getInstance();
        engine.start();
        
        onReady();
        
      } catch (err: any) {
        logger.error('Failed to start daemon:', { error: err });
        setError(err.message);
        setStatus('error');
      }
    }

    initialize();
  }, [onReady]);

  return (
    <Box flexDirection="column" paddingY={1}>
      <Header title="GRID DAEMON" showSeparator width={50} />
      
      <Box flexDirection="column" paddingX={2} marginTop={1}>
        {status === 'starting' && (
          <Spinner label="Initializing..." type="grid" />
        )}
        
        {status === 'connecting' && (
          <Spinner label="Connecting to PostgreSQL..." type="grid" />
        )}
        
        {status === 'running' && (
          <Box flexDirection="column">
            <StatusBadge status="success" label="Daemon Running" showDot withUnderscore />
            <Box marginTop={1}>
              <Text color={colors.textMuted}>Press Ctrl+C to stop</Text>
            </Box>
          </Box>
        )}
        
        {status === 'error' && (
          <Box flexDirection="column">
            <StatusBadge status="error" label="Startup Failed" showDot />
            <Box marginTop={1}>
              <Text color={colors.error}>{error}</Text>
            </Box>
          </Box>
        )}
      </Box>

      <Box marginTop={1}>
        <Divider width={50} />
      </Box>

      <Box paddingX={2}>
        <Text color={colors.textDim}>{tagline}</Text>
      </Box>
    </Box>
  );
}

export const startCommand = new Command('start')
  .description('Start the GRID automation daemon')
  .action(async () => {
    const state = StateManager.getInstance();
    
    const { waitUntilExit } = render(
      <SystemStartView onReady={() => {
        // Keep process alive
        process.stdin.resume();
      }} />
    );

    // Handle signals
    const shutdown = async () => {
      const engine = AutomationEngine.getInstance();
      engine.stop();
      await state.close();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    
    await waitUntilExit();
  });
