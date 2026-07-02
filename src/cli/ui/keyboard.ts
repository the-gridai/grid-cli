/**
 * Keyboard Detection Utility
 * 
 * Detects the user's keyboard layout for shortcut display.
 * 
 * Detection order:
 * 1. GRID_KEYBOARD environment variable (mac, linux, windows)
 * 2. Fall back to process.platform
 * 
 * For dev containers: Set GRID_KEYBOARD=mac in your shell profile
 * or .devcontainer/devcontainer.json:
 * 
 *   "remoteEnv": { "GRID_KEYBOARD": "mac" }
 */

export type KeyboardLayout = 'mac' | 'linux' | 'windows';

/**
 * Detect the keyboard layout
 */
export function detectKeyboard(): KeyboardLayout {
  // 1. Check environment variable (allows override in dev containers)
  const envKeyboard = process.env.GRID_KEYBOARD?.toLowerCase();
  if (envKeyboard === 'mac' || envKeyboard === 'macos' || envKeyboard === 'darwin') {
    return 'mac';
  }
  if (envKeyboard === 'linux') {
    return 'linux';
  }
  if (envKeyboard === 'windows' || envKeyboard === 'win32') {
    return 'windows';
  }

  // 2. Fall back to process.platform
  if (process.platform === 'darwin') {
    return 'mac';
  }
  if (process.platform === 'win32') {
    return 'windows';
  }
  
  return 'linux';
}

/**
 * Check if using a Mac keyboard (Cmd key available)
 */
export function isMacKeyboard(): boolean {
  return detectKeyboard() === 'mac';
}

/**
 * Get the modifier key symbol for display
 * Mac: ⌘ (Cmd)
 * Others: Ctrl
 */
export function getModifierKey(): string {
  return isMacKeyboard() ? '⌘' : 'Ctrl';
}

/**
 * Get the modifier key name for help text
 */
export function getModifierKeyName(): string {
  return isMacKeyboard() ? 'Cmd' : 'Ctrl';
}

/**
 * Format a keyboard shortcut for display
 * e.g., formatShortcut('M') => '⌘+M' on Mac, 'Ctrl+M' on others
 */
export function formatShortcut(key: string): string {
  return `${getModifierKey()}+${key}`;
}
