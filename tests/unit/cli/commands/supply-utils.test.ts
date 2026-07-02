import { resolveInstrumentId } from '../../../../src/cli/commands/supply/utils';

describe('resolveInstrumentId', () => {
  it('returns GX wire instrument ids directly', async () => {
    const client = {
      getInstruments: jest.fn(),
      getInstrumentBySymbol: jest.fn(),
      getSupplyIssuanceSummary: jest.fn(),
    } as any;

    const gxInstrumentId = 'instrument-f0e0e0e0-e0e0-40e0-80e0-000000000002';
    const resolved = await resolveInstrumentId(client, gxInstrumentId);

    expect(resolved).toEqual({
      id: gxInstrumentId,
      name: gxInstrumentId,
      symbol: gxInstrumentId,
    });

    expect(client.getInstruments).not.toHaveBeenCalled();
    expect(client.getInstrumentBySymbol).not.toHaveBeenCalled();
    expect(client.getSupplyIssuanceSummary).not.toHaveBeenCalled();
  });

  it('returns ME wire instrument ids directly', async () => {
    const client = {
      getInstruments: jest.fn(),
      getInstrumentBySymbol: jest.fn(),
      getSupplyIssuanceSummary: jest.fn(),
    } as any;

    const meInstrumentId = 'instrument_f0e0e0e0-e0e0-40e0-80e0-000000000002';
    const resolved = await resolveInstrumentId(client, meInstrumentId);

    expect(resolved).toEqual({
      id: meInstrumentId,
      name: meInstrumentId,
      symbol: meInstrumentId,
    });

    expect(client.getInstruments).not.toHaveBeenCalled();
    expect(client.getInstrumentBySymbol).not.toHaveBeenCalled();
    expect(client.getSupplyIssuanceSummary).not.toHaveBeenCalled();
  });
});
