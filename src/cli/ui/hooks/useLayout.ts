/**
 * Layout hook for responsive terminal UI
 * Inspired by Shopify CLI's useLayout pattern
 */

import { useStdout } from 'ink';
import { useLayoutEffect, useState } from 'react';

const MIN_FULL_WIDTH = 40;
const MIN_SIDEBAR_WIDTH = 24;

interface Layout {
  /** Full terminal width */
  fullWidth: number;
  /** Height available for content (minus header/footer) */
  contentHeight: number;
  /** Width for sidebar */
  sidebarWidth: number;
  /** Width for main content area */
  mainWidth: number;
  /** Terminal rows */
  rows: number;
}

function calculateLayout(stdout: NodeJS.WriteStream | undefined): Layout {
  const columns = stdout?.columns ?? 80;
  const rows = stdout?.rows ?? 24;
  
  const fullWidth = Math.max(columns, MIN_FULL_WIDTH);
  const sidebarWidth = MIN_SIDEBAR_WIDTH;
  
  // Reserve space for borders (2 chars each side)
  const mainWidth = Math.max(fullWidth - sidebarWidth - 4, 20);
  
  // Reserve: header (3 lines) + footer (3 lines) + borders
  const contentHeight = Math.max(rows - 6, 10);
  
  return {
    fullWidth,
    contentHeight,
    sidebarWidth,
    mainWidth,
    rows,
  };
}

export function useLayout(): Layout {
  const { stdout } = useStdout();
  const [layout, setLayout] = useState(() => calculateLayout(stdout));

  useLayoutEffect(() => {
    if (!stdout) {
      return;
    }

    function onResize() {
      setLayout(calculateLayout(stdout));
    }

    stdout.on('resize', onResize);
    
    // Also recalculate on mount in case stdout changed
    onResize();

    return () => {
      stdout.off('resize', onResize);
    };
  }, [stdout]);

  return layout;
}
