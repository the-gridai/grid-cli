import React, { useEffect, useState } from 'react';
import { Command } from 'commander';
import { render, Box, Text } from 'ink';
import { ExchangeClient } from '../../../sdk/exchange/client';
import type { ConsumptionStats } from '../../../sdk/exchange/client';
import { assertOAuthForExchangeKeys } from '../keys/oauth-guard';
import { colors } from '../../ui/theme';
import { Header } from '../../ui/components';
import { resolveDateRange } from './stats-range';

function StatsView({
  from,
  to,
  instrumentId,
  apiKeyId,
  json,
}: {
  from: string;
  to: string;
  instrumentId?: string;
  apiKeyId?: string;
  json?: boolean;
}): React.ReactElement {
  const [stats, setStats] = useState<ConsumptionStats | null>(null);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    (async () => {
      try {
        assertOAuthForExchangeKeys();
        const data = await ExchangeClient.getInstance().getConsumptionStats({
          from,
          to,
          instrumentId,
          apiKeyId,
        });
        if (json) {
          console.log(JSON.stringify(data, null, 2));
        }
        setStats(data);
      } catch (e: any) {
        setError(e.message || String(e));
      }
    })();
  }, [from, to, instrumentId, apiKeyId, json]);

  if (json) {
    return error ? <Text color={colors.error}>{error}</Text> : <Text> </Text>;
  }

  return (
    <Box flexDirection="column" paddingY={1}>
      <Header title="CONSUMPTION USAGE" showSeparator width={72} />
      {error && <Text color={colors.error}>{error}</Text>}
      {stats && (
        <Box flexDirection="column" paddingX={2}>
          <Text color={colors.textMuted}>
            {stats.resolution} · {from} to {to} (end exclusive)
          </Text>
          <Box marginTop={1} flexDirection="column">
            <Text bold>
              {'DATE'.padEnd(12)}
              {'INSTRUMENT'.padEnd(26)}
              {'REQUESTS'.padStart(10)}
              {'ALLOCATED'.padStart(12)}
              {'USED'.padStart(12)}
            </Text>
            {stats.time_series.length === 0 ? (
              <Text color={colors.textMuted}>No usage in this period.</Text>
            ) : (
              stats.time_series.map((row, idx) => (
                <Text key={`${row.date}-${row.instrument_id}-${row.api_key_id ?? idx}`}>
                  {row.date.padEnd(12)}
                  {(row.instrument_id ?? '—').slice(0, 25).padEnd(26)}
                  {String(row.request_count).padStart(10)}
                  {String(row.tokens_allocated).padStart(12)}
                  {String(row.tokens_used).padStart(12)}
                </Text>
              ))
            )}
          </Box>
          <Box marginTop={1} flexDirection="column">
            <Text bold color={colors.primary}>Totals</Text>
            <Text>requests: {stats.summary.total_requests}</Text>
            <Text>tokens_allocated: {stats.summary.total_tokens_allocated}</Text>
            <Text>tokens_used: {stats.summary.total_tokens_used}</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
}

export const statsCommand = new Command('stats')
  .description('Show daily consumption usage (requests and tokens)')
  .option('--from <date>', 'Start date, inclusive (YYYY-MM-DD)')
  .option('--to <date>', 'End date, exclusive (YYYY-MM-DD). Defaults to tomorrow so today is included')
  .option('--days <n>', 'Number of days back from --to when --from is omitted', '7')
  .option('--instrument <id>', 'Filter by instrument id')
  .option('--api-key <id>', 'Filter by API key id')
  .option('--json', 'Output raw JSON')
  .action(async (options: {
    from?: string;
    to?: string;
    days?: string;
    instrument?: string;
    apiKey?: string;
    json?: boolean;
  }) => {
    const { from, to } = resolveDateRange(options);

    const { waitUntilExit } = render(
      <StatsView
        from={from}
        to={to}
        instrumentId={options.instrument}
        apiKeyId={options.apiKey}
        json={options.json}
      />,
    );
    await waitUntilExit();
  });
