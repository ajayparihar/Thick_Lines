# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

**Thick Lines** is a minimalist web-based whiteboard application with four drawing colors (Red, Green, Blue, Yellow) and smooth drawing capabilities. Built with vanilla HTML5 Canvas, JavaScript, and CSS, it focuses on simplicity and performance.

## Key Architecture Components

### Frontend Structure
- **Single-page application** with no external dependencies beyond CDN fonts/icons
- **Canvas-based drawing** using HTML5 Canvas API with device pixel ratio optimization
- **Modular JavaScript architecture** with clear separation of concerns:
  - Drawing engine with velocity-based pen width variation
  - Undo/redo system with PNG state management
  - Pan/zoom functionality with smooth transforms
  - Touch and mouse input handling

### Drawing System Architecture
The drawing system uses a sophisticated path-based approach:
- **Path smoothing** via quadratic curves between midpoints
- **Velocity-responsive pen width** that varies based on drawing speed
- **Eraser functionality** using `destination-out` composite operations
- **State management** with canvas snapshots stored as base64 PNG data

### UI/UX Design Pattern
- **Glass morphism design** with backdrop blur effects
- **Responsive color palette** (RGBY) with keyboard shortcuts (1-4)
- **Tool system** with pen/eraser modes and size dropdowns
- **Context menu** with standard editing operations
- **Toast notifications** for user feedback

## Common Development Commands

### Development Server
```bash
# Serve locally (any static file server)
python -m http.server 8000
# or
npx serve .
# or
php -S localhost:8000
```

### Testing
```bash
# Open in browser and test:
# - Drawing with mouse/touch
# - Keyboard shortcuts (P/E for tools, 1-4 for colors)
# - Zoom with Ctrl+scroll
# - Pan with middle mouse drag
# - Undo/redo with Ctrl+Z/Ctrl+Y
# - Export with Ctrl+S
```

### Code Analysis
```bash
# Check JavaScript syntax
node --check app.js

# Analyze bundle size (if using bundlers)
npx bundlesize

# Check HTML validation
npx html-validate index.html
```

## Code Architecture Details

### State Management Pattern
The application uses a centralized state approach with these key variables:
- `currentTool` - Active tool ('pen' or 'eraser')
- `currentColor` - Selected drawing color
- `undoStack`/`redoStack` - Canvas state history (PNG data URLs)
- `zoomLevel`/`panOffsetX`/`panOffsetY` - Viewport transform state

### Event Handling Strategy
- **Throttled mouse movements** using `requestAnimationFrame` for smooth 60fps drawing
- **Unified coordinate system** that handles both mouse and touch events
- **Transform-aware coordinates** that account for zoom/pan when drawing
- **Composite event handling** for complex gestures (two-finger pan on touch)

### Memory Management
- **Undo stack limiting** to 30 states with automatic cleanup
- **Canvas state compression** using PNG format for transparency support
- **Memory cleanup** on tab visibility change and window unload
- **Path data clearing** after drawing completion

### Performance Optimizations
- **Device pixel ratio scaling** for crisp rendering on high-DPI displays
- **Context state caching** to minimize repeated property assignments
- **DOM element caching** to avoid frequent lookups
- **Debounced window resize** handling to prevent excessive redraws

## File-Specific Guidance

### `app.js`
- **Canvas initialization** happens in `init()` - always check context availability
- **Drawing functions** (`drawPenPath`, `drawEraserPath`) handle path smoothing
- **Transform management** via `applyTransform()` for zoom/pan operations
- **Memory management** functions should be called during cleanup phases

### `style.css`
- **CSS variables** at root level define the design system
- **Glass morphism effects** use `backdrop-filter` and semi-transparent backgrounds
- **Responsive breakpoints** at 768px and 480px for mobile adaptation
- **Animation system** uses cubic-bezier easing for smooth transitions

### `index.html`
- **Semantic structure** with proper ARIA labels for accessibility
- **Performance optimizations** include preloaded CSS and deferred JavaScript
- **Meta tags** configured for PWA-like behavior and mobile optimization

## Development Patterns

### Adding New Tools
1. Add tool button to `.toolbox` in HTML
2. Implement tool logic in `setTool()` function
3. Add drawing behavior in `draw()` function
4. Update cursor in `updateCursor()`
5. Add keyboard shortcut in `handleKeyDown()`

### Extending Color Palette
1. Add CSS variable for new color in `:root`
2. Add color button with `data-color` attribute
3. Update keyboard shortcut handling for additional number keys
4. Ensure color integrates with size visualizer

### Canvas State Operations
- Always save state after drawing operations via `saveState()`
- Use `loadState()` for undo/redo operations
- Maintain proper composite operations for transparency
- Clear paths data after state saves for memory efficiency

## Browser Compatibility Notes
- **Canvas API** features used require modern browsers (IE11+)
- **Backdrop filter** has limited support (fallbacks exist)
- **Clipboard API** for copy/paste has progressive enhancement
- **Device pixel ratio** handling ensures cross-device compatibility

## Performance Considerations
- Canvas operations are CPU-intensive on large canvases
- Undo stack grows memory usage significantly with complex drawings
- Touch events on mobile require careful performance optimization
- File export operations can block UI thread temporarily
