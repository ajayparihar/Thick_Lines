/**
 * Integration Tests for User Workflows
 * Tests complete user scenarios end-to-end
 */

require('../../app.js');

describe('User Workflows (integration)', () => {
  let mockCanvas;
  let mockContext;
  let mockElements;

  beforeEach(() => {
    // Reset application state
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
    global.drawingPaths = [];
    global.currentPath = null;

    // Setup comprehensive mocks
    mockContext = {
      save: jest.fn(),
      restore: jest.fn(),
      fillRect: jest.fn(),
      clearRect: jest.fn(),
      drawImage: jest.fn(),
      beginPath: jest.fn(),
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      quadraticCurveTo: jest.fn(),
      arc: jest.fn(),
      stroke: jest.fn(),
      fill: jest.fn(),
      scale: jest.fn(),
      setTransform: jest.fn(),
      fillStyle: '#1e293b',
      strokeStyle: '#ef4444',
      lineWidth: 10,
      lineCap: 'round',
      lineJoin: 'round',
      globalCompositeOperation: 'source-over'
    };

    mockCanvas = {
      getContext: jest.fn(() => mockContext),
      width: 800,
      height: 600,
      style: {},
      toDataURL: jest.fn(() => 'data:image/png;base64,integration-test-data'),
      toBlob: jest.fn((callback) => {
        const blob = new Blob(['test-blob'], { type: 'image/png' });
        callback(blob);
      }),
      addEventListener: jest.fn(),
      getBoundingClientRect: jest.fn(() => ({
        left: 0, top: 0, width: 800, height: 600
      }))
    };

    mockElements = {
      whiteboard: { clientWidth: 800, clientHeight: 600 },
      colorButtons: [
        { dataset: { color: '#ef4444' }, classList: { add: jest.fn(), remove: jest.fn() } },
        { dataset: { color: '#10b981' }, classList: { add: jest.fn(), remove: jest.fn() } },
        { dataset: { color: '#3b82f6' }, classList: { add: jest.fn(), remove: jest.fn() } },
        { dataset: { color: '#f59e0b' }, classList: { add: jest.fn(), remove: jest.fn() } }
      ],
      penBtn: { 
        classList: { add: jest.fn(), remove: jest.fn() },
        innerHTML: '',
        addEventListener: jest.fn()
      },
      eraserBtn: { 
        classList: { add: jest.fn(), remove: jest.fn() },
        innerHTML: '',
        addEventListener: jest.fn()
      },
      undoBtn: { disabled: false, classList: { toggle: jest.fn() } },
      redoBtn: { disabled: false, classList: { toggle: jest.fn() } },
      toastContainer: { appendChild: jest.fn() }
    };

    // Mock DOM methods
    document.getElementById = jest.fn((id) => {
      if (id === 'drawing-canvas') return mockCanvas;
      if (id === 'whiteboard') return mockElements.whiteboard;
      if (id === 'penBtn') return mockElements.penBtn;
      if (id === 'eraserBtn') return mockElements.eraserBtn;
      if (id === 'undoBtn') return mockElements.undoBtn;
      if (id === 'redoBtn') return mockElements.redoBtn;
      return {
        addEventListener: jest.fn(),
        classList: { add: jest.fn(), remove: jest.fn(), toggle: jest.fn() },
        style: {}
      };
    });

    document.querySelectorAll = jest.fn((selector) => {
      if (selector === '.color-btn') return mockElements.colorButtons;
      if (selector === '.tool-btn') return [mockElements.penBtn, mockElements.eraserBtn];
      return [];
    });

    document.querySelector = jest.fn((selector) => {
      if (selector === '.color-btn.red') return mockElements.colorButtons[0];
      if (selector === '.toast-container') return mockElements.toastContainer;
      if (selector === '.toast') return null;
      return null;
    });

    document.createElement = jest.fn((tag) => {
      if (tag === 'div') return {
        className: '',
        textContent: '',
        classList: { add: jest.fn(), remove: jest.fn() }
      };
      if (tag === 'a') return {
        download: '',
        href: '',
        click: jest.fn()
      };
      return {};
    });

    document.body.appendChild = jest.fn();
    document.body.removeChild = jest.fn();

    // Mock window properties
    Object.defineProperty(window, 'devicePixelRatio', { value: 1, writable: true });
    window.confirm = jest.fn(() => true);
  });

  describe('Complete Drawing Workflow', () => {
    test('should initialize and allow drawing from start to finish', () => {
      // Step 1: Initialize application
      init();
      expect(global.appInitialized).toBe(true);
      expect(global.canvas).toBe(mockCanvas);
      expect(global.ctx).toBe(mockContext);

      // Step 2: Select pen tool
      setTool('pen');
      expect(global.currentTool).toBe('pen');
      expect(mockElements.penBtn.classList.add).toHaveBeenCalledWith('active');

      // Step 3: Select color
      global.currentColor = '#10b981';
      expect(global.currentColor).toBe('#10b981');

      // Step 4: Start drawing
      const startEvent = {
        preventDefault: jest.fn(),
        clientX: 100,
        clientY: 100
      };
      startDrawing(startEvent);
      expect(global.isDrawing).toBe(true);
      expect(global.currentPath).toBeDefined();

      // Step 5: Continue drawing
      const moveEvent = {
        preventDefault: jest.fn(),
        clientX: 150,
        clientY: 150
      };
      draw(moveEvent);
      expect(global.currentPath.points.length).toBeGreaterThan(1);

      // Step 6: Stop drawing
      stopDrawing();
      expect(global.isDrawing).toBe(false);
      expect(global.undoStack.length).toBeGreaterThan(0);
    });

    test('should handle complete eraser workflow', () => {
      // Initialize app
      init();
      
      // Switch to eraser
      setTool('eraser');
      expect(global.currentTool).toBe('eraser');

      // Start erasing
      const startEvent = {
        preventDefault: jest.fn(),
        clientX: 200,
        clientY: 200
      };
      startDrawing(startEvent);
      expect(global.isDrawing).toBe(true);
      expect(mockContext.globalCompositeOperation).toBe('destination-out');

      // Continue erasing
      const moveEvent = {
        preventDefault: jest.fn(),
        clientX: 250,
        clientY: 250
      };
      draw(moveEvent);

      // Stop erasing
      stopDrawing();
      expect(global.isDrawing).toBe(false);
    });

    test('should handle undo/redo workflow', () => {
      // Initialize and create some states
      init();
      global.undoStack = ['state1', 'state2', 'state3'];
      global.redoStack = [];

      // Undo operation
      undo();
      expect(global.undoStack).toEqual(['state1', 'state2']);
      expect(global.redoStack).toEqual(['state3']);

      // Redo operation
      redo();
      expect(global.undoStack).toEqual(['state1', 'state2', 'state3']);
      expect(global.redoStack).toEqual([]);
    });
  });

  describe('Color and Tool Switching', () => {
    test('should switch colors and maintain tool state', () => {
      init();

      // Start with pen and red color
      setTool('pen');
      global.currentColor = '#ef4444';

      // Switch to green
      global.currentColor = '#10b981';
      expect(global.currentColor).toBe('#10b981');
      expect(global.currentTool).toBe('pen'); // Should stay pen

      // Switch to eraser
      setTool('eraser');
      expect(global.currentTool).toBe('eraser');

      // Select color should switch back to pen
      setTool('pen');
      expect(global.currentTool).toBe('pen');
    });

    test('should maintain size settings across tool switches', () => {
      init();

      // Set custom sizes
      global.penSize = 25;
      global.eraserSize = 35;

      // Switch to pen
      setTool('pen');
      expect(mockElements.penBtn.innerHTML).toContain('25px');

      // Switch to eraser
      setTool('eraser');
      expect(mockElements.eraserBtn.innerHTML).toContain('35px');

      // Switch back to pen
      setTool('pen');
      expect(mockElements.penBtn.innerHTML).toContain('25px');
    });
  });

  describe('Pan and Zoom Workflow', () => {
    test('should handle complete pan workflow', () => {
      init();

      // Start panning
      const startEvent = { clientX: 100, clientY: 100 };
      startCanvasPan(startEvent);
      expect(global.isPanning).toBe(true);
      expect(mockCanvas.style.cursor).toBe('grabbing');

      // Move during pan
      const moveEvent = { clientX: 150, clientY: 150 };
      moveCanvasPan(moveEvent);
      expect(global.panOffsetX).toBe(50);
      expect(global.panOffsetY).toBe(50);

      // Stop panning
      stopCanvasPan();
      expect(global.isPanning).toBe(false);
      expect(mockCanvas.style.cursor).toBe('');
    });

    test('should handle zoom and coordinate transformation', () => {
      init();
      global.zoomLevel = 2.0;
      global.panOffsetX = 100;
      global.panOffsetY = 100;

      // Test coordinate transformation
      const event = { clientX: 300, clientY: 400 };
      const coords = getCoordinates(event);

      expect(coords.x).toBe(100); // (300 - 100) / 2
      expect(coords.y).toBe(150); // (400 - 100) / 2
    });
  });

  describe('Export and Clear Operations', () => {
    test('should handle canvas export workflow', () => {
      init();
      global.undoStack = ['state1', 'state2'];

      // Mock Image for export
      const mockImage = {
        onload: null,
        onerror: null,
        src: ''
      };
      global.Image = jest.fn(() => mockImage);

      // Mock document.createElement for temporary canvas and link
      document.createElement = jest.fn((tag) => {
        if (tag === 'canvas') return {
          width: 800,
          height: 600,
          getContext: jest.fn(() => ({
            fillStyle: '#1e293b',
            fillRect: jest.fn(),
            drawImage: jest.fn()
          })),
          toDataURL: jest.fn(() => 'data:image/png;base64,export-data')
        };
        if (tag === 'a') return {
          download: '',
          href: '',
          click: jest.fn()
        };
        return {};
      });

      exportCanvas();

      expect(global.Image).toHaveBeenCalled();
      expect(document.createElement).toHaveBeenCalledWith('canvas');
    });

    test('should handle canvas clear workflow', () => {
      init();
      global.undoStack = ['state1', 'state2'];
      window.confirm = jest.fn(() => true);

      clearCanvas();

      expect(window.confirm).toHaveBeenCalled();
      expect(mockContext.fillStyle).toBe('#1e293b');
      expect(mockContext.fillRect).toHaveBeenCalled();
      expect(global.undoStack).toHaveLength(0);
      expect(global.redoStack).toHaveLength(0);
    });

    test('should cancel clear when user declines confirmation', () => {
      init();
      global.undoStack = ['state1', 'state2'];
      window.confirm = jest.fn(() => false);

      clearCanvas();

      expect(global.undoStack).toEqual(['state1', 'state2']); // Unchanged
    });
  });

  describe('Touch and Mouse Integration', () => {
    test('should handle drawing with both mouse and touch', () => {
      init();
      setTool('pen');

      // Start with mouse
      const mouseDown = {
        preventDefault: jest.fn(),
        button: 0,
        clientX: 100,
        clientY: 100
      };
      handleMouseDown(mouseDown);
      expect(global.isDrawing).toBe(true);

      // Stop mouse drawing
      handleMouseUp({ preventDefault: jest.fn() });
      expect(global.isDrawing).toBe(false);

      // Start with touch
      const touchStart = {
        preventDefault: jest.fn(),
        touches: [{ clientX: 200, clientY: 200 }]
      };
      handleTouchStart(touchStart);
      expect(global.isDrawing).toBe(true);

      // Stop touch drawing
      const touchEnd = { touches: [] };
      handleTouchEnd(touchEnd);
      expect(global.isDrawing).toBe(false);
    });

    test('should handle mixed input during complex interactions', () => {
      init();

      // Start touch panning
      const twoFingerTouch = {
        preventDefault: jest.fn(),
        touches: [
          { clientX: 100, clientY: 100 },
          { clientX: 200, clientY: 200 }
        ]
      };
      handleTouchStart(twoFingerTouch);
      expect(global.isPanning).toBe(true);

      // End touch, should stop panning
      const touchEnd = { touches: [] };
      handleTouchEnd(touchEnd);
      expect(global.isPanning).toBe(false);

      // Start mouse drawing
      const mouseDown = {
        preventDefault: jest.fn(),
        button: 0,
        clientX: 150,
        clientY: 150
      };
      handleMouseDown(mouseDown);
      expect(global.isDrawing).toBe(true);
    });
  });

  describe('Error Recovery Workflows', () => {
    test('should recover from canvas context errors', () => {
      // Simulate context error during initialization
      mockCanvas.getContext = jest.fn(() => { throw new Error('Context error'); });

      init();

      expect(global.appInitialized).toBe(false);
      
      // Fix the context and reinitialize
      mockCanvas.getContext = jest.fn(() => mockContext);
      global.appInitialized = false; // Reset flag

      init();

      expect(global.appInitialized).toBe(true);
    });

    test('should handle state corruption gracefully', () => {
      init();
      
      // Simulate corrupted undo stack
      global.undoStack = ['invalid-data-url'];
      
      const mockImage = {
        onload: null,
        onerror: jest.fn(),
        src: ''
      };
      global.Image = jest.fn(() => mockImage);

      // Attempt to load corrupted state
      loadState('invalid-data-url');
      mockImage.onerror();

      // App should continue functioning
      expect(() => setTool('pen')).not.toThrow();
      expect(() => startDrawing({ preventDefault: jest.fn(), clientX: 100, clientY: 100 })).not.toThrow();
    });

    test('should handle memory exhaustion scenarios', () => {
      init();

      // Fill undo stack beyond limit
      for (let i = 0; i < 50; i++) {
        global.undoStack.push(`large-state-${i}`);
      }

      // Trigger memory cleanup
      trimUndoRedoStacks();

      expect(global.undoStack.length).toBeLessThanOrEqual(10);
      expect(global.redoStack).toHaveLength(0);

      // Should still be able to draw
      expect(() => startDrawing({ preventDefault: jest.fn(), clientX: 100, clientY: 100 })).not.toThrow();
    });
  });

  describe('Performance Integration', () => {
    test('should handle rapid drawing operations', () => {
      init();
      setTool('pen');

      // Simulate rapid drawing
      startDrawing({ preventDefault: jest.fn(), clientX: 100, clientY: 100 });

      for (let i = 0; i < 100; i++) {
        draw({ preventDefault: jest.fn(), clientX: 100 + i, clientY: 100 + i });
      }

      stopDrawing();

      expect(global.currentPath).toBe(null);
      expect(global.isDrawing).toBe(false);
      expect(global.undoStack.length).toBeGreaterThan(0);
    });

    test('should handle frequent tool switching', () => {
      init();

      // Rapidly switch tools
      for (let i = 0; i < 10; i++) {
        setTool(i % 2 === 0 ? 'pen' : 'eraser');
      }

      expect(global.currentTool).toBe('eraser');
      expect(() => startDrawing({ preventDefault: jest.fn(), clientX: 100, clientY: 100 })).not.toThrow();
    });

    test('should handle window resize during operation', () => {
      init();
      
      // Start drawing
      startDrawing({ preventDefault: jest.fn(), clientX: 100, clientY: 100 });
      
      // Trigger resize
      resizeCanvas();
      
      // Should continue working
      expect(global.canvas).toBe(mockCanvas);
      expect(() => draw({ preventDefault: jest.fn(), clientX: 150, clientY: 150 })).not.toThrow();
    });
  });

  describe('Accessibility Integration', () => {
    test('should maintain keyboard navigation throughout workflow', () => {
      init();

      // Use keyboard to select color
      const colorKeyEvent = {
        key: '2',
        ctrlKey: false,
        target: { tagName: 'DIV' }
      };
      handleKeyDown(colorKeyEvent);

      // Use keyboard to switch tool
      const penKeyEvent = {
        key: 'p',
        ctrlKey: false,
        target: { tagName: 'DIV' }
      };
      handleKeyDown(penKeyEvent);
      expect(global.currentTool).toBe('pen');

      // Use keyboard for undo
      const undoKeyEvent = {
        key: 'z',
        ctrlKey: true,
        preventDefault: jest.fn(),
        target: { tagName: 'DIV' }
      };
      global.undoStack = ['state1', 'state2'];
      handleKeyDown(undoKeyEvent);
      expect(undoKeyEvent.preventDefault).toHaveBeenCalled();
    });

    test('should ignore keyboard shortcuts in input fields', () => {
      init();

      const inputEvent = {
        key: 'z',
        ctrlKey: true,
        target: { tagName: 'INPUT' }
      };

      const initialTool = global.currentTool;
      handleKeyDown(inputEvent);

      expect(global.currentTool).toBe(initialTool); // Unchanged
    });
  });

  describe('Memory Management Integration', () => {
    test('should manage memory across complete user session', () => {
      init();

      // Create drawing session with multiple operations
      for (let i = 0; i < 20; i++) {
        startDrawing({ preventDefault: jest.fn(), clientX: i * 10, clientY: i * 10 });
        draw({ preventDefault: jest.fn(), clientX: i * 10 + 50, clientY: i * 10 + 50 });
        stopDrawing();
      }

      const initialStackSize = global.undoStack.length;

      // Trigger memory cleanup
      cleanupMemory();

      expect(global.drawingPaths).toHaveLength(0);
      expect(global.copiedRegion).toBe(null);
    });

    test('should handle page visibility changes during drawing', () => {
      init();
      
      // Start drawing
      startDrawing({ preventDefault: jest.fn(), clientX: 100, clientY: 100 });
      
      // Page becomes hidden
      Object.defineProperty(document, 'hidden', { value: true, writable: true });
      handleVisibilityChange();
      
      // Page becomes visible again
      Object.defineProperty(document, 'hidden', { value: false, writable: true });
      global.undoStack = ['restored-state'];
      handleVisibilityChange();
      
      // Should continue functioning
      expect(() => draw({ preventDefault: jest.fn(), clientX: 150, clientY: 150 })).not.toThrow();
    });
  });

  describe('Edge Case Integration', () => {
    test('should handle simultaneous operations gracefully', () => {
      init();

      // Try to start drawing and panning simultaneously
      global.isDrawing = true;
      global.isPanning = true;

      const event = { preventDefault: jest.fn(), clientX: 100, clientY: 100 };
      
      // Should handle conflicting states
      handleMouseUp(event);
      
      expect(global.isDrawing).toBe(false);
      expect(global.isPanning).toBe(false);
    });

    test('should maintain state consistency across errors', () => {
      init();
      
      // Create initial state
      global.undoStack = ['good-state'];
      
      // Trigger error during drawing
      mockContext.save = jest.fn(() => { throw new Error('Drawing error'); });
      
      startDrawing({ preventDefault: jest.fn(), clientX: 100, clientY: 100 });
      
      expect(global.isDrawing).toBe(false); // Should reset on error
      expect(global.undoStack).toEqual(['good-state']); // Should preserve existing state
    });
  });
});
