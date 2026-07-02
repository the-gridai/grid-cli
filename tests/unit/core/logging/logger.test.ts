describe('core logging runtime mode detection', () => {
  const originalArgv = [...process.argv];
  const originalEnv = { ...process.env };
  const loadedLoggers: any[] = [];

  function loadLoggerFor(argv: string[], env: Record<string, string | undefined> = {}) {
    process.argv = [...argv];

    const nextEnv: Record<string, string> = {
      ...originalEnv,
      LOG_LEVEL: 'debug',
      NODE_ENV: 'production',
    } as Record<string, string>;
    for (const [key, value] of Object.entries(env)) {
      if (value === undefined) {
        delete nextEnv[key];
      } else {
        nextEnv[key] = value;
      }
    }
    process.env = nextEnv as NodeJS.ProcessEnv;

    let loggerModule: any;
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      loggerModule = require('../../../../src/core/logging/logger');
    });
    loadedLoggers.push(loggerModule.logger);
    return loggerModule.logger;
  }

  function getConsoleTransport(logger: any) {
    return logger.transports.find((transport: any) => transport?.constructor?.name === 'Console');
  }

  function getStderrLevels(transport: any): string[] {
    const raw = transport?.stderrLevels;
    if (Array.isArray(raw)) return [...raw].sort();
    if (raw && typeof raw === 'object') {
      return Object.keys(raw).filter((level) => Boolean(raw[level])).sort();
    }
    return [];
  }

  afterEach(() => {
    jest.resetModules();
    process.argv = [...originalArgv];
    process.env = { ...originalEnv };
    while (loadedLoggers.length > 0) {
      const logger = loadedLoggers.pop();
      if (logger?.transports) {
        for (const transport of logger.transports) {
          if (typeof transport.close === 'function') {
            transport.close();
          }
        }
      }
    }
  });

  it('treats non-CLI entrypoints as daemon even with argv length 2', () => {
    const logger = loadLoggerFor(['node', '/app/dist/src/daemon/index.js'], {
      CONSOLE_LOG_LEVEL: undefined,
    });

    const consoleTransport = getConsoleTransport(logger);
    expect(consoleTransport).toBeDefined();
    expect(getStderrLevels(consoleTransport)).toEqual(['error']);
  });

  it('keeps CLI no-arg runs in TUI mode (silent console transport)', () => {
    const logger = loadLoggerFor(['node', '/app/bin/grid'], {
      CONSOLE_LOG_LEVEL: undefined,
    });

    expect(getConsoleTransport(logger)).toBeUndefined();
  });

  it('keeps warn+error on stderr for non-TUI CLI runs', () => {
    const logger = loadLoggerFor(['node', '/app/bin/grid', 'status'], {
      CONSOLE_LOG_LEVEL: undefined,
    });

    const consoleTransport = getConsoleTransport(logger);
    expect(consoleTransport).toBeDefined();
    expect(getStderrLevels(consoleTransport)).toEqual(['error', 'warn']);
  });
});
