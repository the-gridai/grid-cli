import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

/**
 * Focus zones in the TUI application
 * - 'sidebar': The left navigation menu
 * - 'content': The main content area (views)
 */
export type FocusZone = 'sidebar' | 'content';

/**
 * Sub-focus within the content area for views with multiple focusable regions
 * This allows views to manage their own internal focus state
 */
export type ContentSubFocus = 'list' | 'detail' | 'tabs' | null;

interface FocusContextValue {
  /** Current focus zone */
  zone: FocusZone;
  
  /** Set the focus zone */
  setZone: (zone: FocusZone) => void;
  
  /** Toggle between sidebar and content */
  toggleZone: () => void;
  
  /** Move focus to sidebar */
  focusSidebar: () => void;
  
  /** Move focus to content */
  focusContent: () => void;
  
  /** Check if a zone is focused */
  isFocused: (zone: FocusZone) => boolean;
  
  /** Sub-focus within content area (for views with multiple sections) */
  contentSubFocus: ContentSubFocus;
  
  /** Set sub-focus within content */
  setContentSubFocus: (subFocus: ContentSubFocus) => void;
}

const FocusContext = createContext<FocusContextValue | null>(null);

interface FocusProviderProps {
  children: React.ReactNode;
  /** Initial focus zone (default: 'sidebar') */
  initialZone?: FocusZone;
}

/**
 * FocusProvider - Manages focus state across the TUI
 * 
 * Usage:
 * ```tsx
 * <FocusProvider>
 *   <App />
 * </FocusProvider>
 * ```
 * 
 * In components:
 * ```tsx
 * const { zone, isFocused, toggleZone } = useFocusZone();
 * 
 * useInput((input, key) => {
 *   // Only handle input when this zone is focused
 *   if (!isFocused('content')) return;
 *   
 *   // Handle input...
 * });
 * ```
 */
export function FocusProvider({ children, initialZone = 'content' }: FocusProviderProps): React.ReactElement {
  const [zone, setZone] = useState<FocusZone>(initialZone);
  const [contentSubFocus, setContentSubFocus] = useState<ContentSubFocus>(null);

  const toggleZone = useCallback(() => {
    setZone(current => current === 'sidebar' ? 'content' : 'sidebar');
  }, []);

  const focusSidebar = useCallback(() => {
    setZone('sidebar');
  }, []);

  const focusContent = useCallback(() => {
    setZone('content');
  }, []);

  const isFocused = useCallback((checkZone: FocusZone) => {
    return zone === checkZone;
  }, [zone]);

  const value = useMemo<FocusContextValue>(() => ({
    zone,
    setZone,
    toggleZone,
    focusSidebar,
    focusContent,
    isFocused,
    contentSubFocus,
    setContentSubFocus,
  }), [zone, toggleZone, focusSidebar, focusContent, isFocused, contentSubFocus]);

  return (
    <FocusContext.Provider value={value}>
      {children}
    </FocusContext.Provider>
  );
}

/**
 * Hook to access focus zone state and actions
 * 
 * @throws Error if used outside of FocusProvider
 */
export function useFocusZone(): FocusContextValue {
  const context = useContext(FocusContext);
  
  if (!context) {
    throw new Error('useFocusZone must be used within a FocusProvider');
  }
  
  return context;
}

/**
 * Hook that returns whether the specified zone is currently focused
 * Optimized for components that only need to check focus state
 * 
 * @param zone - The zone to check
 * @returns boolean indicating if the zone is focused
 */
export function useIsFocused(zone: FocusZone): boolean {
  const { isFocused } = useFocusZone();
  return isFocused(zone);
}

/**
 * Hook for content views to check if they should handle input
 * Returns true only when the content zone is focused
 */
export function useContentFocused(): boolean {
  return useIsFocused('content');
}

/**
 * Hook for sidebar to check if it should handle input
 * Returns true only when the sidebar zone is focused
 */
export function useSidebarFocused(): boolean {
  return useIsFocused('sidebar');
}
