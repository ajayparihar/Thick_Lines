/**
 * Unit Tests for Canvas Core Functionality
 * Tests initialization, setup, and basic canvas operations
 */

// Load the application code
require('../../app.js');

describe('Canvas Core (unit)', () => {
  let originalGetElementById;
  let mockCanvas;
  let mockContext;

  beforeEach(() => {
    // Reset global variables
    global.canvas = null;
    global.ctx = null;
    global.appInitialized = false;
    global.currentColor = '#ef4444';
    global.currentTool = 'pen';
    global.penSize = 10;
    global.eraserSize = 10;
    global.zoomLevel = 1.0;
    global.panOffsetX = 0;
    global.panOffsetY = 0;
    global.undoStack = [];
    global.redoStack = [];
    global.isDrawing = false;
    global.isPanning = false;

    // Setup fresh mocks
    mockContext = {
      fillRect: jest.fn(),
      clearRect: jest.fn(),
      save: jest.fn(),
      restore: jest.fn(),
      setTransform: jest.fn(),
      scale: jest.fn(),
      drawImage: jest.fn(),
      beginPath: jest.fn(),
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      stroke: jest.fn(),
      fill: jest.fn(),
      arc: jest.fn(),
      quadraticCurveTo: jest.fn(),
      fillText: jest.fn(),
      measureText: jest.fn(() => ({ width: 0 })),
      getLineDash: jest.fn(() => []),
      setLineDash: jest.fn(),
      font: '10px sans-serif',
      strokeStyle: '#000000',
      lineWidth: 1,
      lineCap: 'butt',
      lineJoin: 'miter',
      textAlign: 'start',
      textBaseline: 'alphabetic',
      fillStyle: '#1e293b',
      globalCompositeOperation: 'source-over',
      bezierCurveTo: jest.fn(),
      clip: jest.fn(),
      closePath: jest.fn(),
      createLinearGradient: jest.fn(),
      createRadialGradient: jest.fn(),
      getImageData: jest.fn(),
      globalAlpha: 1,
      putImageData: jest.fn(),
      rotate: jest.fn(),
      strokeRect: jest.fn(),
      strokeText: jest.fn(),
      toDataURL: jest.fn(),
      translate: jest.fn()
    };

    mockCanvas = {
      getContext: jest.fn(() => mockContext),
      width: 800,
      height: 600,
      style: {},
      toDataURL: jest.fn(() => 'data:image/png;base64,mock-canvas-data'),
      addEventListener: jest.fn(),
      getBoundingClientRect: jest.fn(() => ({
        left: 0, top: 0, width: 800, height: 600
      }))
    };

    // Mock document.getElementById for canvas
    originalGetElementById = document.getElementById;
    document.getElementById = jest.fn((id) => {
      if (id === 'drawing-canvas') return mockCanvas;
      if (id === 'whiteboard') return { clientWidth: 800, clientHeight: 600 };
      return {
        addEventListener: jest.fn(),
        classList: { add: jest.fn(), remove: jest.fn(), toggle: jest.fn() },
        style: {},
        innerHTML: '',
        disabled: false
      };
    });
  });

  afterEach(() => {
    document.getElementById = originalGetElementById;
    jest.clearAllMocks();
  });

  describe('Application Initialization', () => {
    test('should initialize app successfully', () => {
      // Mock window properties
      Object.defineProperty(window, 'devicePixelRatio', { value: 1, writable: true });
      
      // Call init function
      init();

      expect(global.appInitialized).toBe(true);
      expect(global.canvas).toBeDefined();
      expect(global.canvas.style).toBeDefined();
      expect(global.ctx).toBeDefined();
      expect(mockCanvas.getContext).toHaveBeenCalledWith('2d', {
        alpha: true,
        desynchronized: true
      });
    });

    test('should handle missing canvas element gracefully', () => {
      document.getElementById = jest.fn(() => null);
      init();
      expect(global.appInitialized).toBe(false);
    });

    test('should prevent multiple initializations', () => {
      global.appInitialized = true;
      const consoleSpy = jest.spyOn(console, 'log');
      
      init();

      expect(consoleSpy).toHaveBeenCalledWith('App already initialized, skipping init');
    });

    test('should handle context creation failure', () => {
      mockCanvas.getContext = jest.fn(() => null);
      init();
      expect(global.appInitialized).toBe(false);
    });
  });

  describe('Canvas Resize Functionality', () => {
    beforeEach(() => {
      global.canvas = mockCanvas;
      global.ctx = mockContext;
      global.undoStack = ['initial-state'];
    });

    test('should resize canvas properly', () => {
      Object.defineProperty(window, 'devicePixelRatio', { value: 2, writable: true });
      
      resizeCanvas();

      expect(mockCanvas.width).toBe(1600); // 800 * 2
      expect(mockCanvas.height).toBe(1200); // 600 * 2
      expect(mockContext.scale).toHaveBeenCalledWith(2, 2);
    });

    test('should handle missing elements gracefully', () => {
      document.getElementById = jest.fn(() => null);
      
      resizeCanvas();

      // Should not throw error
      expect(true).toBe(true);
    });

    test('should restore canvas state after resize', () => {
      global.undoStack = ['data:image/png;base64,test-state'];
      
      resizeCanvas();

      expect(mockContext.fillStyle).toBe('#1e293b');
      expect(mockContext.fillRect).toHaveBeenCalled();
    });
  });

  describe('Utility Functions', () => {
    test('debounce should delay function execution', (done) => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 100);
      
      debouncedFn();
      debouncedFn();
      debouncedFn();

      expect(mockFn).not.toHaveBeenCalled();

      setTimeout(() => {
        expect(mockFn).toHaveBeenCalledTimes(1);
        done();
      }, 150);
    });

    test('throttle should limit function calls', () => {
      const mockFn = jest.fn();
      const throttledFn = throttle(mockFn, 100);
      
      throttledFn();
      throttledFn();
      throttledFn();

      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    test('createTooltip should create and append tooltip element', () => {
      const appendChildSpy = jest.spyOn(document.body, 'appendChild');
      
      const tooltip = createTooltip();

      expect(tooltip.className).toBe('tooltip');
      expect(appendChildSpy).toHaveBeenCalledWith(tooltip);
    });
  });

  describe('Coordinate System', () => {
    beforeEach(() => {
      global.canvas = mockCanvas;
      global.zoomLevel = 1.0;
      global.panOffsetX = 0;
      global.panOffsetY = 0;
    });

    test('should calculate mouse coordinates correctly', () => {
      const mockEvent = {
        clientX: 100,
        clientY: 150
      };

      const coords = getCoordinates(mockEvent);

      expect(coords.x).toBe(100);
      expect(coords.y).toBe(150);
    });

    test('should handle touch coordinates correctly', () => {
      const mockEvent = {
        touches: [{
          clientX: 200,
          clientY: 250
        }]
      };

      const coords = getCoordinates(mockEvent);

      expect(coords.x).toBe(200);
      expect(coords.y).toBe(250);
    });

    test('should adjust coordinates for zoom and pan', () => {
      global.zoomLevel = 2.0;
      global.panOffsetX = 50;
      global.panOffsetY = 100;

      const mockEvent = {
        clientX: 200,
        clientY: 300
      };

      const coords = getCoordinates(mockEvent);

      expect(coords.x).toBe(75); // (200 - 50) / 2
      expect(coords.y).toBe(100); // (300 - 100) / 2
    });

    test('should handle null canvas gracefully', () => {
      global.canvas = null;

      const coords = getCoordinates({ clientX: 100, clientY: 100 });

      expect(coords.x).toBe(0);
      expect(coords.y).toBe(0);
    });
  });

  describe('Transform System', () => {
    beforeEach(() => {
      global.ctx = mockContext;
      global.zoomLevel = 1.5;
      global.panOffsetX = 100;
      global.panOffsetY = 200;
    });

    test('should apply transform without animation', () => {
      applyTransform(false);

      expect(mockContext.setTransform).toHaveBeenCalledWith(1, 0, 0, 1, 0, 0);
      expect(mockContext.setTransform).toHaveBeenCalledWith(1.5, 0, 0, 1.5, 100, 200);
    });

    test('should reset zoom level when out of bounds', () => {
      global.zoomLevel = 5.0; // Above max
      const mockEvent = {
        ctrlKey: true,
        deltaY: -100, // Scroll up
        preventDefault: jest.fn(),
        clientX: 400,
        clientY: 300
      };
      handleWheel(mockEvent);
      expect(global.zoomLevel).toBe(3.0);
    });
  });

  describe('Error Handling', () => {
    test('should handle canvas context errors gracefully', () => {
      mockCanvas.getContext = jest.fn(() => { throw new Error('Context error'); });
      
      expect(() => init()).not.toThrow();
      expect(global.appInitialized).toBe(false);
    });

    test('should handle coordinate calculation errors', () => {
      global.canvas = null;
      
      const coords = getCoordinates({ clientX: 100, clientY: 100 });

      expect(coords).toEqual({ x: 0, y: 0 });
    });
  });

  describe('Canvas Clearing', () => {
    beforeEach(() => {
      global.canvas = mockCanvas;
      global.ctx = mockContext;
      global.undoStack = ['initial-state'];
      global.redoStack = [];
    });

    test('should clear the canvas after confirmation', () => {
      const confirmSpy = jest.spyOn(window, 'confirm').mockImplementation(() => true);
      clearCanvas();
      expect(confirmSpy).toHaveBeenCalled();
      expect(mockContext.setTransform).toHaveBeenCalledWith(1, 0, 0, 1, 0, 0);
      expect(mockContext.fillRect).toHaveBeenCalledWith(0, 0, mockCanvas.width, mockCanvas.height);
      expect(global.undoStack.length).toBe(1);
      expect(global.redoStack.length).toBe(0);
      confirmSpy.mockRestore();
    });

    test('should not clear the canvas if confirmation is denied', () => {
      const confirmSpy = jest.spyOn(window, 'confirm').mockImplementation(() => false);
      clearCanvas();
      expect(confirmSpy).toHaveBeenCalled();
      expect(mockContext.fillRect).not.toHaveBeenCalled();
      confirmSpy.mockRestore();
    });
  });
});
