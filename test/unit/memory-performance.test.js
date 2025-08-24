/**
 * Memory Management and Performance Tests
 * Tests memory cleanup, performance optimizations, and resource management
 */

require('../../app.js');

describe('Memory Management and Performance (unit)', () => {
  let mockCanvas, mockContext;

  beforeEach(() => {
    // Reset global state
    global.canvas = null;
    global.ctx = null;
    global.undoStack = [];
    global.redoStack = [];
    global.drawingPaths = [];
    global.copiedRegion = null;
    global.animationFrameRequested = false;

    // Setup canvas mocks
    mockContext = {
      fillRect: jest.fn(),
      clearRect: jest.fn(),
      drawImage: jest.fn()
    };

    mockCanvas = {
      getContext: jest.fn(() => mockContext),
      toDataURL: jest.fn(() => 'data:image/png;base64,mock-canvas-data'),
      width: 800,
      height: 600
    };

    global.canvas = mockCanvas;
    global.ctx = mockContext;

    // Mock window methods
    global.gc = jest.fn();
    Object.defineProperty(window, 'gc', {
      value: global.gc,
      writable: true,
      configurable: true
    });

    // Mock document visibility API
    Object.defineProperty(document, 'hidden', {
      value: false,
      writable: true,
      configurable: true
    });

    // Mock performance API
    Object.defineProperty(window, 'performance', {
      value: {
        now: jest.fn(() => Date.now())
      },
      writable: true,
      configurable: true
    });

    // Mock requestAnimationFrame
    Object.defineProperty(window, 'requestAnimationFrame', {
      value: jest.fn(callback => setTimeout(callback, 16)),
      writable: true,
      configurable: true
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Undo Stack Management', () => {
    test('should limit undo stack size to prevent memory issues', () => {
      global.undoStack = [];

      // Add more than the limit (30 + 5 extra)
      for (let i = 0; i < 35; i++) {
        global.undoStack.push(`data:image/png;base64,state-${i}`);
      }

      saveState();

      // Should not exceed the limit
      expect(global.undoStack.length).toBeLessThanOrEqual(31); // 30 limit + 1 new
    });

    test('should trim undo stack when memory conservation is needed', () => {
      // Fill undo stack with many states
      global.undoStack = [];
      for (let i = 0; i < 25; i++) {
        global.undoStack.push(`data:image/png;base64,state-${i}`);
      }

      const originalLength = global.undoStack.length;

      trimUndoRedoStacks();

      // Should keep only last 10 states + initial state
      expect(global.undoStack.length).toBeLessThanOrEqual(10);
      expect(global.undoStack.length).toBeLessThan(originalLength);
    });

    test('should preserve initial state when trimming', () => {
      global.undoStack = [
        'data:image/png;base64,initial-state',
        ...Array(20).fill(0).map((_, i) => `data:image/png;base64,state-${i}`)
      ];

      trimUndoRedoStacks();

      // Should keep the initial state
      expect(global.undoStack[0]).toBe('data:image/png;base64,initial-state');
    });

    test('should clear redo stack during trimming', () => {
      global.redoStack = Array(10).fill(0).map((_, i) => `data:image/png;base64,redo-${i}`);
      global.undoStack = Array(15).fill(0).map((_, i) => `data:image/png;base64,undo-${i}`);

      trimUndoRedoStacks();

      expect(global.redoStack).toEqual([]);
    });

    test('should call garbage collection if available', () => {
      global.undoStack = Array(20).fill(0).map((_, i) => `data:image/png;base64,state-${i}`);

      trimUndoRedoStacks();

      expect(global.gc).toHaveBeenCalled();
    });

    test('should handle missing garbage collection gracefully', () => {
      global.gc = undefined;
      global.undoStack = Array(20).fill(0).map((_, i) => `data:image/png;base64,state-${i}`);

      expect(() => trimUndoRedoStacks()).not.toThrow();
    });
  });

  describe('Drawing Path Memory Management', () => {
    test('should clear drawing paths during memory cleanup', () => {
      global.drawingPaths = [
        { tool: 'pen', points: Array(100).fill({ x: 100, y: 100 }) },
        { tool: 'eraser', points: Array(50).fill({ x: 200, y: 200 }) }
      ];

      cleanupMemory();

      expect(global.drawingPaths).toEqual([]);
    });

    test('should clear copied region during cleanup', () => {
      global.copiedRegion = {
        width: 400,
        height: 300,
        data: 'large-image-data'
      };

      cleanupMemory();

      expect(global.copiedRegion).toBeNull();
    });

    test('should hide size visualizer during cleanup', () => {
      global.domElements = {
        sizeVisualizer: {
          classList: {
            remove: jest.fn()
          }
        }
      };

      cleanupMemory();

      expect(global.domElements.sizeVisualizer.classList.remove).toHaveBeenCalledWith('visible');
    });
  });

  describe('Visibility Change Handling', () => {
    test('should perform cleanup when page becomes hidden', () => {
      const cleanupSpy = jest.spyOn(global, 'cleanupMemory');
      document.hidden = true;

      handleVisibilityChange();

      expect(cleanupSpy).toHaveBeenCalled();
    });

    test('should restore canvas when page becomes visible', () => {
      global.undoStack = ['data:image/png;base64,test-state'];
      document.hidden = false;

      const loadStateSpy = jest.spyOn(global, 'loadState');

      handleVisibilityChange();

      expect(loadStateSpy).toHaveBeenCalledWith('data:image/png;base64,test-state');
    });

    test('should handle empty undo stack when becoming visible', () => {
      global.undoStack = [];
      document.hidden = false;

      expect(() => handleVisibilityChange()).not.toThrow();
    });
  });

  describe('Performance Optimizations', () => {
    test('should use throttle for mouse move events', (done) => {
      const mockFn = jest.fn();
      const throttledFn = throttle(mockFn, 50);

      // Call rapidly
      for (let i = 0; i < 10; i++) {
        throttledFn();
      }

      // Should only call once immediately
      expect(mockFn).toHaveBeenCalledTimes(1);

      // Wait for throttle period
      setTimeout(() => {
        throttledFn();
        expect(mockFn).toHaveBeenCalledTimes(2);
        done();
      }, 60);
    });

    test('should use debounce for resize events', (done) => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 100);

      // Call rapidly
      for (let i = 0; i < 5; i++) {
        debouncedFn();
      }

      // Should not call immediately
      expect(mockFn).not.toHaveBeenCalled();

      // Wait for debounce period
      setTimeout(() => {
        expect(mockFn).toHaveBeenCalledTimes(1);
        done();
      }, 150);
    });

    test('should optimize mouse move with requestAnimationFrame', () => {
      global.animationFrameRequested = false;

      const mockEvent = { clientX: 100, clientY: 100 };

      optimizedMouseMove(mockEvent);

      expect(window.requestAnimationFrame).toHaveBeenCalled();
      expect(global.animationFrameRequested).toBe(true);
    });

    test('should not duplicate animation frame requests', () => {
      global.animationFrameRequested = true;

      const mockEvent = { clientX: 100, clientY: 100 };

      optimizedMouseMove(mockEvent);

      // Should not request another frame
      expect(window.requestAnimationFrame).toHaveBeenCalledTimes(0);
    });
  });

  describe('Memory Leak Prevention', () => {
    test('should clean up event listeners on beforeunload', () => {
      const cleanupSpy = jest.spyOn(global, 'cleanupMemory');

      // Simulate beforeunload event
      window.dispatchEvent(new Event('beforeunload'));

      expect(cleanupSpy).toHaveBeenCalled();
    });

    test('should handle large undo stack memory efficiently', () => {
      global.undoStack = [];
      
      // Add many large states
      for (let i = 0; i < 50; i++) {
        const largeDataUrl = 'data:image/png;base64,' + 'x'.repeat(10000);
        global.undoStack.push(largeDataUrl);
      }

      const memoryBefore = process.memoryUsage ? process.memoryUsage().heapUsed : 0;

      cleanupMemory();

      const memoryAfter = process.memoryUsage ? process.memoryUsage().heapUsed : 0;

      // Memory usage should not increase significantly
      if (process.memoryUsage) {
        expect(memoryAfter).toBeLessThanOrEqual(memoryBefore * 1.1);
      }
    });

    test('should prevent memory leaks during rapid drawing', () => {
      global.drawingPaths = [];

      // Simulate rapid drawing that could cause memory leaks
      for (let i = 0; i < 100; i++) {
        const path = {
          tool: 'pen',
          points: Array(50).fill().map((_, j) => ({
            x: i + j,
            y: i + j,
            t: performance.now()
          })),
          color: '#ef4444',
          size: 10
        };
        global.drawingPaths.push(path);
      }

      // Simulate cleanup
      cleanupMemory();

      expect(global.drawingPaths).toEqual([]);
    });
  });

  describe('Performance Monitoring', () => {
    test('should measure drawing performance', () => {
      const startTime = performance.now();

      // Simulate drawing operations
      for (let i = 0; i < 100; i++) {
        drawDot(100 + i, 100 + i);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete drawing operations quickly
      expect(duration).toBeLessThan(100);
    });

    test('should handle performance degradation during heavy operations', () => {
      global.undoStack = [];

      const startTime = performance.now();

      // Simulate heavy save operations
      for (let i = 0; i < 20; i++) {
        mockCanvas.toDataURL = jest.fn(() => 'data:image/png;base64,' + 'x'.repeat(5000));
        saveState();
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time even under load
      expect(duration).toBeLessThan(1000);
    });

    test('should schedule memory cleanup for large undo stacks', () => {
      global.undoStack = [];
      
      // Fill stack beyond half limit
      for (let i = 0; i < 20; i++) {
        global.undoStack.push(`data:image/png;base64,state-${i}`);
      }

      const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

      saveState();

      // Should schedule cleanup for large stacks
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 5000);
    });
  });

  describe('Resource Management', () => {
    test('should handle canvas context loss gracefully', () => {
      global.ctx = null;

      expect(() => drawDot(100, 100)).not.toThrow();
      expect(() => saveState()).not.toThrow();
      expect(() => applyTransform()).not.toThrow();
    });

    test('should clean up temporary canvases during export', () => {
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');

      // Mock temporary canvas cleanup
      tempCanvas.remove = jest.fn();

      exportCanvas();

      // Temporary canvas should be properly disposed
      // (Implementation would need to track and cleanup temp canvases)
    });

    test('should limit concurrent operations', () => {
      global.animationFrameRequested = false;

      // Try to start multiple mouse move optimizations
      const event1 = { clientX: 100, clientY: 100 };
      const event2 = { clientX: 200, clientY: 200 };

      optimizedMouseMove(event1);
      optimizedMouseMove(event2);

      // Should only request one animation frame
      expect(window.requestAnimationFrame).toHaveBeenCalledTimes(1);
    });
  });

  describe('Edge Cases and Error Recovery', () => {
    test('should handle out of memory situations gracefully', () => {
      // Simulate out of memory by making toDataURL fail
      mockCanvas.toDataURL = jest.fn(() => {
        throw new Error('Out of memory');
      });

      expect(() => saveState()).not.toThrow();
      
      // Should handle error and continue functioning
      expect(global.undoStack.length).toBe(0); // No state saved due to error
    });

    test('should recover from memory pressure', () => {
      // Simulate memory pressure
      global.undoStack = Array(100).fill().map((_, i) => 
        'data:image/png;base64,' + 'x'.repeat(1000)
      );

      document.hidden = true;
      handleVisibilityChange();

      // Should trim stacks under memory pressure
      expect(global.undoStack.length).toBeLessThanOrEqual(10);
    });

    test('should handle rapid memory cleanup calls', () => {
      // Rapid cleanup calls should not cause errors
      for (let i = 0; i < 10; i++) {
        cleanupMemory();
      }

      expect(global.drawingPaths).toEqual([]);
      expect(global.copiedRegion).toBeNull();
    });

    test('should maintain functionality after memory cleanup', () => {
      // Set up some state
      global.drawingPaths = [{ tool: 'pen', points: [] }];
      global.copiedRegion = { width: 100, height: 100 };

      cleanupMemory();

      // Should still be able to draw after cleanup
      const event = { preventDefault: jest.fn(), clientX: 100, clientY: 100, button: 0 };
      expect(() => startDrawing(event)).not.toThrow();
    });
  });

  describe('Background Resource Management', () => {
    test('should perform less frequent cleanup when document is visible', () => {
      document.hidden = false;
      global.undoStack = Array(50).fill('data:image/png;base64,state');

      const gcSpy = jest.spyOn(global, 'gc').mockImplementation(() => {});
      
      handleVisibilityChange();

      // Should not perform aggressive cleanup when visible
      expect(gcSpy).not.toHaveBeenCalled();
    });

    test('should defer expensive operations when document is hidden', () => {
      document.hidden = true;
      
      const trimSpy = jest.spyOn(global, 'trimUndoRedoStacks');

      handleVisibilityChange();

      expect(trimSpy).toHaveBeenCalled();
    });

    test('should maintain critical functionality during cleanup', () => {
      global.undoStack = ['state1', 'state2', 'state3'];

      cleanupMemory();

      // Should still maintain undo functionality
      expect(() => undo()).not.toThrow();
    });
  });
});
