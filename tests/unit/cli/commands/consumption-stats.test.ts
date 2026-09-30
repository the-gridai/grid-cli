import { resolveDateRange } from '../../../../src/cli/commands/consumption/stats-range';

const TODAY = new Date('2026-08-03T09:30:00Z');

describe('resolveDateRange', () => {
  it('defaults to the last 7 days, ending tomorrow so today is included', () => {
    expect(resolveDateRange({}, TODAY)).toEqual({ from: '2026-07-28', to: '2026-08-04' });
  });

  it('honours an explicit --days window', () => {
    expect(resolveDateRange({ days: '1' }, TODAY)).toEqual({ from: '2026-08-03', to: '2026-08-04' });
  });

  it('counts --days back from an explicit --to', () => {
    expect(resolveDateRange({ to: '2026-07-01', days: '2' }, TODAY)).toEqual({
      from: '2026-06-29',
      to: '2026-07-01',
    });
  });

  it('uses --from verbatim and ignores --days', () => {
    expect(resolveDateRange({ from: '2026-01-01', days: '90' }, TODAY)).toEqual({
      from: '2026-01-01',
      to: '2026-08-04',
    });
  });

  it('crosses month boundaries correctly', () => {
    expect(resolveDateRange({ days: '7' }, new Date('2026-03-03T00:00:00Z'))).toEqual({
      from: '2026-02-25',
      to: '2026-03-04',
    });
  });

  it.each(['0', '-1', 'abc', '1.5'])('rejects a non-positive-integer --days: %s', (days) => {
    expect(() => resolveDateRange({ days }, TODAY)).toThrow('--days must be a positive integer');
  });
});
