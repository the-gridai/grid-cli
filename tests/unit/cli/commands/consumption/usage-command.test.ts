import type { UsageSummaryResponse } from '../../../../../src/sdk/responses/types';
import { usageCommand } from '../../../../../src/cli/commands/consumption/usage';

const mockGetUsageSummary = jest.fn<Promise<UsageSummaryResponse>, [unknown?]>();

jest.mock('../../../../../src/sdk/responses/client', () => ({
  ResponsesClient: {
    getInstance: jest.fn(() => ({
      getUsageSummary: mockGetUsageSummary,
    })),
  },
}));

const summaryResponse: UsageSummaryResponse = {
  totals: {
    request_count: 2,
    input_tokens: 10,
    output_tokens: 20,
    total_tokens: 30,
    cost: {
      reconciled_amount: '0.003',
      currency: 'USD',
      reconciled_requests: 2,
      pending_requests: 0,
      unpriced_requests: 0,
      cancelled_requests: 0,
      unpriced_tokens: 0,
    },
  },
  group_by: null,
  from: '2026-07-01T00:00:00Z',
  to: '2026-07-15T00:00:00Z',
};

function resetSharedOptions(): void {
  const summaryCommand = usageCommand.commands.find((command) => command.name() === 'summary');

  for (const command of [usageCommand, summaryCommand].filter((value): value is NonNullable<typeof value> => value != null)) {
    for (const optionName of ['json', 'from', 'to', 'apiKey', 'groupBy']) {
      command.setOptionValue(optionName, undefined);
    }
  }
}

describe('consumption usage summary command', () => {
  let consoleLog: jest.SpyInstance;

  beforeEach(() => {
    resetSharedOptions();
    mockGetUsageSummary.mockReset().mockResolvedValue(summaryResponse);
    consoleLog = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    resetSharedOptions();
    jest.restoreAllMocks();
  });

  it.each([
    ['after summary', ['summary', '--json']],
    ['before summary', ['--json', 'summary']],
  ])('emits valid JSON when --json appears %s', async (_label, args) => {
    await usageCommand.parseAsync(['node', 'usage', ...args]);

    expect(consoleLog).toHaveBeenCalledTimes(1);
    expect(JSON.parse(consoleLog.mock.calls[0][0] as string)).toEqual(summaryResponse);
  });

  it('emits grouped summary JSON', async () => {
    await usageCommand.parseAsync(['node', 'usage', 'summary', '--group-by', 'model', '--json']);

    expect(mockGetUsageSummary).toHaveBeenCalledWith({
      from: undefined,
      to: undefined,
      group_by: 'model',
      api_key_id: undefined,
    });
    expect(JSON.parse(consoleLog.mock.calls[0][0] as string)).toEqual(summaryResponse);
  });

  it.each([
    [
      'before summary',
      [
        '--from',
        '2026-07-01T00:00:00Z',
        '--to',
        '2026-07-15T00:00:00Z',
        '--api-key',
        'key-parent',
        'summary',
      ],
      'key-parent',
    ],
    [
      'after summary',
      [
        'summary',
        '--from',
        '2026-07-02T00:00:00Z',
        '--to',
        '2026-07-16T00:00:00Z',
        '--api-key',
        'key-child',
      ],
      'key-child',
    ],
  ])('passes shared filters placed %s to the summary request', async (_label, args, apiKey) => {
    await usageCommand.parseAsync(['node', 'usage', ...args]);

    expect(mockGetUsageSummary).toHaveBeenCalledWith({
      from: args[args.indexOf('--from') + 1],
      to: args[args.indexOf('--to') + 1],
      group_by: undefined,
      api_key_id: apiKey,
    });
  });

  it('keeps the human summary output when --json is absent', async () => {
    await usageCommand.parseAsync(['node', 'usage', 'summary']);

    expect(mockGetUsageSummary).toHaveBeenCalledWith({
      from: undefined,
      to: undefined,
      group_by: undefined,
      api_key_id: undefined,
    });
    expect(consoleLog).toHaveBeenNthCalledWith(1, '\x1b[38;5;39mTotals\x1b[0m');
    expect(consoleLog).toHaveBeenNthCalledWith(2, '  requests    2');
    expect(consoleLog).toHaveBeenNthCalledWith(3, '  tokens      in=10 out=20 total=30');
    expect(consoleLog).toHaveBeenNthCalledWith(
      4,
      '  spend       \x1b[38;5;114m$0.003 USD\x1b[0m (2 reconciled)'
    );
  });
});
