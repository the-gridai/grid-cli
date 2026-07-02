import React from 'react';
import { Command } from 'commander';
import { render } from 'ink';
import { Box, Text } from 'ink';
import { createSignedHeaders } from '../../../core/auth/control-api-auth';
import { Header, Divider, KeyValue } from '../../ui/components';
import { ActionFeedbackView } from '../../ui/views';
import { colors } from '../../ui/theme';
import { parseValue } from '../../../core/config/deep-merge';

/**
 * Make a request to the control API
 */
async function makeControlApiRequest(
  method: string,
  path: string,
  host: string,
  port: number,
  body?: unknown,
  profile?: string
): Promise<{ status: number; data: unknown }> {
  const url = `http://${host}:${port}${path}`;
  const bodyStr = body ? JSON.stringify(body) : '';

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Add auth headers for mutating requests
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const authHeaders = createSignedHeaders(method, path, bodyStr, profile);
    Object.assign(headers, authHeaders);
  }

  const response = await fetch(url, {
    method,
    headers,
    body: bodyStr || undefined,
  });

  const data = await response.json().catch(() => ({}));
  return { status: response.status, data };
}

/**
 * Config Get View
 */
interface ConfigGetViewProps {
  config: Record<string, unknown>;
  strategyId?: string;
  format: 'json' | 'pretty';
}

function ConfigGetView({ config, strategyId, format }: ConfigGetViewProps): React.ReactElement {
  if (format === 'json') {
    return (
      <Box flexDirection="column">
        <Text>{JSON.stringify(config, null, 2)}</Text>
      </Box>
    );
  }

  const flattenConfig = (obj: Record<string, unknown>, prefix = ''): Array<{ label: string; value: string }> => {
    const items: Array<{ label: string; value: string }> = [];

    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      if (value && typeof value === 'object' && !Array.isArray(value)) {
        items.push(...flattenConfig(value as Record<string, unknown>, fullKey));
      } else if (Array.isArray(value)) {
        items.push({
          label: fullKey,
          value: `[${value.length} items]`,
        });
      } else {
        items.push({
          label: fullKey,
          value: String(value),
        });
      }
    }

    return items;
  };

  const items = flattenConfig(config as Record<string, unknown>);

  return (
    <Box flexDirection="column" paddingY={1}>
      <Header
        title={strategyId ? `CONFIG: ${strategyId.toUpperCase()}` : 'CURRENT CONFIG'}
        showSeparator
        width={60}
      />

      <Box flexDirection="column" paddingX={2} marginTop={1}>
        <KeyValue items={items} labelWidth={35} />
      </Box>

      <Box marginTop={1}>
        <Divider width={60} />
      </Box>
    </Box>
  );
}

/**
 * Get command - fetch current config
 */
export const configGetCommand = new Command('get')
  .description('Get current running configuration')
  .option('-H, --host <host>', 'Control API host', 'localhost')
  .option('-P, --port <port>', 'Control API port', '8081')
  .option('-s, --strategy <id>', 'Strategy ID (for daemon mode)')
  .option('--json', 'Output as JSON')
  .option('--profile <name>', 'Credential profile to use')
  .action(async (options) => {
    const host = options.host;
    const port = parseInt(options.port, 10);
    const strategyId = options.strategy;
    const format = options.json ? 'json' : 'pretty';

    try {
      const path = strategyId ? `/config/${strategyId}` : '/config';
      const { status, data } = await makeControlApiRequest('GET', path, host, port, undefined, options.profile);

      if (status !== 200) {
        const errorMsg = (data as any)?.error || `Request failed with status ${status}`;
        const { waitUntilExit } = render(
          <ActionFeedbackView
            title="Config Error"
            status="error"
            error={errorMsg}
          />
        );
        await waitUntilExit();
        process.exit(1);
      }

      const config = strategyId ? (data as any).config : (data as any).config || data;

      const { waitUntilExit } = render(
        <ConfigGetView config={config} strategyId={strategyId} format={format} />
      );
      await waitUntilExit();

    } catch (err: any) {
      const { waitUntilExit } = render(
        <ActionFeedbackView
          title="Connection Error"
          status="error"
          error={err.message}
          message={`Make sure the control API is running on ${host}:${port}`}
        />
      );
      await waitUntilExit();
      process.exit(1);
    }
  });

/**
 * Set command - set a single config value
 */
export const configSetCommand = new Command('set')
  .description('Set a single configuration value')
  .argument('<path>', 'Config path (e.g., global.refreshIntervalMs)')
  .argument('<value>', 'Value to set')
  .option('-H, --host <host>', 'Control API host', 'localhost')
  .option('-P, --port <port>', 'Control API port', '8081')
  .option('-s, --strategy <id>', 'Strategy ID (for daemon mode)')
  .option('--profile <name>', 'Credential profile to use')
  .action(async (configPath, valueStr, options) => {
    const host = options.host;
    const port = parseInt(options.port, 10);
    const strategyId = options.strategy;

    // Parse the value
    const value = parseValue(valueStr);

    // Build nested object from path
    const parts = configPath.split('.');
    let update: Record<string, unknown> = {};
    let current = update;

    for (let i = 0; i < parts.length - 1; i++) {
      current[parts[i]] = {};
      current = current[parts[i]] as Record<string, unknown>;
    }
    current[parts[parts.length - 1]] = value;

    try {
      const path = strategyId ? `/config/${strategyId}` : '/config';
      const { status, data } = await makeControlApiRequest('PATCH', path, host, port, update, options.profile);

      if (status !== 200) {
        const errorData = data as any;
        let errorMsg = errorData?.error || `Request failed with status ${status}`;

        if (errorData?.validationErrors) {
          errorMsg += '\n\nValidation errors:\n' +
            errorData.validationErrors.map((e: any) => `  - ${e.path.join('.')}: ${e.message}`).join('\n');
        }

        const { waitUntilExit } = render(
          <ActionFeedbackView
            title="Config Update Failed"
            status="error"
            error={errorMsg}
          />
        );
        await waitUntilExit();
        process.exit(1);
      }

      const { waitUntilExit } = render(
        <ActionFeedbackView
          title="Config Updated"
          status="success"
          details={[
            { label: 'Path', value: configPath },
            { label: 'Value', value: String(value) },
          ]}
        />
      );
      await waitUntilExit();

    } catch (err: any) {
      const { waitUntilExit } = render(
        <ActionFeedbackView
          title="Connection Error"
          status="error"
          error={err.message}
        />
      );
      await waitUntilExit();
      process.exit(1);
    }
  });

/**
 * Patch command - apply partial JSON update
 */
export const configPatchCommand = new Command('patch')
  .description('Apply a partial JSON configuration update')
  .argument('<json>', 'JSON object to merge with current config')
  .option('-H, --host <host>', 'Control API host', 'localhost')
  .option('-P, --port <port>', 'Control API port', '8081')
  .option('-s, --strategy <id>', 'Strategy ID (for daemon mode)')
  .option('--profile <name>', 'Credential profile to use')
  .action(async (jsonStr, options) => {
    const host = options.host;
    const port = parseInt(options.port, 10);
    const strategyId = options.strategy;

    let update: Record<string, unknown>;
    try {
      update = JSON.parse(jsonStr);
    } catch {
      const { waitUntilExit } = render(
        <ActionFeedbackView
          title="Invalid JSON"
          status="error"
          error="The provided JSON is not valid"
        />
      );
      await waitUntilExit();
      process.exit(1);
    }

    try {
      const path = strategyId ? `/config/${strategyId}` : '/config';
      const { status, data } = await makeControlApiRequest('PATCH', path, host, port, update, options.profile);

      if (status !== 200) {
        const errorData = data as any;
        let errorMsg = errorData?.error || `Request failed with status ${status}`;

        if (errorData?.validationErrors) {
          errorMsg += '\n\nValidation errors:\n' +
            errorData.validationErrors.map((e: any) => `  - ${e.path.join('.')}: ${e.message}`).join('\n');
        }

        const { waitUntilExit } = render(
          <ActionFeedbackView
            title="Config Update Failed"
            status="error"
            error={errorMsg}
          />
        );
        await waitUntilExit();
        process.exit(1);
      }

      const { waitUntilExit } = render(
        <ActionFeedbackView
          title="Config Updated"
          status="success"
          message="Configuration patch applied successfully"
        />
      );
      await waitUntilExit();

    } catch (err: any) {
      const { waitUntilExit } = render(
        <ActionFeedbackView
          title="Connection Error"
          status="error"
          error={err.message}
        />
      );
      await waitUntilExit();
      process.exit(1);
    }
  });

/**
 * Reload command - reload config from file
 */
export const configReloadCommand = new Command('reload')
  .description('Reload configuration from the original config file')
  .option('-H, --host <host>', 'Control API host', 'localhost')
  .option('-P, --port <port>', 'Control API port', '8081')
  .option('-s, --strategy <id>', 'Strategy ID (for daemon mode)')
  .option('--profile <name>', 'Credential profile to use')
  .action(async (options) => {
    const host = options.host;
    const port = parseInt(options.port, 10);
    const strategyId = options.strategy;

    // Note: This requires a special endpoint - for now show not implemented
    console.log('Config reload from file is not yet implemented in the control API.');
    console.log('Workaround: Use PUT /config with the full config JSON');
    process.exit(0);
  });

/**
 * Main config command group
 */
export const configCommand = new Command('config')
  .description('Manage strategy configuration at runtime')
  .addCommand(configGetCommand)
  .addCommand(configSetCommand)
  .addCommand(configPatchCommand)
  .addCommand(configReloadCommand);
