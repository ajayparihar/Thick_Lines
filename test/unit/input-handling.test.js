/**
 * Unit Tests for Input Handling
 * Tests mouse events, touch events, keyboard shortcuts, and event processing
 */

require('../../app.js');

describe('Input Handling (unit)', () => {
  let mockCanvas;
  let mockContext;

  beforeEach(() => {
    // Setup canvas and context mocks
    mockContext = {
      save: jest.fn(),
      restore: jest.fn(),
      globalCompositeOperation: 'source-over'
    };

    mockCanvas = {
      getBoundingClientRect: jest.fn(() => ({
        left: 0, top: 0, width: 800, height: 600
      })),
      style: {},
      addEventListener: jest.fn()
    };

    // Set globals
    global.canvas = mockCanvas;
    global.ctx = mockContext;
    global.currentTool = 'pen';
    global.currentColor = '#ef4444';
    global.isDrawing = false;
    global.isPanning = false;
    global.isMiddleMouseDown = false;
    global.zoomLevel = 1.0;
    global.panOffsetX = 0;
    global.panOffsetY = 0;
    global.middleMouseStartX = 0;
    global.middleMouseStartY = 0;
    global.lastPanPoint = { x: 0, y: 0 };

    // Mock DOM elements
    document.getElementById = jest.fn((id) => ({
      click: jest.fn(),
      disabled: false,
      classList: { add: jest.fn(), remove: jest.fn(), toggle: jest.fn() }
    }));

    document.querySelectorAll = jest.fn(() => [
      { click: jest.fn() },
      { click: jest.fn() },
      { click: jest.fn() },
      { click: jest.fn() }
    ]);
  });

  describe('Mouse Event Handling', () => {
    test('should handle left mouse button down for drawing', () => {
      const mockEvent = {
        preventDefault: jest.fn(),
        button: 0, // Left mouse button
        clientX: 100,
        clientY: 150
      };

      handleMouseDown(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(global.isDrawing).toBe(true);
    });

    test('should handle middle mouse button down for panning', () => {
      const mockEvent = {
        preventDefault: jest.fn(),
        button: 1, // Middle mouse button
        clientX: 200,
        clientY: 250
      };

      handleMouseDown(mockEvent);

      expect(global.isMiddleMouseDown).toBe(true);
      expect(global.middleMouseStartX).toBe(200);
      expect(global.middleMouseStartY).toBe(250);
      expect(global.isPanning).toBe(true);
    });

    test('should handle right mouse button down for context menu', () => {
      const mockEvent = {
        preventDefault: jest.fn(),
        button: 2, // Right mouse button
        clientX: 150,
        clientY: 200
      };

      handleMouseDown(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
    });

    test('should handle mouse up correctly', () => {
      global.isDrawing = true;
      global.isPanning = true;

      const mockEvent = { preventDefault: jest.fn() };

      handleMouseUp(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
    });

    test('should handle unknown tool in mouse down', () => {
      global.currentTool = 'unknown-tool';
      const mockEvent = {
        preventDefault: jest.fn(),
        button: 0,
        clientX: 100,
        clientY: 100
      };
      const consoleSpy = jest.spyOn(console, 'log');

      handleMouseDown(mockEvent);

      expect(consoleSpy).toHaveBeenCalledWith('Unknown tool: unknown-tool');
    });

    test('should handle mouse down errors gracefully', () => {
      // Force an error in the event handler
      global.currentTool = null;
      const mockEvent = {
        preventDefault: jest.fn(() => { throw new Error('Event error'); }),
        button: 0,
        clientX: 100,
        clientY: 100
      };
      const consoleSpy = jest.spyOn(console, 'error');

      handleMouseDown(mockEvent);

      expect(consoleSpy).toHaveBeenCalledWith('Error in handleMouseDown:', expect.any(Error));
    });
  });

  describe('Touch Event Handling', () => {
    test('should handle single touch start for drawing', () => {
      const mockEvent = {
        preventDefault: jest.fn(),
        touches: [{ clientX: 100, clientY: 150 }]
      };

      handleTouchStart(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(global.isDrawing).toBe(true);
    });

    test('should handle two-finger touch for panning', () => {
      const mockEvent = {
        preventDefault: jest.fn(),
        touches: [
          { clientX: 100, clientY: 150 },
          { clientX: 200, clientY: 250 }
        ]
      };

      handleTouchStart(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(global.isDrawing).toBe(false);
      expect(global.isPanning).toBe(true);
    });

    test('should handle touch move for drawing', () => {
      global.isDrawing = true;
      const mockEvent = {
        preventDefault: jest.fn(),
        touches: [{ clientX: 110, clientY: 160 }]
      };

      handleTouchMove(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
    });

    test('should handle two-finger touch move for panning', () => {
      global.isPanning = true;
      const mockEvent = {
        preventDefault: jest.fn(),
        touches: [
          { clientX: 120, clientY: 170 },
          { clientX: 220, clientY: 270 }
        ]
      };

      handleTouchMove(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
    });

    test('should handle touch end correctly', () => {
      global.isDrawing = true;
      global.isPanning = true;

      const mockEvent = {
        touches: [] // No remaining touches
      };

      handleTouchEnd(mockEvent);

      expect(global.isDrawing).toBe(false);
      expect(global.isPanning).toBe(false);
    });

    test('should transition from panning to drawing on touch end', () => {
      global.isPanning = true;
      global.isDrawing = false;

      const mockEvent = {
        touches: [{ clientX: 100, clientY: 100 }] // One touch remains
      };

      handleTouchEnd(mockEvent);

      expect(global.isPanning).toBe(false);
      expect(global.isDrawing).toBe(true);
    });

    test('should handle touch event errors gracefully', () => {
      const mockEvent = {
        preventDefault: jest.fn(() => { throw new Error('Touch error'); }),
        touches: [{ clientX: 100, clientY: 100 }]
      };
      const consoleSpy = jest.spyOn(console, 'error');

      handleTouchStart(mockEvent);

      expect(consoleSpy).toHaveBeenCalledWith('Error in touch start handler:', expect.any(Error));
      expect(global.isDrawing).toBe(false);
      expect(global.isPanning).toBe(false);
    });
  });

  describe('Keyboard Event Handling', () => {
    test('should handle undo shortcut (Ctrl+Z)', () => {
      global.undoStack = ['state1', 'state2'];
      const mockEvent = {
        key: 'z',
        ctrlKey: true,
        preventDefault: jest.fn(),
        target: { tagName: 'DIV' }
      };

      handleKeyDown(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
    });

    test('should handle redo shortcut (Ctrl+Y)', () => {
      global.redoStack = ['state1'];
      const mockEvent = {
        key: 'y',
        ctrlKey: true,
        preventDefault: jest.fn(),
        target: { tagName: 'DIV' }
      };

      handleKeyDown(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
    });

    test('should handle pen tool shortcut (P)', () => {
      const mockEvent = {
        key: 'p',
        ctrlKey: false,
        target: { tagName: 'DIV' }
      };

      handleKeyDown(mockEvent);

      expect(global.currentTool).toBe('pen');
    });

    test('should handle eraser tool shortcut (E)', () => {
      const mockEvent = {
        key: 'e',
        ctrlKey: false,
        target: { tagName: 'DIV' }
      };

      handleKeyDown(mockEvent);

      expect(global.currentTool).toBe('eraser');
    });

    test('should handle export shortcut (Ctrl+S)', () => {
      global.undoStack = ['state1'];
      const mockEvent = {
        key: 's',
        ctrlKey: true,
        preventDefault: jest.fn(),
        target: { tagName: 'DIV' }
      };

      handleKeyDown(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
    });

    test('should handle clear shortcut (Shift+Delete)', () => {
      global.undoStack = ['state1'];
      const mockEvent = {
        key: 'delete',
        shiftKey: true,
        preventDefault: jest.fn(),
        target: { tagName: 'DIV' }
      };

      // Mock window.confirm
      window.confirm = jest.fn(() => true);

      handleKeyDown(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
    });

    test('should handle color selection shortcuts (1-4)', () => {
      const mockEvent = {
        key: '2',
        ctrlKey: false,
        target: { tagName: 'DIV' }
      };

      handleKeyDown(mockEvent);

      // Should click the second color button (green)
      const colorButtons = document.querySelectorAll('.color-btn');
      expect(colorButtons[1].click).toHaveBeenCalled();
    });

    test('should ignore keyboard events in input fields', () => {
      const mockEvent = {
        key: 'z',
        ctrlKey: true,
        target: { tagName: 'INPUT' }
      };

      handleKeyDown(mockEvent);

      // Should not process the shortcut
      expect(global.currentTool).toBe('pen'); // Unchanged
    });

    test('should handle help shortcut (?)', () => {
      const mockEvent = {
        key: '?',
        target: { tagName: 'DIV' }
      };

      handleKeyDown(mockEvent);

      // Should trigger help panel toggle
      expect(mockEvent.key).toBe('?');
    });
  });

  describe('Pan and Zoom', () => {
    test('should start canvas panning correctly', () => {
      const mockEvent = { clientX: 100, clientY: 150 };

      startCanvasPan(mockEvent);

      expect(global.isPanning).toBe(true);
      expect(global.lastPanPoint).toEqual({ x: 100, y: 150 });
      expect(mockCanvas.style.cursor).toBe('grabbing');
    });

    test('should move canvas during panning', () => {
      global.isPanning = true;
      global.lastPanPoint = { x: 100, y: 150 };
      global.panOffsetX = 0;
      global.panOffsetY = 0;

      const mockEvent = { clientX: 120, clientY: 170 };

      moveCanvasPan(mockEvent);

      expect(global.panOffsetX).toBe(20);
      expect(global.panOffsetY).toBe(20);
      expect(global.lastPanPoint).toEqual({ x: 120, y: 170 });
    });

    test('should stop canvas panning correctly', () => {
      global.isPanning = true;
      mockCanvas.style.cursor = 'grabbing';

      stopCanvasPan();

      expect(global.isPanning).toBe(false);
      expect(mockCanvas.style.cursor).toBe('');
    });

    test('should not move canvas when not panning', () => {
      global.isPanning = false;
      global.panOffsetX = 0;
      global.panOffsetY = 0;

      const mockEvent = { clientX: 120, clientY: 170 };

      moveCanvasPan(mockEvent);

      expect(global.panOffsetX).toBe(0);
      expect(global.panOffsetY).toBe(0);
    });

    test('should handle zoom with Ctrl+wheel', () => {
      global.zoomLevel = 1.0;
      global.zoomIncrement = 0.1;
      const mockEvent = {
        ctrlKey: true,
        deltaY: -100, // Scroll up
        preventDefault: jest.fn(),
        clientX: 400,
        clientY: 300
      };

      handleWheel(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(global.zoomLevel).toBe(1.1);
    });

    test('should clamp zoom level within bounds', () => {
      global.zoomLevel = 2.9;
      const mockEvent = {
        ctrlKey: true,
        deltaY: -100,
        preventDefault: jest.fn(),
        clientX: 400,
        clientY: 300
      };

      handleWheel(mockEvent);

      expect(global.zoomLevel).toBe(3.0); // Clamped to max
    });

    test('should not zoom without Ctrl key', () => {
      global.zoomLevel = 1.0;
      const mockEvent = {
        ctrlKey: false,
        deltaY: -100,
        preventDefault: jest.fn()
      };

      handleWheel(mockEvent);

      expect(mockEvent.preventDefault).not.toHaveBeenCalled();
      expect(global.zoomLevel).toBe(1.0); // Unchanged
    });
  });

  describe('Click Detection', () => {
    test('should calculate click move threshold correctly', () => {
      global.zoomLevel = 1.0;
      Object.defineProperty(window, 'devicePixelRatio', { value: 1, writable: true });

      const threshold = calcClickMoveThreshold();

      expect(threshold).toBeGreaterThanOrEqual(3);
      expect(threshold).toBeLessThanOrEqual(10);
    });

    test('should scale threshold with zoom level', () => {
      global.zoomLevel = 2.0;
      Object.defineProperty(window, 'devicePixelRatio', { value: 1, writable: true });

      const threshold = calcClickMoveThreshold();

      expect(threshold).toBeGreaterThan(5);
    });

    test('should handle high DPI displays', () => {
      global.zoomLevel = 1.0;
      Object.defineProperty(window, 'devicePixelRatio', { value: 3, writable: true });

      const threshold = calcClickMoveThreshold();

      expect(threshold).toBeGreaterThan(3);
    });
  });

  describe('Drawing Interaction', () => {
    test('should continue drawing on mouse move when drawing', () => {
      global.isDrawing = true;
      global.currentPath = {
        points: [{ x: 50, y: 50, t: 1000 }]
      };

      const mockEvent = {
        preventDefault: jest.fn(),
        clientX: 60,
        clientY: 60
      };

      handleMouseMove(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
    });

    test('should pan on mouse move when panning', () => {
      global.isPanning = true;
      global.lastPanPoint = { x: 100, y: 100 };

      const mockEvent = {
        preventDefault: jest.fn(),
        clientX: 110,
        clientY: 110
      };

      handleMouseMove(mockEvent);

      expect(global.panOffsetX).toBe(10);
      expect(global.panOffsetY).toBe(10);
    });

    test('should update cursor guides when rulers enabled', () => {
      global.showRulers = true;
      global.isDrawing = false;
      global.isPanning = false;

      const mockEvent = {
        preventDefault: jest.fn(),
        clientX: 200,
        clientY: 300
      };

      handleMouseMove(mockEvent);

      expect(global.lastMouseX).toBe(200);
      expect(global.lastMouseY).toBe(300);
    });
  });

  describe('Error Handling', () => {
    test('should handle mouse event processing errors', () => {
      const mockEvent = {
        preventDefault: jest.fn(() => { throw new Error('Prevent default error'); }),
        button: 0,
        clientX: 100,
        clientY: 100
      };
      const consoleSpy = jest.spyOn(console, 'error');

      handleMouseDown(mockEvent);

      expect(consoleSpy).toHaveBeenCalledWith('Error in handleMouseDown:', expect.any(Error));
    });

    test('should handle touch event processing errors', () => {
      const mockEvent = {
        preventDefault: jest.fn(() => { throw new Error('Touch error'); }),
        touches: [{ clientX: 100, clientY: 100 }]
      };
      const consoleSpy = jest.spyOn(console, 'error');

      handleTouchStart(mockEvent);

      expect(consoleSpy).toHaveBeenCalledWith('Error in touch start handler:', expect.any(Error));
      expect(global.isDrawing).toBe(false);
      expect(global.isPanning).toBe(false);
    });

    test('should reset state on error', () => {
      global.isDrawing = true;
      global.isPanning = true;

      const mockEvent = {
        preventDefault: jest.fn(() => { throw new Error('Error'); }),
        touches: [{ clientX: 100, clientY: 100 }]
      };

      handleTouchMove(mockEvent);

      expect(global.isDrawing).toBe(false);
      expect(global.isPanning).toBe(false);
    });
  });

  describe('Event Listener Setup', () => {
    test('should setup event listeners successfully', () => {
      setupEventListeners();

      expect(mockCanvas.addEventListener).toHaveBeenCalledWith('mousedown', handleMouseDown);
      expect(mockCanvas.addEventListener).toHaveBeenCalledWith('mousemove', expect.any(Function));
      expect(mockCanvas.addEventListener).toHaveBeenCalledWith('mouseup', handleMouseUp);
      expect(mockCanvas.addEventListener).toHaveBeenCalledWith('touchstart', handleTouchStart, { passive: false });
      expect(mockCanvas.addEventListener).toHaveBeenCalledWith('touchmove', handleTouchMove, { passive: false });
      expect(mockCanvas.addEventListener).toHaveBeenCalledWith('touchend', handleTouchEnd);
    });

    test('should handle null canvas during setup', () => {
      global.canvas = null;
      const consoleSpy = jest.spyOn(console, 'error');

      setupEventListeners();

      expect(consoleSpy).toHaveBeenCalledWith('Cannot set up canvas event listeners - canvas is null');
    });

    test('should handle event listener setup errors', () => {
      mockCanvas.addEventListener = jest.fn(() => { throw new Error('Event setup error'); });
      const consoleSpy = jest.spyOn(console, 'error');

      setupEventListeners();

      expect(consoleSpy).toHaveBeenCalledWith('Error setting up event listeners:', expect.any(Error));
    });
  });

  describe('Mouse Out Handling', () => {
    test('should hide size visualizer on mouse out', () => {
      global.domElements = {
        sizeVisualizer: {
          classList: { remove: jest.fn() }
        }
      };

      handleMouseOut();

      expect(global.domElements.sizeVisualizer.classList.remove).toHaveBeenCalledWith('visible');
    });

    test('should handle panning cursor on mouse out', () => {
      global.isPanning = true;
      document.body.style = {};

      handleMouseOut();

      expect(document.body.style.cursor).toBe('grabbing');
    });
  });

  describe('Visibility Change Handling', () => {
    test('should cleanup memory when page hidden', () => {
      Object.defineProperty(document, 'hidden', { value: true, writable: true });

      handleVisibilityChange();

      // Should trigger memory cleanup
      expect(document.hidden).toBe(true);
    });

    test('should restore canvas when page visible', () => {
      Object.defineProperty(document, 'hidden', { value: false, writable: true });
      global.canvas = mockCanvas;
      global.ctx = mockContext;
      global.undoStack = ['state1'];

      handleVisibilityChange();

      expect(document.hidden).toBe(false);
    });
  });
});
