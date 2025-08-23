/**
 * Unit Tests for Drawing Engine
 * Tests pen tool, eraser tool, path smoothing, and drawing operations
 */

require('../../app.js');

describe('Drawing Engine (unit)', () => {
  let mockCanvas;
  let mockContext;

  beforeEach(() => {
    // Setup canvas and context mocks
    mockContext = {
      save: jest.fn(),
      restore: jest.fn(),
      beginPath: jest.fn(),
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      quadraticCurveTo: jest.fn(),
      arc: jest.fn(),
      stroke: jest.fn(),
      fill: jest.fn(),
      fillRect: jest.fn(),
      strokeStyle: '#000000',
      fillStyle: '#000000',
      lineWidth: 1,
      lineCap: 'butt',
      lineJoin: 'miter',
      globalCompositeOperation: 'source-over'
    };

    mockCanvas = {
      getContext: jest.fn(() => mockContext),
      width: 800,
      height: 600,
      toDataURL: jest.fn(() => 'data:image/png;base64,mock-data'),
      getBoundingClientRect: jest.fn(() => ({
        left: 0, top: 0, width: 800, height: 600
      }))
    };

    // Set globals
    global.canvas = mockCanvas;
    global.ctx = mockContext;
    global.currentColor = '#ef4444';
    global.penSize = 10;
    global.eraserSize = 15;
    global.currentTool = 'pen';
    global.isDrawing = false;
    global.currentPath = null;
    global.drawingPaths = [];
  });

  describe('Drawing State Management', () => {
    test('should start drawing correctly', () => {
      const mockEvent = {
        preventDefault: jest.fn(),
        clientX: 100,
        clientY: 100
      };

      startDrawing(mockEvent);

      expect(global.isDrawing).toBe(true);
      expect(mockContext.save).toHaveBeenCalled();
      expect(mockContext.globalCompositeOperation).toBe('source-over');
      expect(global.currentPath).toBeDefined();
      expect(global.currentPath.tool).toBe('pen');
      expect(global.currentPath.color).toBe('#ef4444');
      expect(global.currentPath.size).toBe(10);
    });

    test('should start eraser drawing correctly', () => {
      global.currentTool = 'eraser';
      const mockEvent = {
        preventDefault: jest.fn(),
        clientX: 100,
        clientY: 100
      };

      startDrawing(mockEvent);

      expect(global.isDrawing).toBe(true);
      expect(mockContext.globalCompositeOperation).toBe('destination-out');
      expect(global.currentPath.tool).toBe('eraser');
      expect(global.currentPath.size).toBe(15);
    });

    test('should stop drawing correctly', () => {
      global.isDrawing = true;
      global.currentPath = { tool: 'pen', points: [] };

      stopDrawing();

      expect(global.isDrawing).toBe(false);
      expect(global.currentPath).toBe(null);
      expect(mockContext.restore).toHaveBeenCalled();
      expect(mockContext.globalCompositeOperation).toBe('source-over');
    });

    test('should handle drawing start error gracefully', () => {
      mockContext.save = jest.fn(() => { throw new Error('Context error'); });
      const mockEvent = {
        preventDefault: jest.fn(),
        clientX: 100,
        clientY: 100
      };

      startDrawing(mockEvent);

      expect(global.isDrawing).toBe(false);
    });
  });

  describe('Dot Drawing', () => {
    test('should draw pen dot correctly', () => {
      global.currentTool = 'pen';
      global.currentColor = '#ff0000';
      global.penSize = 20;

      drawDot(100, 150);

      expect(mockContext.globalCompositeOperation).toBe('source-over');
      expect(mockContext.fillStyle).toBe('#ff0000');
      expect(mockContext.beginPath).toHaveBeenCalled();
      expect(mockContext.arc).toHaveBeenCalledWith(100, 150, 10, 0, Math.PI * 2);
      expect(mockContext.fill).toHaveBeenCalled();
    });

    test('should draw eraser dot correctly', () => {
      global.currentTool = 'eraser';
      global.eraserSize = 30;

      drawDot(200, 250);

      expect(mockContext.globalCompositeOperation).toBe('destination-out');
      expect(mockContext.fillStyle).toBe('rgba(0, 0, 0, 1)');
      expect(mockContext.arc).toHaveBeenCalledWith(200, 250, 15, 0, Math.PI * 2);
      expect(mockContext.fill).toHaveBeenCalled();
    });

    test('should handle null context gracefully', () => {
      global.ctx = null;

      expect(() => drawDot(100, 100)).not.toThrow();
    });
  });

  describe('Path Drawing', () => {
    beforeEach(() => {
      global.currentPath = {
        tool: 'pen',
        color: '#ef4444',
        size: 10,
        points: [
          { x: 50, y: 50, t: 1000 },
          { x: 60, y: 60, t: 1016 }
        ],
        lastWidth: 10
      };
    });

    test('should draw pen path with smoothing', () => {
      const prevPoint = { x: 60, y: 60, t: 1016 };
      const currentPoint = { x: 70, y: 70, t: 1032 };

      drawPenPath(prevPoint, currentPoint);

      expect(mockContext.save).toHaveBeenCalled();
      expect(mockContext.globalCompositeOperation).toBe('source-over');
      expect(mockContext.strokeStyle).toBe('#ef4444');
      expect(mockContext.lineCap).toBe('round');
      expect(mockContext.lineJoin).toBe('round');
      expect(mockContext.beginPath).toHaveBeenCalled();
      expect(mockContext.quadraticCurveTo).toHaveBeenCalled();
      expect(mockContext.stroke).toHaveBeenCalled();
      expect(mockContext.restore).toHaveBeenCalled();
    });

    test('should draw eraser path correctly', () => {
      global.currentTool = 'eraser';
      global.currentPath.tool = 'eraser';
      const prevPoint = { x: 60, y: 60 };
      const currentPoint = { x: 70, y: 70 };

      drawEraserPath(prevPoint, currentPoint);

      expect(mockContext.save).toHaveBeenCalled();
      expect(mockContext.globalCompositeOperation).toBe('destination-out');
      expect(mockContext.lineWidth).toBe(15);
      expect(mockContext.lineCap).toBe('round');
      expect(mockContext.lineJoin).toBe('round');
      expect(mockContext.restore).toHaveBeenCalled();
    });

    test('should handle velocity calculation for pen width', () => {
      const prevPoint = { x: 0, y: 0, t: 1000 };
      const currentPoint = { x: 100, y: 0, t: 1100 }; // Fast movement

      drawPenPath(prevPoint, currentPoint);

      // Should have adjusted line width based on velocity
      expect(mockContext.lineWidth).toBeGreaterThan(0);
    });

    test('should handle first stroke without previous point', () => {
      global.currentPath.points = [{ x: 50, y: 50, t: 1000 }];
      const prevPoint = { x: 50, y: 50, t: 1000 };
      const currentPoint = { x: 60, y: 60, t: 1016 };

      drawPenPath(prevPoint, currentPoint);

      expect(mockContext.moveTo).toHaveBeenCalledWith(50, 50);
      expect(mockContext.lineTo).toHaveBeenCalledWith(60, 60);
    });
  });

  describe('Edge Cases', () => {
    test('should handle invalid coordinates', () => {
      expect(() => drawDot(NaN, NaN)).not.toThrow();
      expect(() => drawDot(Infinity, -Infinity)).not.toThrow();
    });

    test('should handle empty path data', () => {
      global.currentPath = null;
      const prevPoint = { x: 0, y: 0 };
      const currentPoint = { x: 10, y: 10 };

      expect(() => drawPenPath(prevPoint, currentPoint)).not.toThrow();
    });

    test('should handle missing timestamp data', () => {
      const prevPoint = { x: 0, y: 0 }; // No timestamp
      const currentPoint = { x: 10, y: 10 }; // No timestamp

      expect(() => drawPenPath(prevPoint, currentPoint)).not.toThrow();
    });
  });
});
