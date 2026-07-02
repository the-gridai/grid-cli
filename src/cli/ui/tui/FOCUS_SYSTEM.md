# TUI Focus Management System

This document describes the focus management system implemented in the Grid CLI TUI.

## Overview

The TUI uses a zone-based focus system that separates input handling between the **sidebar** (navigation menu) and **content** (main view area).

## Focus Zones

| Zone | Description | Controls |
|------|-------------|----------|
| `sidebar` | Left navigation menu | Arrow keys navigate menu items, Enter selects |
| `content` | Main content area | Arrow keys navigate within views, view-specific shortcuts |

## Key Bindings

### Global (work in any zone)
| Key | Action |
|-----|--------|
| `q` / `Ctrl+C` | Quit application |
| `1-5` | Direct view shortcuts (Dashboard, Balances, Orders, Issuance, Settings) |
| `Tab` | Toggle focus between sidebar and content |
| `Escape` | Return focus to sidebar from content |

### Sidebar-focused
| Key | Action |
|-----|--------|
| `↑` / `↓` | Navigate menu items |
| `Enter` | Select menu item AND move focus to content |
| `→` | Move focus to content |

### Content-focused
| Key | Action |
|-----|--------|
| `↑` / `↓` | Navigate within view (tables, lists) |
| View-specific shortcuts | e.g., `v` toggle view, `f` filter, `r` refresh |

## Visual Indicators

- **Header**: Shows `● MENU` or `● VIEW` to indicate current focus zone
- **Sidebar border**: Blue when focused, gray when not
- **Content border**: Blue when focused, gray when not
- **Menu items**: `▶` pointer shown when sidebar focused
- **View headers**: `◆` diamond shown when content focused
- **Table selection**: Row highlighting only shown when content focused

## Usage in Components

### In Views

```tsx
import { useContentFocused } from '../FocusContext';

function MyView(): React.ReactElement {
  const isContentFocused = useContentFocused();
  
  useInput((input, key) => {
    // Only handle input when content is focused
    if (!isContentFocused) return;
    
    // Handle view-specific input...
  });
  
  return (
    <Box>
      {/* Highlight selections only when focused */}
      <Table selectedIndex={isContentFocused ? selectedIndex : -1} />
    </Box>
  );
}
```

### In App Component

```tsx
import { FocusProvider, useFocusZone } from './FocusContext';

function AppContent() {
  const { zone, toggleZone, isFocused } = useFocusZone();
  
  useInput((input, key) => {
    if (key.tab) {
      toggleZone();
      return;
    }
    
    // Handle sidebar input only when sidebar focused
    if (isFocused('sidebar')) {
      // Menu navigation...
    }
  });
}

// Wrap in provider
function App() {
  return (
    <FocusProvider initialZone="content">
      <AppContent />
    </FocusProvider>
  );
}
```

## API Reference

### FocusContext Exports

| Export | Type | Description |
|--------|------|-------------|
| `FocusProvider` | Component | Context provider, wrap your app |
| `useFocusZone()` | Hook | Full access to focus state and actions |
| `useContentFocused()` | Hook | Boolean, true if content zone is focused |
| `useSidebarFocused()` | Hook | Boolean, true if sidebar zone is focused |
| `useIsFocused(zone)` | Hook | Check if specific zone is focused |

### FocusContextValue

```typescript
interface FocusContextValue {
  zone: FocusZone;              // Current focus zone
  setZone: (zone) => void;      // Set focus zone directly
  toggleZone: () => void;       // Toggle between sidebar/content
  focusSidebar: () => void;     // Focus sidebar
  focusContent: () => void;     // Focus content
  isFocused: (zone) => boolean; // Check if zone is focused
  contentSubFocus: ContentSubFocus;     // Sub-focus within content
  setContentSubFocus: (sub) => void;    // Set content sub-focus
}
```

## Mouse Support

Mouse support is available via `@zenobius/ink-mouse` (now installed).

### Basic Usage

```tsx
import { MouseProvider, useOnMouseClick, useMousePosition } from '@zenobius/ink-mouse';

// Wrap your app in MouseProvider
function App() {
  return (
    <MouseProvider>
      <MyComponent />
    </MouseProvider>
  );
}

// Use mouse hooks in components
function MyComponent() {
  const position = useMousePosition();
  
  useOnMouseClick((event) => {
    console.log('Clicked at:', event.x, event.y);
  });
  
  return <Text>Mouse: {position.x}, {position.y}</Text>;
}
```

### Available Hooks

| Hook | Description |
|------|-------------|
| `useMousePosition()` | Returns `{ x, y }` of current mouse position |
| `useOnMouseClick(callback)` | Called when mouse is clicked |
| `useOnMouseHover(callback)` | Called when mouse moves |
| `useElementPosition(ref)` | Get position of an element for hit testing |

### Integration with Focus System

To integrate mouse clicks with the focus system:

```tsx
import { useOnMouseClick } from '@zenobius/ink-mouse';
import { useFocusZone } from './FocusContext';

function Sidebar() {
  const { focusSidebar } = useFocusZone();
  
  useOnMouseClick((event) => {
    // If click is in sidebar area, focus it
    if (event.x < 20) {
      focusSidebar();
    }
  });
}
```

## Future Enhancements

### Sub-Focus Management

For views with multiple focusable regions (e.g., tabs + table), the `contentSubFocus` state can be used:

```tsx
const { contentSubFocus, setContentSubFocus } = useFocusZone();

// Handle tab navigation within content
if (key.tab && isContentFocused) {
  setContentSubFocus(contentSubFocus === 'tabs' ? 'list' : 'tabs');
}
```

### Ink's Built-in useFocus

For more granular focus management, Ink's built-in `useFocus` and `useFocusManager` hooks can be integrated:

```tsx
import { useFocus, useFocusManager } from 'ink';

function MyItem({ id }) {
  const { isFocused } = useFocus({ id });
  
  return (
    <Text inverse={isFocused}>{id}</Text>
  );
}
```

This would allow Tab to cycle through individual items rather than just zones.
