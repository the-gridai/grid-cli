const mockLogger = {
  error: jest.fn(),
};

jest.mock('../../../../src/core/logging/logger', () => ({
  logger: mockLogger,
}));

import {
  clearDiagnosticBreadcrumbs,
  getDiagnosticBreadcrumbs,
  logFatalDiagnostics,
  recordDiagnosticBreadcrumb,
} from '../../../../src/core/diagnostics/fatal-diagnostics';

describe('fatal diagnostics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearDiagnosticBreadcrumbs();
  });

  it('records recent breadcrumbs for fatal dumps', () => {
    recordDiagnosticBreadcrumb('daemon_config_loaded', {
      strategyIds: ['multi-issuer'],
    });
    recordDiagnosticBreadcrumb('strategy_instance_start_failed', {
      strategyId: 'multi-issuer',
      error: 'markets.7 missing instrumentSymbol',
    });

    logFatalDiagnostics('main_catch', new Error('daemon failed'));

    expect(mockLogger.error).toHaveBeenCalledWith(
      'grid_cli_fatal_diagnostics',
      expect.objectContaining({
        kind: 'main_catch',
        error: expect.objectContaining({
          message: 'daemon failed',
          stack: expect.any(String),
        }),
        recentBreadcrumbs: expect.arrayContaining([
          expect.objectContaining({
            event: 'strategy_instance_start_failed',
            details: expect.objectContaining({
              strategyId: 'multi-issuer',
            }),
          }),
        ]),
      })
    );
  });

  it('redacts likely secret values from breadcrumbs', () => {
    recordDiagnosticBreadcrumb('credentials_loaded', {
      signingKey: 'super-secret',
      signing_key_fingerprint: 'fingerprint',
      safeField: 'visible',
    });

    const [breadcrumb] = getDiagnosticBreadcrumbs();

    expect(breadcrumb.details).toMatchObject({
      signingKey: '[redacted]',
      signing_key_fingerprint: '[redacted]',
      safeField: 'visible',
    });
  });
});

