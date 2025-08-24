/**
 * Advanced Drawing Engine Tests
 * Tests complex drawing scenarios, velocity-based pen width, and edge cases
 */

require('../../app.js');

describe('Advanced Drawing Engine (unit)', () => {
  let mockCanvas, mockContext;

  beforeEach(() => {
    // Reset global state
    global.canvas = null;
    global.ctx = null;
    global.appInitialized = false;
    global.currentColor = '#ef4444';
    global.currentTool = 'pen';
    global.penSize = 10;
    global.eraserSize = 10;
    global.isDrawing = false;
    global.currentPath = null;
    global.drawingPaths = [];

    // Setup canvas mocks
    mockContext = {
      fillRect: jest.fn(),
      clearRect: jest.fn(),
      save: jest.fn(),
      restore: jest.fn(),
      beginPath: jest.fn(),
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      quadraticCurveTo: jest.fn(),
      stroke: jest.fn(),
      fill: jest.fn(),
      arc: jest.fn(),
      strokeStyle: '#000000',
      fillStyle: '#000000',
      lineWidth: 1,
      lineCap: 'round',
      lineJoin: 'round',
      globalCompositeOperation: 'source-over'
    };

    mockCanvas = {
      getContext: jest.fn(() => mockContext),
      width: 800,
      height: 600,
      getBoundingClientRect: jest.fn(() => ({
        left: 0, top: 0, width: 800, height: 600
      }))
    };

    global.canvas = mockCanvas;
    global.ctx = mockContext;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Velocity-Based Pen Width', () => {
    test('should calculate pen width based on drawing velocity', () => {
      global.currentTool = 'pen';
      global.penSize = 20;
      
      // Create a path with velocity data
      const prevPoint = { x: 100, y: 100, t: 1000 };
      const currentPoint = { x: 150, y: 100, t: 1010 }; // Fast movement
      
      global.currentPath = {
        tool: 'pen',
        color: '#ef4444',
        size: 20,
        points: [{ x: 90, y: 100, t: 990 }, prevPoint],
        lastWidth: 20
      };

      drawPenPath(prevPoint, currentPoint);

      // Verify stroke was called with dynamic width
      expect(mockContext.stroke).toHaveBeenCalled();
      expect(mockContext.lineWidth).toBeDefined();
      expect(mockContext.quadraticCurveTo).toHaveBeenCalled();
    });

    test('should handle slow drawing movements', () => {
      global.currentTool = 'pen';
      global.penSize = 10;
      
      const prevPoint = { x: 100, y: 100, t: 1000 };
      const currentPoint = { x: 102, y: 101, t: 1100 }; // Slow movement
      
      global.currentPath = {
        tool: 'pen',
        color: '#ef4444',
        size: 10,
        points: [{ x: 98, y: 99, t: 900 }, prevPoint],
        lastWidth: 10
      };

      drawPenPath(prevPoint, currentPoint);

      expect(mockContext.stroke).toHaveBeenCalled();
    });

    test('should handle missing velocity data gracefully', () => {
      global.currentTool = 'pen';
      global.penSize = 15;
      
      const prevPoint = { x: 100, y: 100 }; // No timestamp
      const currentPoint = { x: 110, y: 110 }; // No timestamp
      
      global.currentPath = {
        tool: 'pen',
        color: '#ef4444',
        size: 15,
        points: [prevPoint],
        lastWidth: 15
      };

      drawPenPath(prevPoint, currentPoint);

      expect(mockContext.stroke).toHaveBeenCalled();
      expect(mockContext.lineWidth).toBe(15); // Should fallback to pen size
    });
  });

  describe('Smooth Curve Drawing', () => {
    test('should draw quadratic curves for smooth paths', () => {
      global.currentTool = 'pen';
      
      const p0 = { x: 90, y: 100, t: 990 };
      const p1 = { x: 100, y: 100, t: 1000 };
      const p2 = { x: 110, y: 105, t: 1010 };
      
      global.currentPath = {
        tool: 'pen',
        color: '#ef4444',
        size: 10,
        points: [p0, p1],
        lastWidth: 10
      };

      drawPenPath(p1, p2);

      // Should draw quadratic curve using midpoints
      expect(mockContext.quadraticCurveTo).toHaveBeenCalled();
      expect(mockContext.moveTo).toHaveBeenCalled();
    });

    test('should fallback to straight line for first segment', () => {
      global.currentTool = 'pen';
      
      const p1 = { x: 100, y: 100, t: 1000 };
      const p2 = { x: 110, y: 105, t: 1010 };
      
      global.currentPath = {
        tool: 'pen',
        color: '#ef4444',
        size: 10,
        points: [p1], // Only one previous point
        lastWidth: 10
      };

      drawPenPath(p1, p2);

      // Should draw straight line for first segment
      expect(mockContext.lineTo).toHaveBeenCalled();
      expect(mockContext.moveTo).toHaveBeenCalled();
    });
  });

  describe('Eraser Path Drawing', () => {
    test('should use destination-out composite operation for eraser', () => {
      global.currentTool = 'eraser';
      global.eraserSize = 20;
      
      const prevPoint = { x: 100, y: 100 };
      const currentPoint = { x: 110, y: 105 };
      
      global.currentPath = {
        tool: 'eraser',
        size: 20,
        points: [{ x: 90, y: 95 }, prevPoint],
      };

      drawEraserPath(prevPoint, currentPoint);

      expect(mockContext.globalCompositeOperation).toBe('destination-out');
      expect(mockContext.lineWidth).toBe(20);
      expect(mockContext.stroke).toHaveBeenCalled();
    });

    test('should maintain constant eraser width', () => {
      global.currentTool = 'eraser';
      global.eraserSize = 25;
      
      const prevPoint = { x: 100, y: 100 };
      const currentPoint = { x: 200, y: 100 }; // Fast movement
      
      global.currentPath = {
        tool: 'eraser',
        size: 25,
        points: [{ x: 50, y: 100 }, prevPoint],
      };

      drawEraserPath(prevPoint, currentPoint);

      // Eraser should maintain constant width regardless of speed
      expect(mockContext.lineWidth).toBe(25);
    });
  });

  describe('Drawing Dots', () => {
    test('should draw circular dots for pen tool', () => {
      global.currentTool = 'pen';
      global.currentColor = '#3b82f6';
      global.penSize = 15;

      drawDot(150, 200);

      expect(mockContext.globalCompositeOperation).toBe('source-over');
      expect(mockContext.fillStyle).toBe('#3b82f6');
      expect(mockContext.arc).toHaveBeenCalledWith(150, 200, 7.5, 0, Math.PI * 2);
      expect(mockContext.fill).toHaveBeenCalled();
    });

    test('should draw eraser dots with destination-out', () => {
      global.currentTool = 'eraser';
      global.eraserSize = 30;

      drawDot(100, 100);

      expect(mockContext.globalCompositeOperation).toBe('destination-out');
      expect(mockContext.arc).toHaveBeenCalledWith(100, 100, 15, 0, Math.PI * 2);
      expect(mockContext.fill).toHaveBeenCalled();
    });

    test('should handle zero or negative sizes gracefully', () => {
      global.currentTool = 'pen';
      global.penSize = 0;

      expect(() => drawDot(100, 100)).not.toThrow();
      expect(mockContext.arc).toHaveBeenCalledWith(100, 100, 0, 0, Math.PI * 2);
    });
  });

  describe('Path Tracking', () => {
    test('should create and track drawing paths', () => {
      global.currentTool = 'pen';
      global.currentColor = '#10b981';
      global.penSize = 12;
      global.drawingPaths = [];

      const mockEvent = {
        preventDefault: jest.fn(),
        clientX: 150,
        clientY: 200,
        button: 0
      };

      startDrawing(mockEvent);

      expect(global.drawingPaths).toHaveLength(1);
      expect(global.currentPath).toBeDefined();
      expect(global.currentPath.tool).toBe('pen');
      expect(global.currentPath.color).toBe('#10b981');
      expect(global.currentPath.size).toBe(12);
      expect(global.currentPath.points).toHaveLength(1);
    });

    test('should add points to current path during drawing', () => {
      global.isDrawing = true;
      global.currentPath = {
        tool: 'pen',
        color: '#ef4444',
        size: 10,
        points: [{ x: 100, y: 100, t: 1000 }],
        lastWidth: 10
      };

      const mockEvent = {
        clientX: 110,
        clientY: 105
      };

      draw(mockEvent);

      expect(global.currentPath.points).toHaveLength(2);
      expect(global.currentPath.points[1].x).toBe(110);
      expect(global.currentPath.points[1].y).toBe(105);
    });
  });

  describe('Error Handling', () => {
    test('should handle null context gracefully in drawDot', () => {
      global.ctx = null;

      expect(() => drawDot(100, 100)).not.toThrow();
    });

    test('should handle drawing without current path', () => {
      global.isDrawing = true;
      global.currentPath = null;

      const mockEvent = { clientX: 100, clientY: 100 };

      expect(() => draw(mockEvent)).not.toThrow();
    });

    test('should handle startDrawing with invalid coordinates', () => {
      global.currentTool = 'pen';
      
      const mockEvent = {
        preventDefault: jest.fn(),
        clientX: NaN,
        clientY: undefined,
        button: 0
      };

      expect(() => startDrawing(mockEvent)).not.toThrow();
      expect(global.isDrawing).toBe(false); // Should reset on error
    });
  });

  describe('Performance Considerations', () => {
    test('should save and restore context state properly', () => {
      global.currentTool = 'pen';
      
      const mockEvent = {
        preventDefault: jest.fn(),
        clientX: 100,
        clientY: 100,
        button: 0
      };

      startDrawing(mockEvent);

      expect(mockContext.save).toHaveBeenCalled();
      
      stopDrawing();

      expect(mockContext.restore).toHaveBeenCalled();
      expect(mockContext.globalCompositeOperation).toBe('source-over');
    });

    test('should handle high-frequency drawing events', () => {
      global.isDrawing = true;
      global.currentPath = {
        tool: 'pen',
        color: '#ef4444',
        size: 10,
        points: [{ x: 100, y: 100, t: 1000 }],
        lastWidth: 10
      };

      // Simulate rapid mouse movements
      for (let i = 0; i < 50; i++) {
        const mockEvent = {
          clientX: 100 + i,
          clientY: 100 + i
        };
        draw(mockEvent);
      }

      expect(global.currentPath.points).toHaveLength(51); // Initial + 50 new points
      expect(mockContext.stroke).toHaveBeenCalledTimes(50);
    });
  });

  describe('Tool-Specific Behavior', () => {
    test('should apply correct composite operation for each tool', () => {
      // Test pen
      global.currentTool = 'pen';
      const penEvent = { preventDefault: jest.fn(), clientX: 100, clientY: 100, button: 0 };
      
      startDrawing(penEvent);
      expect(mockContext.globalCompositeOperation).toBe('source-over');
      stopDrawing();

      // Reset and test eraser
      mockContext.globalCompositeOperation = 'source-over';
      global.currentTool = 'eraser';
      const eraserEvent = { preventDefault: jest.fn(), clientX: 100, clientY: 100, button: 0 };
      
      startDrawing(eraserEvent);
      expect(mockContext.globalCompositeOperation).toBe('destination-out');
      stopDrawing();
    });

    test('should use correct size for each tool', () => {
      global.penSize = 15;
      global.eraserSize = 25;

      // Test pen size
      global.currentTool = 'pen';
      const penEvent = { preventDefault: jest.fn(), clientX: 100, clientY: 100, button: 0 };
      startDrawing(penEvent);
      expect(global.currentPath.size).toBe(15);
      stopDrawing();

      // Test eraser size
      global.currentTool = 'eraser';
      const eraserEvent = { preventDefault: jest.fn(), clientX: 100, clientY: 100, button: 0 };
      startDrawing(eraserEvent);
      expect(global.currentPath.size).toBe(25);
      stopDrawing();
    });
  });
});
