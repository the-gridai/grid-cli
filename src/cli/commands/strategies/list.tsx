import React from 'react';
import { Command } from 'commander';
import { render } from 'ink';
import path from 'path';
import fs from 'fs';
import { StrategyListView, StrategyInfo } from '../../ui/views';

/**
 * Strategy discovery locations:
 * 1. strategies/<name>/index.ts - Module strategies (standard format)
 * 2. strategies/examples/<name>.ts - Example strategies (learning)
 * 3. strategies/dev-bots/<name>.ts - Legacy development bots (flat format)
 */
function discoverStrategies(): StrategyInfo[] {
  const strategiesDir = path.resolve(process.cwd(), 'strategies');
  const strategies: StrategyInfo[] = [];
  const seen = new Set<string>();

  // 1. Standard module strategies: strategies/<name>/index.ts
  if (fs.existsSync(strategiesDir)) {
    const entries = fs.readdirSync(strategiesDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name === 'examples' || entry.name === 'templates' || entry.name === 'dev-bots') continue;
      const indexPath = path.join(strategiesDir, entry.name, 'index.ts');
      if (!fs.existsSync(indexPath)) continue;

      const description = '🟡 Strategy module';

      strategies.push({
        name: entry.name,
        description,
      });
      seen.add(entry.name);
    }
  }

  // 2. Example strategies (for learning)
  const examplesDir = path.join(strategiesDir, 'examples');
  if (fs.existsSync(examplesDir)) {
    const files = fs.readdirSync(examplesDir);
    for (const file of files) {
      if (file.endsWith('.ts') && !file.endsWith('.config.ts')) {
        const name = file.replace('.ts', '');
        if (seen.has(name)) continue;
        strategies.push({
          name,
          description: '🟡 Example strategy',
        });
        seen.add(name);
      }
    }
  }

  // 3. Legacy fallback for older flat bot files
  const devBotsDir = path.join(strategiesDir, 'dev-bots');
  if (fs.existsSync(devBotsDir)) {
    const files = fs.readdirSync(devBotsDir);
    for (const file of files) {
      if (!file.endsWith('.ts') || file.endsWith('.config.ts')) continue;
      const name = file.replace('.ts', '');
      if (seen.has(name)) continue;
      strategies.push({
        name,
        description: '🟢 Legacy dev bot',
      });
      seen.add(name);
    }
  }

  return strategies;
}

export const listStrategiesCommand = new Command('list')
  .description('List available trading strategies')
  .action(async () => {
    let strategies: StrategyInfo[] = [];
    let error: string | undefined;
    
    try {
      strategies = discoverStrategies();
    } catch (err: any) {
      error = `Failed to read strategies: ${err.message}`;
    }

    const { waitUntilExit } = render(
      <StrategyListView strategies={strategies} error={error} />
    );
    
    await waitUntilExit();
  });
