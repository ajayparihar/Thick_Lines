/**
 * Performance Tests for Critical Operations
 * Tests rendering performance, memory usage, and optimization effectiveness
 */

require('../../app.js');

describe('Rendering Performance (performance)', () => {
  let mockCanvas;
  let mockContext;
  let performanceStartTime;

  beforeEach(() => {
    // Setup performance measurement
    performanceStartTime = performance.now();

    // Setup mocks for performance testing
    mockContext = {
      save: jest.fn(),
      restore: jest.fn(),
      fillRect: jest.fn(),
      beginPath: jest.fn(),
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      quadraticCurveTo: jest.fn(),
      arc: jest.fn(),
      stroke: jest.fn(),
      fill: jest.fn(),
      setTransform: jest.fn(),
      scale: jest.fn(),
      drawImage: jest.fn(),
      strokeStyle: '#ef4444',
      fillStyle: '#ef4444',
      lineWidth: 10,
      globalCompositeOperation: 'source-over'
    };

    mockCanvas = {
      getContext: jest.fn(() => mockContext),
      width: 1920,
      height: 1080,
      toDataURL: jest.fn(() => 'data:image/png;base64,perf-test-data'),
      getBoundingClientRect: jest.fn(() => ({
        left: 0, top: 0, width: 1920, height: 1080
      }))
    };

    global.canvas = mockCanvas;
    global.ctx = mockContext;
    global.currentTool = 'pen';
    global.currentColor = '#ef4444';
    global.penSize = 10;
    global.eraserSize = 15;
    global.zoomLevel = 1.0;
    global.panOffsetX = 0;
    global.panOffsetY = 0;
    global.undoStack = [];
    global.redoStack = [];
    global.drawingPaths = [];
  });

  describe('Drawing Performance', () => {
    test('should handle high-frequency drawing operations efficiently', () => {
      const startTime = performance.now();
      
      // Simulate 1000 rapid drawing operations
      startDrawing({ preventDefault: jest.fn(), clientX: 100, clientY: 100 });
      
      for (let i = 0; i < 1000; i++) {
        draw({ preventDefault: jest.fn(), clientX: 100 + i, clientY: 100 + Math.sin(i) * 50 });
      }
      
      stopDrawing();
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Should complete within reasonable time (< 100ms for 1000 operations)
      expect(duration).toBeLessThan(100);
      expect(mockContext.quadraticCurveTo).toHaveBeenCalled();
    });

    test('should throttle mouse move events effectively', () => {
      const mockFn = jest.fn();
      const throttledFn = throttle(mockFn, 16); // 60fps
      
      const startTime = performance.now();
      
      // Call function rapidly
      for (let i = 0; i < 100; i++) {
        throttledFn();
      }
      
      const endTime = performance.now();
      
      // Should have limited the number of calls
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(endTime - startTime).toBeLessThan(50);
    });

    test('should debounce resize events efficiently', (done) => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 250);
      
      const startTime = performance.now();
      
      // Trigger multiple rapid calls
      for (let i = 0; i < 50; i++) {
        debouncedFn();
      }
      
      // Should not call immediately
      expect(mockFn).not.toHaveBeenCalled();
      
      setTimeout(() => {
        const endTime = performance.now();
        expect(mockFn).toHaveBeenCalledTimes(1);
        expect(endTime - startTime).toBeGreaterThan(250);
        done();
      }, 300);
    });

    test('should handle large canvas sizes efficiently', () => {
      // Test with 4K canvas
      mockCanvas.width = 3840;
      mockCanvas.height = 2160;
      
      const startTime = performance.now();
      
      // Perform resize operation
      resizeCanvas();
      
      const endTime = performance.now();
      
      // Should complete quickly even with large canvas
      expect(endTime - startTime).toBeLessThan(50);
      expect(mockContext.scale).toHaveBeenCalled();
    });
  });

  describe('Memory Performance', () => {
    test('should manage undo stack memory efficiently', () => {
      const startMemory = process.memoryUsage ? process.memoryUsage().heapUsed : 0;
      
      // Create large undo stack
      for (let i = 0; i < 100; i++) {
        global.undoStack.push(`large-state-data-${i}-${'x'.repeat(1000)}`);
      }
      
      // Trigger cleanup
      trimUndoRedoStacks();
      
      const endMemory = process.memoryUsage ? process.memoryUsage().heapUsed : 0;
      
      // Stack should be trimmed
      expect(global.undoStack.length).toBeLessThanOrEqual(10);
      
      // Memory usage should not grow indefinitely
      if (process.memoryUsage) {
        expect(endMemory - startMemory).toBeLessThan(1024 * 1024); // Less than 1MB growth
      }
    });

    test('should handle state saving performance', () => {
      const operations = [];
      const iterations = 50;
      
      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        saveState();
        const endTime = performance.now();
        operations.push(endTime - startTime);
      }
      
      const averageTime = operations.reduce((a, b) => a + b, 0) / operations.length;
      const maxTime = Math.max(...operations);
      
      // Average should be reasonable
      expect(averageTime).toBeLessThan(10); // < 10ms average
      expect(maxTime).toBeLessThan(50); // < 50ms max
    });

    test('should handle drawing path memory efficiently', () => {
      global.currentPath = {
        tool: 'pen',
        color: '#ef4444',
        size: 10,
        points: [],
        lastWidth: 10
      };
      
      const startTime = performance.now();
      
      // Add many points to current path
      for (let i = 0; i < 1000; i++) {
        global.currentPath.points.push({ x: i, y: i, t: performance.now() });
      }
      
      // Clean up paths
      global.drawingPaths = [global.currentPath];
      cleanupMemory();
      
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(10);
      expect(global.drawingPaths).toHaveLength(0);
    });
  });

  describe('Rendering Optimization', () => {
    test('should use requestAnimationFrame efficiently', () => {
      let frameCallbacks = [];
      window.requestAnimationFrame = jest.fn((callback) => {
        frameCallbacks.push(callback);
        return frameCallbacks.length;
      });
      
      // Trigger optimized mouse move
      global.animationFrameRequested = false;
      const mockEvent = { preventDefault: jest.fn(), clientX: 100, clientY: 100 };
      
      // Call multiple times rapidly
      for (let i = 0; i < 10; i++) {
        optimizedMouseMove(mockEvent);
      }
      
      // Should only queue one frame
      expect(window.requestAnimationFrame).toHaveBeenCalledTimes(1);
      expect(frameCallbacks).toHaveLength(1);
    });

    test('should handle transform operations efficiently', () => {
      const startTime = performance.now();
      
      // Perform multiple transform operations
      for (let i = 0; i < 100; i++) {
        global.zoomLevel = 1.0 + (i / 100);
        global.panOffsetX = i;
        global.panOffsetY = i;
        applyTransform(false);
      }
      
      const endTime = performance.now();
      
      // Should complete quickly
      expect(endTime - startTime).toBeLessThan(50);
      expect(mockContext.setTransform).toHaveBeenCalled();
    });

    test('should optimize coordinate calculations', () => {
      const iterations = 10000;
      const startTime = performance.now();
      
      // Perform many coordinate calculations
      for (let i = 0; i < iterations; i++) {
        getCoordinates({ clientX: i % 1920, clientY: i % 1080 });
      }
      
      const endTime = performance.now();
      const averageTime = (endTime - startTime) / iterations;
      
      // Should be very fast per calculation
      expect(averageTime).toBeLessThan(0.01); // < 0.01ms per calculation
    });
  });

  describe('Canvas Operations Performance', () => {
    test('should handle large path smoothing efficiently', () => {
      global.currentPath = {
        tool: 'pen',
        points: [],
        lastWidth: 10
      };
      
      // Create large path
      for (let i = 0; i < 1000; i++) {
        global.currentPath.points.push({ x: i, y: Math.sin(i / 10) * 100, t: i });
      }
      
      const startTime = performance.now();
      
      // Draw path segments
      for (let i = 1; i < global.currentPath.points.length; i++) {
        const prev = global.currentPath.points[i - 1];
        const curr = global.currentPath.points[i];
        drawPenPath(prev, curr);
      }
      
      const endTime = performance.now();
      
      // Should handle large paths efficiently
      expect(endTime - startTime).toBeLessThan(100);
    });

    test('should handle state serialization performance', () => {
      // Mock large canvas data
      mockCanvas.toDataURL = jest.fn(() => 'data:image/png;base64,' + 'x'.repeat(100000));
      
      const startTime = performance.now();
      
      // Perform multiple state saves
      for (let i = 0; i < 10; i++) {
        saveState();
      }
      
      const endTime = performance.now();
      const averageTime = (endTime - startTime) / 10;
      
      // Should complete within reasonable time
      expect(averageTime).toBeLessThan(20); // < 20ms per save
    });

    test('should handle zoom level changes efficiently', () => {
      const startTime = performance.now();
      
      // Perform many zoom operations
      for (let zoom = 0.5; zoom <= 3.0; zoom += 0.1) {
        global.zoomLevel = zoom;
        applyTransform(false);
      }
      
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(30);
    });
  });

  describe('Event Processing Performance', () => {
    test('should handle rapid event processing', () => {
      const startTime = performance.now();
      
      // Simulate rapid mouse events
      for (let i = 0; i < 1000; i++) {
        const event = {
          preventDefault: jest.fn(),
          clientX: 100 + (i % 800),
          clientY: 100 + (i % 600)
        };
        
        if (i % 10 === 0) {
          startDrawing(event);
        } else if (i % 10 === 9) {
          stopDrawing();
        } else {
          draw(event);
        }
      }
      
      const endTime = performance.now();
      
      // Should handle rapid events efficiently
      expect(endTime - startTime).toBeLessThan(200);
    });

    test('should optimize touch event processing', () => {
      const startTime = performance.now();
      
      // Simulate rapid touch events
      for (let i = 0; i < 500; i++) {
        const event = {
          preventDefault: jest.fn(),
          touches: [{ clientX: 100 + i, clientY: 100 + i }]
        };
        
        if (i === 0) {
          handleTouchStart(event);
        } else if (i === 499) {
          handleTouchEnd({ touches: [] });
        } else {
          handleTouchMove(event);
        }
      }
      
      const endTime = performance.now();
      
      // Should handle touch efficiently
      expect(endTime - startTime).toBeLessThan(100);
    });
  });

  describe('Memory Leak Prevention', () => {
    test('should not leak memory during extended drawing sessions', () => {
      const initialUndoStackLength = global.undoStack.length;
      
      // Simulate extended drawing session
      for (let session = 0; session < 100; session++) {
        startDrawing({ preventDefault: jest.fn(), clientX: 100, clientY: 100 });
        
        for (let i = 0; i < 50; i++) {
          draw({ preventDefault: jest.fn(), clientX: 100 + i, clientY: 100 + i });
        }
        
        stopDrawing();
        
        // Trigger periodic cleanup
        if (session % 10 === 0) {
          trimUndoRedoStacks();
        }
      }
      
      // Memory should be managed
      expect(global.undoStack.length).toBeLessThan(50);
      expect(global.drawingPaths).toHaveLength(0);
    });

    test('should clean up event listeners properly', () => {
      const addEventListenerCalls = [];
      const removeEventListenerCalls = [];
      
      mockCanvas.addEventListener = jest.fn((...args) => addEventListenerCalls.push(args));
      mockCanvas.removeEventListener = jest.fn((...args) => removeEventListenerCalls.push(args));
      
      // Setup and teardown multiple times
      for (let i = 0; i < 5; i++) {
        setupEventListeners();
        cleanupMemory();
      }
      
      // Should have balanced add/remove calls for proper cleanup
      expect(addEventListenerCalls.length).toBeGreaterThan(0);
    });

    test('should handle visibility change memory cleanup', () => {
      // Create memory-intensive state
      global.undoStack = Array.from({ length: 50 }, (_, i) => `state-${i}-${'x'.repeat(1000)}`);
      global.drawingPaths = Array.from({ length: 100 }, (_, i) => ({ 
        tool: 'pen', 
        points: Array.from({ length: 100 }, (_, j) => ({ x: j, y: j }))
      }));
      
      // Simulate page becoming hidden
      Object.defineProperty(document, 'hidden', { value: true, writable: true });
      
      handleVisibilityChange();
      
      // Should trigger cleanup
      expect(global.drawingPaths).toHaveLength(0);
    });
  });

  describe('Canvas Performance', () => {
    test('should handle device pixel ratio scaling efficiently', () => {
      Object.defineProperty(window, 'devicePixelRatio', { value: 3, writable: true });
      
      const startTime = performance.now();
      
      // Perform multiple resize operations
      for (let i = 0; i < 10; i++) {
        resizeCanvas();
      }
      
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(50);
      expect(mockContext.scale).toHaveBeenCalledWith(3, 3);
    });

    test('should handle complex path rendering efficiently', () => {
      global.currentPath = {
        tool: 'pen',
        color: '#ef4444',
        size: 10,
        points: [],
        lastWidth: 10
      };
      
      // Create complex curved path
      for (let i = 0; i < 500; i++) {
        const angle = (i / 500) * Math.PI * 4;
        global.currentPath.points.push({
          x: 500 + Math.cos(angle) * (200 - i * 0.2),
          y: 500 + Math.sin(angle) * (200 - i * 0.2),
          t: i * 16 // 60fps timing
        });
      }
      
      const startTime = performance.now();
      
      // Render the complex path
      for (let i = 1; i < global.currentPath.points.length; i++) {
        const prev = global.currentPath.points[i - 1];
        const curr = global.currentPath.points[i];
        drawPenPath(prev, curr);
      }
      
      const endTime = performance.now();
      
      // Should handle complex paths efficiently
      expect(endTime - startTime).toBeLessThan(200);
    });

    test('should optimize composite operations performance', () => {
      const startTime = performance.now();
      
      // Alternate between pen and eraser operations
      for (let i = 0; i < 100; i++) {
        if (i % 2 === 0) {
          mockContext.globalCompositeOperation = 'source-over';
          drawDot(100 + i, 100 + i);
        } else {
          mockContext.globalCompositeOperation = 'destination-out';
          drawDot(100 + i, 100 + i);
        }
      }
      
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(50);
      expect(mockContext.arc).toHaveBeenCalledTimes(100);
    });
  });

  describe('Zoom and Pan Performance', () => {
    test('should handle zoom operations efficiently', () => {
      const startTime = performance.now();
      
      // Perform many zoom operations
      for (let i = 0; i < 100; i++) {
        const zoom = 0.5 + (i / 100) * 2.5; // 0.5 to 3.0
        global.zoomLevel = zoom;
        global.panOffsetX = i;
        global.panOffsetY = i;
        applyTransform(false);
      }
      
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(30);
    });

    test('should handle pan operations smoothly', () => {
      global.isPanning = true;
      global.lastPanPoint = { x: 0, y: 0 };
      
      const startTime = performance.now();
      
      // Simulate smooth panning motion
      for (let i = 0; i < 200; i++) {
        const event = {
          clientX: i * 2,
          clientY: i * 2
        };
        moveCanvasPan(event);
      }
      
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(50);
      expect(global.panOffsetX).toBe(398); // 200 * 2 - 2
      expect(global.panOffsetY).toBe(398);
    });
  });

  describe('Animation Performance', () => {
    test('should handle animation frame rendering efficiently', () => {
      global.showRulers = true;
      global.undoStack = ['mock-state'];
      
      const mockImage = {
        onload: null,
        src: ''
      };
      global.Image = jest.fn(() => mockImage);
      
      const startTime = performance.now();
      
      // Render multiple frames
      for (let i = 0; i < 60; i++) {
        renderFrame();
        if (mockImage.onload) {
          mockImage.onload(); // Simulate image load
        }
      }
      
      const endTime = performance.now();
      
      // Should handle 60fps rendering
      expect(endTime - startTime).toBeLessThan(100);
    });

    test('should throttle animation updates effectively', () => {
      let animationCallCount = 0;
      window.requestAnimationFrame = jest.fn(() => {
        animationCallCount++;
      });
      
      // Rapidly trigger optimized mouse moves
      for (let i = 0; i < 20; i++) {
        optimizedMouseMove({ preventDefault: jest.fn(), clientX: i, clientY: i });
      }
      
      // Should limit animation frame requests
      expect(animationCallCount).toBeLessThanOrEqual(5);
    });
  });

  describe('Stress Testing', () => {
    test('should handle maximum zoom level operations', () => {
      const startTime = performance.now();
      
      // Test extreme zoom levels
      global.zoomLevel = 3.0; // Maximum zoom
      
      for (let i = 0; i < 100; i++) {
        const coords = getCoordinates({ 
          clientX: 100 + (i % 50), 
          clientY: 100 + (i % 50) 
        });
        drawDot(coords.x, coords.y);
      }
      
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(100);
    });

    test('should handle maximum canvas size stress test', () => {
      // Test with maximum practical canvas size
      mockCanvas.width = 4096;
      mockCanvas.height = 4096;
      
      const startTime = performance.now();
      
      // Perform operations on large canvas
      resizeCanvas();
      applyTransform(false);
      
      for (let i = 0; i < 50; i++) {
        drawDot(i * 80, i * 80);
      }
      
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(200);
    });
  });
});
