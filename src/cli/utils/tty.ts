type MaybeTTYStream = {
  isTTY?: boolean;
  setRawMode?: unknown;
};

export function supportsInteractiveTerminal(
  input: MaybeTTYStream = process.stdin,
  output: MaybeTTYStream = process.stdout
): boolean {
  return input.isTTY === true && output.isTTY === true && typeof input.setRawMode === 'function';
}

export function interactiveTerminalProblem(
  input: MaybeTTYStream = process.stdin,
  output: MaybeTTYStream = process.stdout
): string | null {
  if (supportsInteractiveTerminal(input, output)) {
    return null;
  }

  if (input.isTTY !== true && output.isTTY !== true) {
    return 'stdin and stdout are not TTY terminals';
  }

  if (input.isTTY !== true) {
    return 'stdin is not a TTY terminal';
  }

  if (output.isTTY !== true) {
    return 'stdout is not a TTY terminal';
  }

  return 'stdin does not support raw mode';
}
