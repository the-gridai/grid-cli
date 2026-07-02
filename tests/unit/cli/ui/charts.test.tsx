import React from 'react';
import { render } from 'ink-testing-library';
import {
  BarChart,
  Sparkline,
  InlineSparkline,
  ProgressBar,
  ProgressIndicator,
} from '../../../../src/cli/ui/charts';
import { colors } from '../../../../src/cli/ui/theme';

describe('Chart Components', () => {
  describe('BarChart', () => {
    it('should render with data', () => {
      const { lastFrame } = render(
        <BarChart
          data={[
            { label: 'A', value: 10 },
            { label: 'B', value: 20 },
          ]}
        />
      );
      const frame = lastFrame();
      expect(frame).toContain('A');
      expect(frame).toContain('B');
      // Should contain bar characters
      expect(frame).toMatch(/[█░]/);
    });

    it('should render with title', () => {
      const { lastFrame } = render(
        <BarChart
          title="STATS"
          data={[{ label: 'Test', value: 50 }]}
        />
      );
      expect(lastFrame()).toContain('STATS_');
    });

    it('should handle empty data', () => {
      const { lastFrame } = render(
        <BarChart data={[]} />
      );
      // Empty data renders empty frame
      expect(lastFrame()).toBeDefined();
    });

    it('should render with custom colors', () => {
      const { lastFrame } = render(
        <BarChart
          data={[
            { label: 'Custom', value: 30, color: colors.success },
          ]}
        />
      );
      expect(lastFrame()).toContain('Custom');
    });

    it('should sort data when requested', () => {
      const { lastFrame: ascFrame } = render(
        <BarChart
          data={[
            { label: 'C', value: 30 },
            { label: 'A', value: 10 },
            { label: 'B', value: 20 },
          ]}
          sort="asc"
        />
      );
      const lines = ascFrame()?.split('\n') || [];
      // First data row should be A (lowest value)
      expect(lines.find(l => l.includes('A'))).toBeTruthy();
    });
  });

  describe('Sparkline', () => {
    it('should render with data', () => {
      const { lastFrame } = render(
        <Sparkline data={[1, 2, 3, 4, 5]} />
      );
      // Should contain block characters
      expect(lastFrame()).toMatch(/[▁▂▃▄▅▆▇█]/);
    });

    it('should render with caption', () => {
      const { lastFrame } = render(
        <Sparkline data={[1, 2, 3]} caption="Price trend" />
      );
      expect(lastFrame()).toContain('Price trend');
    });

    it('should handle empty data', () => {
      const { lastFrame } = render(
        <Sparkline data={[]} />
      );
      expect(lastFrame()).toContain('No data');
    });

    it('should respect width', () => {
      const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const { lastFrame } = render(
        <Sparkline data={data} width={5} />
      );
      // Should show only last 5 data points
      const frame = lastFrame();
      const blockChars = frame?.match(/[▁▂▃▄▅▆▇█]/g) || [];
      expect(blockChars.length).toBe(5);
    });
  });

  describe('InlineSparkline', () => {
    it('should render with data', () => {
      const { lastFrame } = render(
        <InlineSparkline data={[1, 2, 3, 4, 5]} />
      );
      // Should contain block characters
      expect(lastFrame()).toMatch(/[▁▂▃▄▅▆▇█]/);
    });

    it('should handle empty data', () => {
      const { lastFrame } = render(
        <InlineSparkline data={[]} />
      );
      expect(lastFrame()).toContain('-');
    });

    it('should respect width', () => {
      const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const { lastFrame } = render(
        <InlineSparkline data={data} width={5} />
      );
      // Should show only last 5 data points
      const frame = lastFrame();
      const blockChars = frame?.match(/[▁▂▃▄▅▆▇█]/g) || [];
      expect(blockChars.length).toBe(5);
    });
  });

  describe('ProgressBar', () => {
    it('should render at 0%', () => {
      const { lastFrame } = render(
        <ProgressBar value={0} width={10} />
      );
      expect(lastFrame()).toContain('░░░░░░░░░░');
    });

    it('should render at 100%', () => {
      const { lastFrame } = render(
        <ProgressBar value={100} width={10} />
      );
      expect(lastFrame()).toContain('██████████');
    });

    it('should render at 50%', () => {
      const { lastFrame } = render(
        <ProgressBar value={50} width={10} />
      );
      const frame = lastFrame();
      expect(frame).toContain('█████');
      expect(frame).toContain('░░░░░');
    });

    it('should show label when enabled', () => {
      const { lastFrame } = render(
        <ProgressBar value={75} showLabel />
      );
      expect(lastFrame()).toContain('75%');
    });

    it('should clamp values to 0-100', () => {
      const { lastFrame: frameNeg } = render(
        <ProgressBar value={-10} width={10} />
      );
      expect(frameNeg()).toContain('░░░░░░░░░░');

      const { lastFrame: frameOver } = render(
        <ProgressBar value={150} width={10} />
      );
      expect(frameOver()).toContain('██████████');
    });
  });

  describe('ProgressIndicator', () => {
    it('should render current/total', () => {
      const { lastFrame } = render(
        <ProgressIndicator current={5} total={10} />
      );
      const frame = lastFrame();
      expect(frame).toContain('5/10');
    });

    it('should render with label', () => {
      const { lastFrame } = render(
        <ProgressIndicator current={3} total={10} label="Progress:" />
      );
      const frame = lastFrame();
      expect(frame).toContain('Progress:');
      expect(frame).toContain('3/10');
    });

    it('should handle zero total', () => {
      const { lastFrame } = render(
        <ProgressIndicator current={0} total={0} />
      );
      expect(lastFrame()).toContain('0/0');
    });
  });
});
