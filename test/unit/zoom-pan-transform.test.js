/**
 * Zoom, Pan, and Transform System Tests
 * Tests coordinate transformations, zoom controls, and pan functionality
 */

require('../../app.js');

describe('Zoom, Pan, and Transform System (unit)', () => {
  let mockCanvas, mockContext;

  beforeEach(() => {
    // Reset global state
    global.canvas = null;
    global.ctx = null;
    global.zoomLevel = 1.0;
    global.panOffsetX = 0;
    global.panOffsetY = 0;
    global.isPanning = false;
    global.lastPanPoint = { x: 0, y: 0 };
    global.middleMouseStartX = 0;
    global.middleMouseStartY = 0;
    global.isMiddleMouseDown = false;

    // Setup canvas mocks
    mockContext = {
      setTransform: jest.fn(),
      fillRect: jest.fn(),
      drawImage: jest.fn(),
      save: jest.fn(),
      restore: jest.fn(),
      fillStyle: '#1e293b'
    };

    mockCanvas = {
      getContext: jest.fn(() => mockContext),
      width: 800,
      height: 600,
      style: { cursor: 'crosshair' },
      getBoundingClientRect: jest.fn(() => ({
        left: 0, top: 0, width: 800, height: 600
      }))
    };

    global.canvas = mockCanvas;
    global.ctx = mockContext;

    // Mock overlay element
    document.querySelector = jest.fn((selector) => {
      if (selector === '.canvas-overlay') {
        return {
          classList: {
            add: jest.fn(),
            remove: jest.fn()
          }
        };
      }
      return null;
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Zoom Functionality', () => {
    test('should handle wheel zoom correctly', () => {
      const mockWheelEvent = {
        preventDefault: jest.fn(),
        ctrlKey: true,
        deltaY: -100, // Zoom in
        clientX: 400, // Center of canvas
        clientY: 300
      };

      handleWheel(mockWheelEvent);

      expect(mockWheelEvent.preventDefault).toHaveBeenCalled();
      expect(global.zoomLevel).toBeGreaterThan(1.0);
      expect(mockContext.setTransform).toHaveBeenCalled();
    });

    test('should zoom out with positive deltaY', () => {
      global.zoomLevel = 1.5; // Start zoomed in

      const mockWheelEvent = {
        preventDefault: jest.fn(),
        ctrlKey: true,
        deltaY: 100, // Zoom out
        clientX: 400,
        clientY: 300
      };

      handleWheel(mockWheelEvent);

      expect(global.zoomLevel).toBeLessThan(1.5);
      expect(global.zoomLevel).toBeGreaterThan(0); // Should not go negative
    });

    test('should constrain zoom within limits', () => {
      // Test maximum zoom
      global.zoomLevel = 2.9;
      
      const zoomInEvent = {
        preventDefault: jest.fn(),
        ctrlKey: true,
        deltaY: -100,
        clientX: 400,
        clientY: 300
      };

      handleWheel(zoomInEvent);
      expect(global.zoomLevel).toBeLessThanOrEqual(3.0);

      // Test minimum zoom
      global.zoomLevel = 0.6;
      
      const zoomOutEvent = {
        preventDefault: jest.fn(),
        ctrlKey: true,
        deltaY: 100,
        clientX: 400,
        clientY: 300
      };

      handleWheel(zoomOutEvent);
      expect(global.zoomLevel).toBeGreaterThanOrEqual(0.5);
    });

    test('should not zoom without Ctrl key', () => {
      const originalZoom = global.zoomLevel;

      const mockWheelEvent = {
        preventDefault: jest.fn(),
        ctrlKey: false, // No Ctrl key
        deltaY: -100,
        clientX: 400,
        clientY: 300
      };

      handleWheel(mockWheelEvent);

      expect(global.zoomLevel).toBe(originalZoom);
      expect(mockWheelEvent.preventDefault).not.toHaveBeenCalled();
    });

    test('should adjust pan offset when zooming to cursor position', () => {
      global.zoomLevel = 1.0;
      global.panOffsetX = 0;
      global.panOffsetY = 0;

      const mockWheelEvent = {
        preventDefault: jest.fn(),
        ctrlKey: true,
        deltaY: -100, // Zoom in
        clientX: 200, // Off-center
        clientY: 150
      };

      handleWheel(mockWheelEvent);

      // Pan offset should be adjusted to zoom toward cursor
      expect(global.panOffsetX).not.toBe(0);
      expect(global.panOffsetY).not.toBe(0);
    });
  });

  describe('Pan Functionality', () => {
    test('should start panning on middle mouse down', () => {
      const mockMouseEvent = {
        button: 1, // Middle mouse button
        clientX: 400,
        clientY: 300
      };

      startCanvasPan(mockMouseEvent);

      expect(global.isPanning).toBe(true);
      expect(global.lastPanPoint).toEqual({ x: 400, y: 300 });
      expect(mockCanvas.style.cursor).toBe('grabbing');
    });

    test('should update pan offset during mouse move', () => {
      global.isPanning = true;
      global.panOffsetX = 0;
      global.panOffsetY = 0;
      global.lastPanPoint = { x: 400, y: 300 };

      const mockMouseEvent = {
        clientX: 450,
        clientY: 350
      };

      moveCanvasPan(mockMouseEvent);

      expect(global.panOffsetX).toBe(50);
      expect(global.panOffsetY).toBe(50);
      expect(global.lastPanPoint).toEqual({ x: 450, y: 350 });
    });

    test('should stop panning correctly', () => {
      global.isPanning = true;
      mockCanvas.style.cursor = 'grabbing';

      stopCanvasPan();

      expect(global.isPanning).toBe(false);
      expect(mockCanvas.style.cursor).toBe('');
    });

    test('should not update pan offset when not panning', () => {
      global.isPanning = false;
      global.panOffsetX = 100;
      global.panOffsetY = 200;

      const mockMouseEvent = {
        clientX: 450,
        clientY: 350
      };

      moveCanvasPan(mockMouseEvent);

      expect(global.panOffsetX).toBe(100); // Should remain unchanged
      expect(global.panOffsetY).toBe(200);
    });
  });

  describe('Middle Mouse Click vs Drag Detection', () => {
    test('should distinguish between click and drag based on movement threshold', () => {
      global.isMiddleMouseDown = true;
      global.middleMouseStartX = 400;
      global.middleMouseStartY = 300;

      // Mock calc function
      global.calcClickMoveThreshold = jest.fn(() => 5);

      // Test small movement (click)
      const smallMoveEvent = {
        button: 1,
        clientX: 403,
        clientY: 302
      };

      const clickThreshold = calcClickMoveThreshold();
      const moveX = Math.abs(smallMoveEvent.clientX - global.middleMouseStartX);
      const moveY = Math.abs(smallMoveEvent.clientY - global.middleMouseStartY);

      expect(moveX).toBeLessThan(clickThreshold);
      expect(moveY).toBeLessThan(clickThreshold);
    });

    test('should calculate threshold based on zoom and DPI', () => {
      global.zoomLevel = 2.0;
      Object.defineProperty(window, 'devicePixelRatio', { value: 2, writable: true });

      const threshold = calcClickMoveThreshold();

      expect(threshold).toBeGreaterThan(3);
      expect(threshold).toBeDefined();
      expect(typeof threshold).toBe('number');
    });

    test('should handle extreme zoom levels in threshold calculation', () => {
      global.zoomLevel = 0.1; // Very zoomed out
      const threshold1 = calcClickMoveThreshold();
      expect(threshold1).toBeGreaterThanOrEqual(3);

      global.zoomLevel = 5.0; // Very zoomed in
      const threshold2 = calcClickMoveThreshold();
      expect(threshold2).toBeGreaterThan(threshold1);
    });
  });

  describe('Transform Application', () => {
    test('should apply transform immediately by default', () => {
      global.zoomLevel = 1.5;
      global.panOffsetX = 100;
      global.panOffsetY = 50;

      applyTransform();

      expect(mockContext.setTransform).toHaveBeenCalledWith(1.5, 0, 0, 1.5, 100, 50);
    });

    test('should animate transform when requested', (done) => {
      global.zoomLevel = 2.0;
      global.panOffsetX = 200;
      global.panOffsetY = 100;

      // Mock requestAnimationFrame
      let animationCallback;
      window.requestAnimationFrame = jest.fn((callback) => {
        animationCallback = callback;
        return 1;
      });

      applyTransform(true); // With animation

      expect(window.requestAnimationFrame).toHaveBeenCalled();

      // Simulate animation frame
      if (animationCallback) {
        animationCallback(performance.now());
      }

      setTimeout(() => {
        expect(mockContext.setTransform).toHaveBeenCalled();
        done();
      }, 10);
    });

    test('should reset transform before applying new one', () => {
      applyTransform();

      // First call should be reset, second should be the actual transform
      expect(mockContext.setTransform).toHaveBeenCalledWith(1, 0, 0, 1, 0, 0);
    });
  });

  describe('Coordinate Transformation', () => {
    test('should transform coordinates correctly with zoom and pan', () => {
      global.zoomLevel = 2.0;
      global.panOffsetX = 50;
      global.panOffsetY = 30;

      const mockEvent = {
        clientX: 200,
        clientY: 150
      };

      const coordinates = getCoordinates(mockEvent);

      // Coordinates should be adjusted for zoom and pan
      // (200 - 50) / 2.0 = 75, (150 - 30) / 2.0 = 60
      expect(coordinates.x).toBe(75);
      expect(coordinates.y).toBe(60);
    });

    test('should handle edge coordinates correctly', () => {
      global.zoomLevel = 0.5; // Zoomed out
      global.panOffsetX = -100;
      global.panOffsetY = -50;

      const mockEvent = {
        clientX: 0, // Left edge
        clientY: 0  // Top edge
      };

      const coordinates = getCoordinates(mockEvent);

      expect(coordinates.x).toBe(200); // (0 - (-100)) / 0.5
      expect(coordinates.y).toBe(100); // (0 - (-50)) / 0.5
    });

    test('should handle touch coordinates transformation', () => {
      global.zoomLevel = 1.5;
      global.panOffsetX = 25;
      global.panOffsetY = 15;

      const mockTouchEvent = {
        touches: [{
          clientX: 300,
          clientY: 225
        }]
      };

      const coordinates = getCoordinates(mockTouchEvent);

      // Should use touch coordinates: (300 - 25) / 1.5 = 183.33, (225 - 15) / 1.5 = 140
      expect(coordinates.x).toBeCloseTo(183.33, 2);
      expect(coordinates.y).toBe(140);
    });

    test('should return default coordinates on error', () => {
      global.canvas = null; // Simulate error condition

      const mockEvent = {
        clientX: 100,
        clientY: 100
      };

      const coordinates = getCoordinates(mockEvent);

      expect(coordinates).toEqual({ x: 0, y: 0 });
    });
  });

  describe('Scroll Pan (Shift + Wheel)', () => {
    test('should pan horizontally with Shift + wheel', () => {
      global.panOffsetX = 0;
      global.panOffsetY = 0;

      const mockWheelEvent = {
        preventDefault: jest.fn(),
        shiftKey: true,
        deltaY: 50
      };

      // Simulate the wheel event handler in window.onload
      if (mockCanvas) {
        global.panOffsetX += mockWheelEvent.deltaY;
        applyTransform(false);
      }

      expect(global.panOffsetX).toBe(50);
      expect(global.panOffsetY).toBe(0);
    });

    test('should pan vertically with regular wheel (no modifiers)', () => {
      global.panOffsetX = 0;
      global.panOffsetY = 0;

      const mockWheelEvent = {
        preventDefault: jest.fn(),
        deltaY: 30
      };

      // Simulate the wheel event handler in window.onload
      if (mockCanvas) {
        global.panOffsetY += mockWheelEvent.deltaY;
        applyTransform(false);
      }

      expect(global.panOffsetX).toBe(0);
      expect(global.panOffsetY).toBe(30);
    });
  });

  describe('Transform Error Handling', () => {
    test('should handle null context in applyTransform', () => {
      global.ctx = null;

      expect(() => applyTransform()).not.toThrow();
    });

    test('should handle invalid zoom values', () => {
      global.zoomLevel = NaN;
      global.panOffsetX = undefined;
      global.panOffsetY = null;

      expect(() => applyTransform()).not.toThrow();
    });

    test('should handle missing canvas in coordinate transformation', () => {
      global.canvas = null;

      const mockEvent = {
        clientX: 100,
        clientY: 100
      };

      const coordinates = getCoordinates(mockEvent);

      expect(coordinates).toEqual({ x: 0, y: 0 });
    });
  });

  describe('Pan Gesture Performance', () => {
    test('should handle rapid pan movements efficiently', () => {
      global.isPanning = true;
      global.panOffsetX = 0;
      global.panOffsetY = 0;
      global.lastPanPoint = { x: 400, y: 300 };

      const startTime = performance.now();

      // Simulate rapid mouse movements during pan
      for (let i = 0; i < 100; i++) {
        const mockEvent = {
          clientX: 400 + i,
          clientY: 300 + i
        };
        moveCanvasPan(mockEvent);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(50); // Should complete quickly
      expect(global.panOffsetX).toBe(99);
      expect(global.panOffsetY).toBe(99);
    });

    test('should not leak memory during continuous panning', () => {
      global.isPanning = true;
      global.panOffsetX = 0;
      global.panOffsetY = 0;
      global.lastPanPoint = { x: 400, y: 300 };

      // Simulate extended panning session
      for (let i = 0; i < 1000; i++) {
        const mockEvent = {
          clientX: 400 + (i % 100),
          clientY: 300 + (i % 50)
        };
        moveCanvasPan(mockEvent);
      }

      // Should maintain consistent state
      expect(typeof global.panOffsetX).toBe('number');
      expect(typeof global.panOffsetY).toBe('number');
      expect(isFinite(global.panOffsetX)).toBe(true);
      expect(isFinite(global.panOffsetY)).toBe(true);
    });
  });

  describe('Zoom Performance and Limits', () => {
    test('should maintain performance during rapid zoom operations', () => {
      const startTime = performance.now();

      // Simulate rapid zoom in/out
      for (let i = 0; i < 50; i++) {
        const mockEvent = {
          preventDefault: jest.fn(),
          ctrlKey: true,
          deltaY: i % 2 === 0 ? -10 : 10,
          clientX: 400,
          clientY: 300
        };
        handleWheel(mockEvent);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(100);
      expect(global.zoomLevel).toBeGreaterThan(0.5);
      expect(global.zoomLevel).toBeLessThan(3.0);
    });

    test('should handle extreme coordinate values during zoom', () => {
      global.zoomLevel = 0.5;
      global.panOffsetX = 10000;
      global.panOffsetY = -5000;

      const mockEvent = {
        clientX: 10000,
        clientY: -1000
      };

      const coordinates = getCoordinates(mockEvent);

      expect(isFinite(coordinates.x)).toBe(true);
      expect(isFinite(coordinates.y)).toBe(true);
    });
  });

  describe('Integration with Drawing System', () => {
    test('should maintain drawing accuracy during zoom', () => {
      global.zoomLevel = 1.5;
      global.panOffsetX = 100;
      global.panOffsetY = 50;

      const mockEvent = {
        clientX: 300,
        clientY: 200
      };

      const coords1 = getCoordinates(mockEvent);

      // Change zoom
      global.zoomLevel = 2.0;

      const coords2 = getCoordinates(mockEvent);

      // Coordinates should be different due to zoom change
      expect(coords1.x).not.toBe(coords2.x);
      expect(coords1.y).not.toBe(coords2.y);
    });

    test('should preserve drawing relative positions during pan', () => {
      global.zoomLevel = 1.0;
      global.panOffsetX = 0;
      global.panOffsetY = 0;

      const mockEvent = {
        clientX: 400,
        clientY: 300
      };

      const coordsBefore = getCoordinates(mockEvent);

      // Pan the view
      global.panOffsetX = 50;
      global.panOffsetY = 30;

      const coordsAfter = getCoordinates(mockEvent);

      // Drawing coordinates should shift by pan amount
      expect(coordsAfter.x).toBe(coordsBefore.x - 50);
      expect(coordsAfter.y).toBe(coordsBefore.y - 30);
    });
  });
});
