import { interactiveTerminalProblem, supportsInteractiveTerminal } from '../../../../src/cli/utils/tty';

describe('interactive terminal detection', () => {
  const rawInput = { isTTY: true, setRawMode: jest.fn() };
  const ttyOutput = { isTTY: true };

  it('accepts stdin/stdout TTYs when stdin supports raw mode', () => {
    expect(supportsInteractiveTerminal(rawInput, ttyOutput)).toBe(true);
    expect(interactiveTerminalProblem(rawInput, ttyOutput)).toBeNull();
  });

  it('rejects piped stdin and stdout', () => {
    const input = { isTTY: false, setRawMode: jest.fn() };
    const output = { isTTY: false };

    expect(supportsInteractiveTerminal(input, output)).toBe(false);
    expect(interactiveTerminalProblem(input, output)).toBe('stdin and stdout are not TTY terminals');
  });

  it('rejects piped stdout even when stdin is interactive', () => {
    expect(supportsInteractiveTerminal(rawInput, { isTTY: false })).toBe(false);
    expect(interactiveTerminalProblem(rawInput, { isTTY: false })).toBe('stdout is not a TTY terminal');
  });

  it('rejects TTY stdin without raw-mode support', () => {
    const input = { isTTY: true };

    expect(supportsInteractiveTerminal(input, ttyOutput)).toBe(false);
    expect(interactiveTerminalProblem(input, ttyOutput)).toBe('stdin does not support raw mode');
  });
});
