/**
 * HOTWIRE Theme - Grid-branded Neural Interface
 * 
 * Uses Grid's brand colors with metallic, high-tech aesthetics
 */

import { colors } from '../theme';

// HOTWIRE color palette - aligned with Grid brand
export const hotwireColors = {
  // Grid brand colors (primary)
  gridBlue: colors.primary,           // #4D8AFF - main accent
  gridBlueDark: colors.primaryDark,   // #0049E6 - darker blue
  gridGold: colors.accent,            // #FFCD1A - gold CTA
  
  // Metallic gradient colors (silver/steel)
  metalBright: '#E8EDF2',    // Bright silver highlight
  metalLight: '#C4CDD4',     // Light silver
  metalMid: '#95A3AD',       // Mid silver
  metalDark: '#6B7B85',      // Dark silver
  metalDeep: '#4A5860',      // Deep steel
  
  // UI colors from Grid theme
  text: colors.text,                  // #F0F3F5
  textMuted: colors.textMuted,        // #5D7788
  textDim: colors.textDim,            // #4A6170
  background: colors.background,      // #0A0D0F
  surface: colors.surface,            // #1F282D
  
  // Semantic
  success: colors.success,            // #4CAF50
  warning: colors.warning,            // #FFCD1A
  error: colors.error,                // #E53935
};

// ASCII art logo with heat gradient (block style)
// H(steel) → O(gray) → T(orange) → W(gold) → I(bright) → R(yellow) → E(white-hot)
export const hotwireBanner = 
  '\x1b[38;5;245m░▒▓█▓▒░░▒▓█▓▒░\x1b[38;5;250m░▒▓██████▓▒░\x1b[38;5;208m▒▓████████▓▒░\x1b[38;5;214m▒▓█▓▒░░▒▓█▓▒░░▒▓█▓▒░\x1b[38;5;220m▒▓█▓▒░\x1b[38;5;228m▒▓███████▓▒░\x1b[38;5;231m░▒▓████████▓▒░\x1b[0m\n' +
  '\x1b[38;5;245m░▒▓█▓▒░░▒▓█▓▒░\x1b[38;5;250m▒▓█▓▒░░▒▓█▓▒░\x1b[38;5;208m  ░▒▓█▓▒░   \x1b[38;5;214m░▒▓█▓▒░░▒▓█▓▒░░▒▓█▓▒░\x1b[38;5;220m▒▓█▓▒░\x1b[38;5;228m▒▓█▓▒░░▒▓█▓▒░\x1b[38;5;231m▒▓█▓▒░\x1b[0m\n' +
  '\x1b[38;5;245m░▒▓████████▓▒░\x1b[38;5;250m▒▓█▓▒░░▒▓█▓▒░\x1b[38;5;208m  ░▒▓█▓▒░   \x1b[38;5;214m░▒▓█▓▒░░▒▓█▓▒░░▒▓█▓▒░\x1b[38;5;220m▒▓█▓▒░\x1b[38;5;228m▒▓███████▓▒░\x1b[38;5;231m░▒▓██████▓▒░\x1b[0m\n' +
  '\x1b[38;5;245m░▒▓█▓▒░░▒▓█▓▒░\x1b[38;5;250m▒▓█▓▒░░▒▓█▓▒░\x1b[38;5;208m  ░▒▓█▓▒░   \x1b[38;5;214m░▒▓█▓▒░░▒▓█▓▒░░▒▓█▓▒░\x1b[38;5;220m▒▓█▓▒░\x1b[38;5;228m▒▓█▓▒░░▒▓█▓▒░\x1b[38;5;231m▒▓█▓▒░\x1b[0m\n' +
  '\x1b[38;5;245m░▒▓█▓▒░░▒▓█▓▒░\x1b[38;5;250m░▒▓██████▓▒░\x1b[38;5;208m   ░▒▓█▓▒░   \x1b[38;5;214m ░▒▓█████████████▓▒░\x1b[38;5;220m░▒▓█▓▒░\x1b[38;5;228m▒▓█▓▒░░▒▓█▓▒░\x1b[38;5;231m▒▓████████▓▒░\x1b[0m';

// Simpler plain version for fallback
export const hotwireLogoPlain = `
░▒▓█▓▒░░▒▓█▓▒░░▒▓██████▓▒░▒▓████████▓▒░▒▓█▓▒░░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░▒▓███████▓▒░░▒▓████████▓▒░
░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░  ░▒▓█▓▒░   ░▒▓█▓▒░░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░
░▒▓████████▓▒░▒▓█▓▒░░▒▓█▓▒░  ░▒▓█▓▒░   ░▒▓█▓▒░░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░▒▓███████▓▒░░▒▓██████▓▒░
░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░  ░▒▓█▓▒░   ░▒▓█▓▒░░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░
░▒▓█▓▒░░▒▓█▓▒░░▒▓██████▓▒░   ░▒▓█▓▒░    ░▒▓█████████████▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓████████▓▒░
`.trim();

// Compact logo for header
export const hotwireLogoCompact = 'HOTWIRE_';

// Animated spinner frames
export const spinnerFrames = {
  // Grid-style blocks
  blocks: ['⣿⣶⣦⣤⣀', '⣶⣦⣤⣀⣀', '⣦⣤⣀⣀⣤', '⣤⣀⣀⣤⣦', '⣀⣀⣤⣦⣶', '⣀⣤⣦⣶⣿', '⣤⣦⣶⣿⣶', '⣦⣶⣿⣶⣦'],
  
  // Cyber dots
  dots: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
  
  // Simple pulse
  pulse: ['◆', '◇', '◆', '◇'],
};

// Status indicators
export const statusIcons = {
  connected: '●',
  disconnected: '○',
  thinking: '◆',
  ready: '◆',
  error: '✗',
  success: '✓',
  warning: '!',
  ai: '◆',
  user: '▶',
  system: '◇',
};

// Hot wire colors - for the spark animation
// Cool steel → warming → hot orange → white-hot peak → electric flash
export const hotWireColors = {
  cool: '#6B7B85',      // Cool steel (resting state)
  warm: '#FF6B00',      // Warming orange
  hot: '#FF9500',       // Hot orange-yellow
  glow: '#FFCD00',      // Glowing yellow
  whiteHot: '#FFFFFF',  // White-hot peak
  spark: '#00D4FF',     // Electric blue spark
};

// Spark characters
export const sparkChars = ['⚡', '✦', '✧', '·'];

// Taglines - inspired by The Grid manifesto
// Practical, forward-looking, inspiring
export const taglines = [
  'Live intelligence, on demand',
  'Inference ready',
  'Intelligence at your fingertips',
  'Thought, industrialized',
  'The factory is running',
  'Cognition, commoditized',
  'Intelligence market live',
  'Ready to think',
];

export function getRandomTagline(): string {
  return taglines[Math.floor(Math.random() * taglines.length)];
}

// Generate scanline
export function scanline(width: number): string {
  return '─'.repeat(width);
}
