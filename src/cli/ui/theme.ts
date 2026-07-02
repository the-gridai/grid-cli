/**
 * Grid CLI Theme - Design tokens extracted from thegrid.ai CSS
 * 
 * This theme provides consistent styling across all CLI components,
 * matching The Grid's brand identity.
 */

/**
 * Color palette extracted from thegrid.ai CSS
 */
export const colors = {
  // Core colors (dark mode - from CSS)
  background: '#0A0D0F',      // Main dark background (preloader, hero)
  surface: '#1F282D',         // Panel/card backgrounds
  surfaceAlt: '#34424C',      // Alternative surface color
  
  // Text colors
  text: '#F0F3F5',            // Primary text (rgb(240, 243, 245))
  textMuted: '#5D7788',       // Secondary text (menu color)
  textDim: '#4A6170',         // Tertiary text (menu hover)
  
  // Brand colors (from CSS)
  primary: '#4D8AFF',         // Lighter Grid blue for better visibility on dark backgrounds
  primaryHover: '#0049E6',    // Original blue for hover state
  primaryDark: '#0049E6',     // Original Grid blue (hero card, buttons, captions)
  accent: '#FFCD1A',          // Gold/yellow CTA buttons
  accentHover: '#E6B400',     // Gold hover state
  
  // Semantic colors
  success: '#4CAF50',         // Green for success
  warning: '#FFCD1A',         // Gold for warnings (matches accent)
  error: '#E53935',           // Red for errors
  
  // Footer/light mode accent
  footerBg: '#95A9B7',        // Light gray-blue footer
  
  // Borders and overlays (from CSS)
  border: 'rgba(255, 255, 255, 0.14)',
  borderLight: 'rgba(255, 255, 255, 0.24)',
  overlay: 'rgba(255, 255, 255, 0.2)',
  overlayDark: 'rgba(0, 0, 0, 0.3)',
} as const;

/**
 * Typography patterns from thegrid.ai
 * 
 * Font families on the website:
 * - 'r, sans-serif'  → Headings (h1, h2) - display font
 * - 'd, sans-serif'  → UI elements (h3, captions, buttons)
 * - 'dm, sans-serif' → Body text, paragraphs (DM Sans)
 * - 'DM Mono'        → Monospace/code
 * 
 * For CLI, we use terminal's monospace font but apply similar styling patterns.
 */
export const typography = {
  // Headings: negative letter-spacing (-0.01em equivalent)
  heading: {
    letterSpacing: -1,  // Tighter tracking for headers
  },
  
  // Captions: positive letter-spacing (0.1em), uppercase, weight 500
  caption: {
    uppercase: true,
    letterSpacing: 1,   // letter-spacing: 0.1em equivalent
  },
  
  // Buttons: weight 500
  button: {
    uppercase: false,
  },
  
  // Labels: uppercase
  label: {
    uppercase: true,
  },
} as const;

/**
 * Animation timing from thegrid.ai CSS
 */
export const animation = {
  easing: 'cubic-bezier(.17, .84, .44, 1)',  // Smooth, slightly bouncy
  durationFast: 300,   // 0.3s for color transitions
  durationSlow: 600,   // 0.6s for transform transitions
} as const;

/**
 * Box drawing characters for borders
 */
export const boxChars = {
  topLeft: '┌',
  topRight: '┐',
  bottomLeft: '└',
  bottomRight: '┘',
  horizontal: '─',
  vertical: '│',
  teeRight: '├',
  teeLeft: '┤',
  teeDown: '┬',
  teeUp: '┴',
  cross: '┼',
} as const;

/**
 * Spinner frames for Grid-branded loading animation
 */
export const spinnerFrames = [
  '⣿⣶⣦⣤⣀',
  '⣶⣦⣤⣀⣀',
  '⣦⣤⣀⣀⣤',
  '⣤⣀⣀⣤⣦',
  '⣀⣀⣤⣦⣶',
  '⣀⣤⣦⣶⣿',
  '⣤⣦⣶⣿⣶',
  '⣦⣶⣿⣶⣦',
];

/**
 * ASCII art logo for The Grid
 */
export const logo = `
████████╗██╗  ██╗███████╗     ██████╗ ██████╗ ██╗██████╗ 
╚══██╔══╝██║  ██║██╔════╝    ██╔════╝ ██╔══██╗██║██╔══██╗
   ██║   ███████║█████╗      ██║  ███╗██████╔╝██║██║  ██║
   ██║   ██╔══██║██╔══╝      ██║   ██║██╔══██╗██║██║  ██║
   ██║   ██║  ██║███████╗    ╚██████╔╝██║  ██║██║██████╔╝
   ╚═╝   ╚═╝  ╚═╝╚══════╝     ╚═════╝ ╚═╝  ╚═╝╚═╝╚═════╝ 
`.trim();

/**
 * Compact logo for smaller spaces
 */
export const logoCompact = 'THE GRID_';

/**
 * Brand tagline
 */
export const tagline = 'LIVE LIQUIDITY FOR INTELLIGENCE.';

/**
 * Format a label with trailing underscore (Grid style)
 */
export function formatLabel(text: string): string {
  return `${text}_`;
}

/**
 * Format text as uppercase caption
 */
export function formatCaption(text: string): string {
  return text.toUpperCase();
}

/**
 * Get semantic color for a status
 */
export function getStatusColor(status: 'success' | 'warning' | 'error' | 'info' | 'muted'): string {
  switch (status) {
    case 'success':
      return colors.success;
    case 'warning':
      return colors.warning;
    case 'error':
      return colors.error;
    case 'info':
      return colors.primary;
    case 'muted':
    default:
      return colors.textMuted;
  }
}

/**
 * Get color for order side
 */
export function getSideColor(side: 'buy' | 'sell'): string {
  return side === 'buy' ? colors.primary : colors.accent;
}

/**
 * Theme object combining all design tokens
 */
export const theme = {
  colors,
  typography,
  animation,
  boxChars,
  spinnerFrames,
  logo,
  logoCompact,
  tagline,
} as const;

export default theme;
