import { 
  colors, 
  typography, 
  formatLabel, 
  formatCaption, 
  getStatusColor, 
  getSideColor,
  spinnerFrames,
  logo,
  logoCompact,
  tagline,
} from '../../../../src/cli/ui/theme';

describe('Theme', () => {
  describe('colors', () => {
    it('should have all required color tokens', () => {
      expect(colors.background).toBe('#0A0D0F');
      expect(colors.surface).toBe('#1F282D');
      expect(colors.text).toBe('#F0F3F5');
      expect(colors.textMuted).toBe('#5D7788');
      expect(colors.primary).toBe('#4D8AFF');       // Brighter blue for dark bg visibility
      expect(colors.primaryDark).toBe('#0049E6');   // Original Grid blue
      expect(colors.accent).toBe('#FFCD1A');
      expect(colors.success).toBe('#4CAF50');
      expect(colors.warning).toBe('#FFCD1A');
      expect(colors.error).toBe('#E53935');
    });

    it('should have valid hex color format', () => {
      const hexRegex = /^#[0-9A-Fa-f]{6}$/;
      expect(colors.background).toMatch(hexRegex);
      expect(colors.primary).toMatch(hexRegex);
      expect(colors.accent).toMatch(hexRegex);
    });
  });

  describe('typography', () => {
    it('should have heading configuration', () => {
      expect(typography.heading.letterSpacing).toBe(-1);
    });

    it('should have caption configuration', () => {
      expect(typography.caption.uppercase).toBe(true);
      expect(typography.caption.letterSpacing).toBe(1);
    });

    it('should have label configuration', () => {
      expect(typography.label.uppercase).toBe(true);
    });
  });

  describe('formatLabel', () => {
    it('should add trailing underscore', () => {
      expect(formatLabel('ORDERS')).toBe('ORDERS_');
      expect(formatLabel('Status')).toBe('Status_');
      expect(formatLabel('')).toBe('_');
    });
  });

  describe('formatCaption', () => {
    it('should convert to uppercase', () => {
      expect(formatCaption('hello')).toBe('HELLO');
      expect(formatCaption('Hello World')).toBe('HELLO WORLD');
      expect(formatCaption('ALREADY UPPER')).toBe('ALREADY UPPER');
    });
  });

  describe('getStatusColor', () => {
    it('should return correct colors for each status', () => {
      expect(getStatusColor('success')).toBe(colors.success);
      expect(getStatusColor('warning')).toBe(colors.warning);
      expect(getStatusColor('error')).toBe(colors.error);
      expect(getStatusColor('info')).toBe(colors.primary);
      expect(getStatusColor('muted')).toBe(colors.textMuted);
    });
  });

  describe('getSideColor', () => {
    it('should return blue for buy', () => {
      expect(getSideColor('buy')).toBe(colors.primary);
    });

    it('should return gold for sell', () => {
      expect(getSideColor('sell')).toBe(colors.accent);
    });
  });

  describe('spinnerFrames', () => {
    it('should have multiple frames', () => {
      expect(spinnerFrames.length).toBeGreaterThan(0);
    });

    it('should have consistent frame lengths', () => {
      const lengths = spinnerFrames.map(f => f.length);
      expect(new Set(lengths).size).toBe(1);
    });
  });

  describe('branding', () => {
    it('should have logo', () => {
      // Logo is ASCII art made of block characters
      expect(logo).toContain('████');
      expect(logo.length).toBeGreaterThan(100);
    });

    it('should have compact logo with underscore', () => {
      expect(logoCompact).toBe('THE GRID_');
    });

    it('should have tagline', () => {
      expect(tagline).toBe('LIVE LIQUIDITY FOR INTELLIGENCE.');
    });
  });
});
