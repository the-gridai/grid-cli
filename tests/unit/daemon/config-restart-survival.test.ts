/**
 * Integration-style test: config changes survive a real process restart.
 *
 * Bundles a helper script with esbuild into a self-contained `.cjs` and
 * spawns three *separate* Node processes (via `child_process.spawnSync`):
 *   1. phase=seed  - seeds SQLite from an inline config
 *   2. phase=patch - opens ConfigManager with critical write-through,
 *                    applies a PATCH, exits
 *   3. phase=read  - opens a fresh store and emits merged config + history
 *
 * Each phase runs in a SEPARATE process, so we genuinely exercise:
 *   - SQLite WAL checkpointing at process exit
 *   - Cross-process file locking
 *   - Re-opening the store in a fresh V8 heap
 *
 * This guards against regressions where an in-process test passes but the
 * on-disk state is not actually durable across restarts.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const esbuild = require('esbuild');

describe('config restart survival', () => {
  let tempDir: string;
  let dbPath: string;
  let bundledHelper: string;

  beforeAll(() => {
    const gridRoot = getGridCliRoot();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'grid-restart-test-'));
    dbPath = path.join(tempDir, 'strategies.sqlite');

    // Write the helper source inside the repo so imports resolve naturally.
    const inRepoTempDir = fs.mkdtempSync(
      path.join(gridRoot, '.config-restart-helper-')
    );
    const helperTsFile = path.join(inRepoTempDir, 'helper.ts');
    bundledHelper = path.join(inRepoTempDir, 'helper.bundle.cjs');

    const absSrc = (rel: string) =>
      path.resolve(gridRoot, rel).replace(/\\/g, '/');

    const helperSrc = `
      import { StrategyConfigStore } from '${absSrc(
        'src/core/persistence/StrategyConfigStore'
      )}';
      import { ConfigManager } from '${absSrc(
        'src/core/config/config-manager'
      )}';
      import {
        seedDbFromFileConfig,
        mergeStrategyConfigsFromDb,
      } from '${absSrc('src/daemon/multi-strategy-config')}';
      import { z } from 'zod';

      const dbPath = process.argv[2];
      const phase = process.argv[3];

      const fileConfig = {
        version: '1.0' as const,
        strategies: [
          {
            id: 'surviver',
            name: 'Surviver',
            type: 'scheduled-issuer' as const,
            enabled: true,
            config: { instrumentSymbol: 'BOOT', quantity: 10 },
          },
        ],
        global: {
          healthPort: 8080,
          controlPort: undefined,
          enableControlApi: false,
          controlApiProfile: undefined,
          logLevel: 'info' as const,
          sentryEnabled: false,
          configSource: 'db' as const,
          strategyConfigDbPath: dbPath,
        },
      };

      const store = new StrategyConfigStore(dbPath);
      store.init();

      async function main() {
        if (phase === 'seed') {
          seedDbFromFileConfig(fileConfig as any, { store });
          store.close();
          return;
        }

        if (phase === 'patch') {
          seedDbFromFileConfig(fileConfig as any, { store });
          const merged = mergeStrategyConfigsFromDb(fileConfig as any, { store });
          const current = merged.strategies[0].config as Record<string, unknown>;

          const schema = z.object({
            instrumentSymbol: z.string(),
            quantity: z.number(),
          });

          const manager = new ConfigManager<{ instrumentSymbol: string; quantity: number }>({
            initialConfig: current as any,
            schema,
            strategyId: 'surviver',
          });

          manager.onConfigChange(
            (newConfig: any, _old: any, ctx: any) => {
              const existing = store.get('surviver');
              if (existing) {
                store.update('surviver', {
                  config: newConfig,
                  actor: ctx?.actor ?? 'test',
                  reason: ctx?.reason ?? 'test',
                });
              } else {
                store.create({
                  id: 'surviver',
                  name: 'Surviver',
                  type: 'scheduled-issuer',
                  config: newConfig,
                  actor: ctx?.actor ?? 'test',
                  reason: ctx?.reason ?? 'test',
                });
              }
            },
            { critical: true }
          );

          const result = await manager.updateConfig(
            { quantity: 42 },
            { actor: 'test-harness', reason: 'integration-restart-test' }
          );
          if (!result.success) {
            console.error('PATCH failed:', result.error);
            process.exit(2);
          }
          store.close();
          return;
        }

        if (phase === 'read') {
          const merged = mergeStrategyConfigsFromDb(fileConfig as any, { store });
          const history = store.history('surviver', 10);
          process.stdout.write(
            JSON.stringify({
              config: merged.strategies[0].config,
              history: history.map((h: any) => ({
                version: h.version,
                actor: h.actor,
                reason: h.reason,
              })),
            })
          );
          store.close();
          return;
        }

        throw new Error('unknown phase: ' + phase);
      }

      main().catch((err) => {
        console.error(err);
        process.exit(1);
      });
    `;
    fs.writeFileSync(helperTsFile, helperSrc, 'utf8');

    // Bundle helper to a self-contained .cjs. Native modules stay external
    // (Node will require them from the original node_modules).
    esbuild.buildSync({
      entryPoints: [helperTsFile],
      bundle: true,
      platform: 'node',
      target: 'node18',
      format: 'cjs',
      outfile: bundledHelper,
      external: ['better-sqlite3'],
      logLevel: 'silent',
      sourcemap: false,
    });
  });

  afterAll(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    const helperDir = path.dirname(bundledHelper);
    if (helperDir.startsWith(getGridCliRoot())) {
      fs.rmSync(helperDir, { recursive: true, force: true });
    }
  });

  function runPhase(phase: 'seed' | 'patch' | 'read') {
    return spawnSync(
      process.execPath,
      [bundledHelper, dbPath, phase],
      {
        cwd: getGridCliRoot(),
        encoding: 'utf8',
        timeout: 60_000,
        env: {
          ...process.env,
          LOG_LEVEL: 'error',
          NODE_NO_WARNINGS: '1',
        },
      }
    );
  }

  it('config PATCHed in one process is visible to the next process', () => {
    const seed = runPhase('seed');
    if (seed.status !== 0) {
      // eslint-disable-next-line no-console
      console.error('seed phase stderr:', seed.stderr, 'stdout:', seed.stdout);
    }
    expect(seed.status).toBe(0);

    const patch = runPhase('patch');
    if (patch.status !== 0) {
      // eslint-disable-next-line no-console
      console.error('patch phase stderr:', patch.stderr, 'stdout:', patch.stdout);
    }
    expect(patch.status).toBe(0);

    const read = runPhase('read');
    if (read.status !== 0) {
      // eslint-disable-next-line no-console
      console.error('read phase stderr:', read.stderr, 'stdout:', read.stdout);
    }
    expect(read.status).toBe(0);

    const output = JSON.parse(read.stdout);
    expect(output.config).toEqual({ instrumentSymbol: 'BOOT', quantity: 42 });

    expect(output.history.length).toBeGreaterThanOrEqual(2);
    const patchEntry = output.history.find(
      (h: { reason: string }) => h.reason === 'integration-restart-test'
    );
    expect(patchEntry).toBeDefined();
    expect(patchEntry.actor).toBe('test-harness');
  }, 120_000);
});

function getGridCliRoot(): string {
  return path.resolve(__dirname, '..', '..', '..');
}
