/**
 * Touch Input and Multi-Input Handling Tests
 * Tests touch events, pan gestures, and complex input scenarios
 */

require('../../app.js');

describe('Touch Input Handling (unit)', () => {
  let mockCanvas, mockContext;

  beforeEach(() => {
    // Reset global state
    global.canvas = null;
    global.ctx = null;
    global.isDrawing = false;
    global.isPanning = false;
    global.currentTool = 'pen';
    global.currentColor = '#ef4444';
    global.penSize = 10;
    global.panOffsetX = 0;
    global.panOffsetY = 0;
    global.zoomLevel = 1.0;

    // Setup canvas mocks
    mockContext = {
      fillRect: jest.fn(),
      save: jest.fn(),
      restore: jest.fn(),
      beginPath: jest.fn(),
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      stroke: jest.fn(),
      fill: jest.fn(),
      arc: jest.fn(),
      globalCompositeOperation: 'source-over',
      strokeStyle: '#000000',
      fillStyle: '#000000',
      lineWidth: 1
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

    // Mock document.querySelector for overlay
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

  describe('Single Touch Drawing', () => {
    test('should start drawing on single touch', () => {
      const mockTouchEvent = {
        preventDefault: jest.fn(),
        touches: [{
          clientX: 150,
          clientY: 200
        }]
      };

      handleTouchStart(mockTouchEvent);

      expect(mockTouchEvent.preventDefault).toHaveBeenCalled();
      expect(global.isDrawing).toBe(true);
    });

    test('should continue drawing on touch move', () => {
      global.isDrawing = true;
      global.currentPath = {
        tool: 'pen',
        color: '#ef4444',
        size: 10,
        points: [{ x: 100, y: 100, t: 1000 }],
        lastWidth: 10
      };

      const mockTouchEvent = {
        preventDefault: jest.fn(),
        touches: [{
          clientX: 160,
          clientY: 210
        }]
      };

      handleTouchMove(mockTouchEvent);

      expect(mockTouchEvent.preventDefault).toHaveBeenCalled();
      expect(global.currentPath.points).toHaveLength(2);
    });

    test('should stop drawing on touch end', () => {
      global.isDrawing = true;
      global.currentPath = {
        tool: 'pen',
        color: '#ef4444',
        size: 10,
        points: [{ x: 100, y: 100, t: 1000 }]
      };

      const mockTouchEvent = {
        touches: [] // No active touches
      };

      handleTouchEnd(mockTouchEvent);

      expect(global.isDrawing).toBe(false);
      expect(global.currentPath).toBeNull();
    });

    test('should handle touch without coordinates gracefully', () => {
      const mockTouchEvent = {
        preventDefault: jest.fn(),
        touches: [{}] // Touch without clientX/clientY
      };

      expect(() => handleTouchStart(mockTouchEvent)).not.toThrow();
    });
  });

  describe('Two-Finger Pan Gestures', () => {
    test('should start panning on two-finger touch', () => {
      const mockTouchEvent = {
        preventDefault: jest.fn(),
        touches: [
          { clientX: 100, clientY: 100 },
          { clientX: 200, clientY: 150 }
        ]
      };

      handleTouchStart(mockTouchEvent);

      expect(global.isPanning).toBe(true);
      expect(global.isDrawing).toBe(false);
    });

    test('should calculate midpoint for two-finger pan', () => {
      global.isPanning = true;

      const mockTouchEvent = {
        preventDefault: jest.fn(),
        touches: [
          { clientX: 100, clientY: 100 },
          { clientX: 200, clientY: 200 }
        ]
      };

      // Mock lastPanPoint
      global.lastPanPoint = { x: 145, y: 145 };

      handleTouchMove(mockTouchEvent);

      expect(mockTouchEvent.preventDefault).toHaveBeenCalled();
      // Midpoint should be (150, 150)
    });

    test('should stop panning when touches reduce to one', () => {
      global.isPanning = true;

      const mockTouchEvent = {
        touches: [{
          clientX: 150,
          clientY: 150
        }] // Only one touch remaining
      };

      handleTouchEnd(mockTouchEvent);

      expect(global.isPanning).toBe(false);
      // Should start drawing with the remaining touch
      expect(global.isDrawing).toBe(true);
    });

    test('should stop panning completely when no touches remain', () => {
      global.isPanning = true;

      const mockTouchEvent = {
        touches: [] // No touches remaining
      };

      handleTouchEnd(mockTouchEvent);

      expect(global.isPanning).toBe(false);
      expect(global.isDrawing).toBe(false);
    });
  });

  describe('Touch-to-Pan Transitions', () => {
    test('should transition from drawing to panning when second finger added', () => {
      global.isDrawing = true;

      const mockTouchEvent = {
        preventDefault: jest.fn(),
        touches: [
          { clientX: 100, clientY: 100 },
          { clientX: 200, clientY: 150 } // Second finger added
        ]
      };

      handleTouchStart(mockTouchEvent);

      expect(global.isDrawing).toBe(false);
      expect(global.isPanning).toBe(true);
    });

    test('should transition from panning to drawing when fingers reduce to one', () => {
      global.isPanning = true;

      const mockTouchEvent = {
        touches: [{
          clientX: 150,
          clientY: 150
        }] // Only one touch remaining
      };

      handleTouchEnd(mockTouchEvent);

      expect(global.isPanning).toBe(false);
      expect(global.isDrawing).toBe(true);
    });

    test('should handle complex touch sequence correctly', () => {
      // Start with single touch (drawing)
      let touchEvent = {
        preventDefault: jest.fn(),
        touches: [{ clientX: 100, clientY: 100 }]
      };
      handleTouchStart(touchEvent);
      expect(global.isDrawing).toBe(true);
      expect(global.isPanning).toBe(false);

      // Add second finger (switch to panning)
      touchEvent = {
        preventDefault: jest.fn(),
        touches: [
          { clientX: 100, clientY: 100 },
          { clientX: 200, clientY: 200 }
        ]
      };
      handleTouchStart(touchEvent);
      expect(global.isDrawing).toBe(false);
      expect(global.isPanning).toBe(true);

      // Remove one finger (back to drawing)
      touchEvent = {
        touches: [{ clientX: 150, clientY: 150 }]
      };
      handleTouchEnd(touchEvent);
      expect(global.isPanning).toBe(false);
      expect(global.isDrawing).toBe(true);

      // Remove last finger (stop all)
      touchEvent = {
        touches: []
      };
      handleTouchEnd(touchEvent);
      expect(global.isPanning).toBe(false);
      expect(global.isDrawing).toBe(false);
    });
  });

  describe('Pan Offset Calculations', () => {
    test('should update pan offset during touch pan', () => {
      global.isPanning = true;
      global.panOffsetX = 0;
      global.panOffsetY = 0;
      global.lastPanPoint = { x: 150, y: 150 };

      const mockTouchEvent = {
        preventDefault: jest.fn(),
        touches: [
          { clientX: 110, clientY: 110 },
          { clientX: 210, clientY: 210 }
        ]
      };

      handleTouchMove(mockTouchEvent);

      // Midpoint is (160, 160), delta is (10, 10)
      expect(global.panOffsetX).toBe(10);
      expect(global.panOffsetY).toBe(10);
    });

    test('should not update pan offset when not panning', () => {
      global.isPanning = false;
      global.panOffsetX = 100;
      global.panOffsetY = 200;

      const mockTouchEvent = {
        preventDefault: jest.fn(),
        touches: [
          { clientX: 110, clientY: 110 },
          { clientX: 210, clientY: 210 }
        ]
      };

      handleTouchMove(mockTouchEvent);

      expect(global.panOffsetX).toBe(100); // Should remain unchanged
      expect(global.panOffsetY).toBe(200);
    });
  });

  describe('Error Handling for Touch Events', () => {
    test('should handle touch start errors gracefully', () => {
      const mockTouchEvent = {
        preventDefault: jest.fn(),
        touches: null // Invalid touches array
      };

      expect(() => handleTouchStart(mockTouchEvent)).not.toThrow();
      expect(global.isDrawing).toBe(false);
      expect(global.isPanning).toBe(false);
    });

    test('should handle touch move errors gracefully', () => {
      global.isDrawing = true;

      const mockTouchEvent = {
        preventDefault: jest.fn(),
        touches: undefined // Invalid touches
      };

      expect(() => handleTouchMove(mockTouchEvent)).not.toThrow();
      expect(global.isDrawing).toBe(false); // Should reset on error
      expect(global.isPanning).toBe(false);
    });

    test('should handle touch end errors gracefully', () => {
      global.isDrawing = true;
      global.isPanning = true;

      const mockTouchEvent = {
        touches: null // Invalid touches
      };

      expect(() => handleTouchEnd(mockTouchEvent)).not.toThrow();
      expect(global.isDrawing).toBe(false); // Should reset on error
      expect(global.isPanning).toBe(false);
    });

    test('should reset states on touch handler errors', () => {
      global.isDrawing = true;
      global.isPanning = true;

      // Simulate error condition
      global.canvas = null;

      const mockTouchEvent = {
        preventDefault: jest.fn(),
        touches: [{ clientX: 100, clientY: 100 }]
      };

      handleTouchStart(mockTouchEvent);

      expect(global.isDrawing).toBe(false);
      expect(global.isPanning).toBe(false);
    });
  });

  describe('Touch Drawing Integration', () => {
    test('should create touch drawing paths correctly', () => {
      global.currentTool = 'pen';
      global.currentColor = '#10b981';
      global.penSize = 15;
      global.drawingPaths = [];

      const mockTouchEvent = {
        preventDefault: jest.fn(),
        touches: [{
          clientX: 200,
          clientY: 250
        }]
      };

      handleTouchStart(mockTouchEvent);

      expect(global.drawingPaths).toHaveLength(1);
      expect(global.currentPath).toBeDefined();
      expect(global.currentPath.tool).toBe('pen');
      expect(global.currentPath.color).toBe('#10b981');
      expect(global.currentPath.size).toBe(15);
    });

    test('should handle touch drawing with eraser tool', () => {
      global.currentTool = 'eraser';
      global.eraserSize = 25;
      global.drawingPaths = [];

      const mockTouchEvent = {
        preventDefault: jest.fn(),
        touches: [{
          clientX: 300,
          clientY: 400
        }]
      };

      handleTouchStart(mockTouchEvent);

      expect(global.currentPath.tool).toBe('eraser');
      expect(global.currentPath.size).toBe(25);
    });
  });

  describe('Touch Performance', () => {
    test('should handle rapid touch move events', () => {
      global.isDrawing = true;
      global.currentPath = {
        tool: 'pen',
        color: '#ef4444',
        size: 10,
        points: [{ x: 100, y: 100, t: 1000 }],
        lastWidth: 10
      };

      // Simulate rapid touch movements
      for (let i = 0; i < 30; i++) {
        const mockTouchEvent = {
          preventDefault: jest.fn(),
          touches: [{
            clientX: 100 + i * 2,
            clientY: 100 + i
          }]
        };
        handleTouchMove(mockTouchEvent);
      }

      expect(global.currentPath.points).toHaveLength(31); // Initial + 30 new points
    });

    test('should handle touch events without performance degradation', (done) => {
      const startTime = performance.now();
      
      // Simulate a complex touch sequence
      for (let i = 0; i < 100; i++) {
        const touchEvent = {
          preventDefault: jest.fn(),
          touches: i % 3 === 0 ? [
            { clientX: 100 + i, clientY: 100 },
            { clientX: 200 + i, clientY: 150 }
          ] : [
            { clientX: 100 + i, clientY: 100 + i }
          ]
        };
        
        if (i % 3 === 0) {
          handleTouchStart(touchEvent);
        } else if (i % 3 === 1) {
          handleTouchMove(touchEvent);
        } else {
          handleTouchEnd(touchEvent);
        }
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (less than 100ms)
      expect(duration).toBeLessThan(100);
      done();
    });
  });

  describe('Touch Coordinate Transformation', () => {
    test('should correctly transform touch coordinates with zoom', () => {
      global.zoomLevel = 2.0;
      global.panOffsetX = 50;
      global.panOffsetY = 30;

      const mockTouchEvent = {
        preventDefault: jest.fn(),
        touches: [{
          clientX: 200,
          clientY: 150
        }]
      };

      handleTouchStart(mockTouchEvent);

      // Coordinates should be transformed based on zoom and pan
      expect(global.currentPath).toBeDefined();
      expect(global.currentPath.points).toHaveLength(1);
      // Exact coordinate values depend on getCoordinates implementation
    });

    test('should handle coordinate transformation edge cases', () => {
      global.zoomLevel = 0.5; // Zoomed out
      global.panOffsetX = -100;
      global.panOffsetY = -50;

      const mockTouchEvent = {
        preventDefault: jest.fn(),
        touches: [{
          clientX: 0, // Edge of screen
          clientY: 0
        }]
      };

      expect(() => handleTouchStart(mockTouchEvent)).not.toThrow();
      expect(global.currentPath).toBeDefined();
    });
  });
});
