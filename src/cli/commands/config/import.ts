import { Command } from 'commander';
import path from 'path';
import chalk from 'chalk';
import { createStrategyConfigStore } from '../../../core/persistence/StrategyConfigStore';

export const importCommand = new Command('import')
  .description('Import a single-strategy JSON file into the SQLite strategy_configs table')
  .requiredOption('--file <path>', 'Path to strategy JSON (same shape as strategy config blob)')
  .requiredOption('--id <id>', 'Strategy instance id (must match daemon strategy id, e.g. multi-issuer)')
  .requiredOption('--name <name>', 'Human-readable name')
  .requiredOption(
    '--type <type>',
    'Strategy type (resolves to strategies/<type>/index.ts, e.g. my-strategy)'
  )
  .option(
    '--db <path>',
    'SQLite database file (defaults: STRATEGY_CONFIG_DB_PATH, GRID_SQLITE_PATH, or ./grid-strategies.sqlite)'
  )
  .option('--credentials-prefix <prefix>', 'Optional env prefix (e.g. ISSUER_) stored with the row')
  .option('--notes <text>', 'Optional notes')
  .action(async (opts: {
    file: string;
    id: string;
    name: string;
    type: string;
    db?: string;
    credentialsPrefix?: string;
    notes?: string;
  }) => {
    const filePath = path.resolve(opts.file);
    const store = createStrategyConfigStore(opts.db);
    store.init();
    try {
      const row = store.importFromJsonFile(filePath, {
        id: opts.id,
        name: opts.name,
        type: opts.type,
        credentialsEnvPrefix: opts.credentialsPrefix ?? null,
        notes: opts.notes ?? null,
      });
      console.log(chalk.green(`Imported saved strategy config: ${row.id} (version ${row.version})`));
      console.log(JSON.stringify(row, null, 2));
    } finally {
      store.close();
    }
  });
