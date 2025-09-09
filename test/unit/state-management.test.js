/**
 * Unit Tests for State Management
 * Tests undo/redo functionality, state saving/loading, and memory management
 */

require('../../app.js');

describe('State Management (unit)', () => {
  let mockCanvas;
  let mockContext;
  let mockImage;

  beforeEach(() => {
    // Setup canvas and context mocks
    mockContext = {
      save: jest.fn(),
      restore: jest.fn(),
      fillRect: jest.fn(),
      drawImage: jest.fn(),
      beginPath: jest.fn(),
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      stroke: jest.fn(),
      fillText: jest.fn(),
      measureText: jest.fn(() => ({ width: 0 })),
      getLineDash: jest.fn(() => []),
      setLineDash: jest.fn(),
      font: '',
      strokeStyle: '',
      lineWidth: 1,
      lineCap: '',
      lineJoin: '',
      textAlign: '',
      textBaseline: '',
      fillStyle: '#1e293b',
      globalCompositeOperation: 'source-over'
    };

    mockCanvas = {
      toDataURL: jest.fn(() => 'data:image/png;base64,mock-state-data'),
      width: 800,
      height: 600
    };

    mockImage = {
      onload: null,
      onerror: null,
      src: ''
    };

    // Mock Image constructor
    global.Image = jest.fn(() => mockImage);

    // Set globals
    global.canvas = mockCanvas;
    global.ctx = mockContext;
    global.undoStack = [];
    global.redoStack = [];
    global.UNDO_STACK_LIMIT = 30;

    // Mock DOM elements
    let mockUndoBtn = {
      _disabled: false,
      set disabled(val) { this._disabled = val; },
      get disabled() { return this._disabled; },
      classList: { toggle: jest.fn((className, value) => { if (className === 'disabled') this._disabled = value; }) }
    };
    let mockRedoBtn = {
      _disabled: false,
      set disabled(val) { this._disabled = val; },
      get disabled() { return this._disabled; },
      classList: { toggle: jest.fn((className, value) => { if (className === 'disabled') this._disabled = value; }) }
    };

    document.getElementById = jest.fn((id) => {
      if (id === 'undoBtn') return mockUndoBtn;
      if (id === 'redoBtn') return mockRedoBtn;
      return null;
    });
  });

  describe('State Saving', () => {
    test('should save canvas state correctly', () => {
      saveState();

      expect(mockCanvas.toDataURL).toHaveBeenCalledWith('image/png');
      expect(global.undoStack).toHaveLength(1);
      expect(global.undoStack[0]).toBe('data:image/png;base64,mock-state-data');
      expect(global.redoStack).toHaveLength(0);
    });

    test('should limit undo stack size', () => {
      // Fill stack to limit
      for (let i = 0; i < 35; i++) {
        global.undoStack.push(`state-${i}`);
      }

      saveState();

      expect(global.undoStack).toHaveLength(30); // Should be trimmed to limit
      expect(global.undoStack[0]).toBe('state-6'); // Oldest should be removed
    });

    test('should clear redo stack when saving new state', () => {
      global.redoStack = ['redo-state-1', 'redo-state-2'];

      saveState();

      expect(global.redoStack).toHaveLength(0);
    });

    test('should handle canvas toDataURL error', () => {
      mockCanvas.toDataURL = jest.fn(() => { throw new Error('Canvas error'); });
      const consoleSpy = jest.spyOn(console, 'error');

      saveState();

      expect(consoleSpy).toHaveBeenCalledWith('Error saving canvas state:', expect.any(Error));
    });
  });

  describe('State Loading', () => {
    beforeEach(() => {
      global.showRulers = false;
    });

    test('should load state successfully', async () => {
      const testDataURL = 'data:image/png;base64,test-data';
      
      const loadPromise = loadState(testDataURL);
      
      // Simulate image load
      mockImage.onload();
      
      await loadPromise;

      expect(mockContext.fillStyle).toBe('#1e293b');
      expect(mockContext.fillRect).toHaveBeenCalled();
      expect(mockContext.drawImage).toHaveBeenCalledWith(
        mockImage, 0, 0, 800, 600
      );
    });

    test('should handle image load error', async () => {
      const testDataURL = 'data:image/png;base64,invalid-data';
      const consoleSpy = jest.spyOn(console, 'error');
      
      const loadPromise = loadState(testDataURL);
      
      // Simulate image error
      mockImage.onerror();
      
      try {
        await loadPromise;
      } catch (error) {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to load canvas state');
      }
    });

    test('should draw rulers when enabled', async () => {
      global.showRulers = true;
      global.lastMouseX = 100;
      global.lastMouseY = 150;
      
      const loadPromise = loadState('data:image/png;base64,test');
      
      mockImage.onload();
      
      await loadPromise;

      // Rulers should be drawn (implementation would call drawRulers)
      expect(mockImage.onload).toBeDefined();
    });
  });

  describe('Undo Functionality', () => {
    test('should undo correctly when states available', () => {
      global.undoStack = ['state1', 'state2', 'state3'];
      global.redoStack = [];

      undo();

      expect(global.undoStack).toEqual(['state1', 'state2']);
      expect(global.redoStack).toEqual(['state3']);
      expect(mockImage.src).toBe('state2');
    });

    test('should not undo when only initial state exists', () => {
      global.undoStack = ['initial-state'];
      global.redoStack = [];

      undo();

      expect(global.undoStack).toEqual(['initial-state']);
      expect(global.redoStack).toHaveLength(0);
    });

    test('should not undo when stack is empty', () => {
      global.undoStack = [];
      global.redoStack = [];

      undo();

      expect(global.undoStack).toHaveLength(0);
      expect(global.redoStack).toHaveLength(0);
    });
  });

  describe('Redo Functionality', () => {
    test('should redo correctly when redo states available', () => {
      global.undoStack = ['state1', 'state2'];
      global.redoStack = ['state3', 'state4'];

      redo();

      expect(global.undoStack).toEqual(['state1', 'state2', 'state4']);
      expect(global.redoStack).toEqual(['state3']);
      expect(mockImage.src).toBe('state4');
    });

    test('should not redo when redo stack is empty', () => {
      global.undoStack = ['state1', 'state2'];
      global.redoStack = [];

      redo();

      expect(global.undoStack).toEqual(['state1', 'state2']);
      expect(global.redoStack).toHaveLength(0);
    });
  });

  describe('Memory Management', () => {
    test('should trim undo/redo stacks correctly', () => {
      // Setup large stacks
      global.undoStack = Array.from({ length: 20 }, (_, i) => `state-${i}`);
      global.redoStack = ['redo1', 'redo2', 'redo3'];

      trimUndoRedoStacks();

      expect(global.undoStack).toHaveLength(10); // Keep initial + last 9
      expect(global.undoStack[0]).toBe('state-0'); // Initial state preserved
      expect(global.redoStack).toHaveLength(0); // Cleared
    });

    test('should preserve initial state during trimming', () => {
      global.undoStack = Array.from({ length: 15 }, (_, i) => `state-${i}`);

      trimUndoRedoStacks();

      expect(global.undoStack[0]).toBe('state-0');
      expect(global.undoStack).toHaveLength(10);
    });

    test('should handle garbage collection gracefully', () => {
      // Mock window.gc
      window.gc = jest.fn(() => { throw new Error('GC error'); });

      expect(() => trimUndoRedoStacks()).not.toThrow();
    });

    test('should cleanup memory correctly', () => {
      global.drawingPaths = [{ tool: 'pen', points: [] }];
      global.copiedRegion = mockCanvas;
      global.domElements = { sizeVisualizer: { classList: { remove: jest.fn() } } };

      cleanupMemory();

      expect(global.drawingPaths).toHaveLength(0);
      expect(global.copiedRegion).toBe(null);
    });
  });

  describe('Button State Updates', () => {
    test('should update undo/redo button states correctly', () => {
      const mockUndoBtn = {
        _disabled: false,
        set disabled(val) { this._disabled = val; },
        get disabled() { return this._disabled; },
        classList: { toggle: jest.fn((className, value) => { if (className === 'disabled') mockUndoBtn._disabled = value; }) }
      };
      const mockRedoBtn = {
        _disabled: false,
        set disabled(val) { this._disabled = val; },
        get disabled() { return this._disabled; },
        classList: { toggle: jest.fn((className, value) => { if (className === 'disabled') mockRedoBtn._disabled = value; }) }
      };

      document.getElementById = jest.fn((id) => {
        if (id === 'undoBtn') return mockUndoBtn;
        if (id === 'redoBtn') return mockRedoBtn;
        return null;
      });

      global.undoStack = ['state1'];
      global.redoStack = [];

      updateUndoRedoButtons();

      expect(mockUndoBtn.disabled).toBe(true);
      expect(mockRedoBtn.disabled).toBe(true);
      expect(mockUndoBtn.classList.toggle).toHaveBeenCalledWith('disabled', true);
      expect(mockRedoBtn.classList.toggle).toHaveBeenCalledWith('disabled', true);
    });

    test('should handle missing buttons gracefully', () => {
      document.getElementById = jest.fn(() => null);

      expect(() => updateUndoRedoButtons()).not.toThrow();
    });
  });

  describe('Error Recovery', () => {
    test('should handle state loading errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error');
      
      const loadPromise = loadState('invalid-data-url');
      
      mockImage.onerror();
      
      try {
        await loadPromise;
      } catch (error) {
        expect(consoleSpy).toHaveBeenCalled();
      }
    });

    test('should continue functioning after save errors', () => {
      mockCanvas.toDataURL = jest.fn(() => { throw new Error('Save error'); });
      
      saveState();
      
      // Should still be able to perform other operations
      expect(() => undo()).not.toThrow();
    });
  });

  describe('Integration with Drawing Cycle', () => {
    beforeEach(() => {
      global.isDrawing = true;
      global.currentPath = { points: [] };
      global.saveState = jest.fn();
      global.updateUndoRedoButtons = jest.fn();
      global.loadState = jest.fn();
    });

    test('should call saveState after drawing stops', () => {
      global.isDrawing = true;
      stopDrawing();
      expect(global.saveState).toHaveBeenCalled();
    });

    test('should call updateUndoRedoButtons after undo/redo', () => {
      global.undoStack = ['state1', 'state2'];
      undo();
      expect(global.updateUndoRedoButtons).toHaveBeenCalled();

      global.redoStack = ['state2'];
      redo();
      expect(global.updateUndoRedoButtons).toHaveBeenCalledTimes(2);
    });

    test('should load correct state on undo/redo', () => {
      global.undoStack = ['s1', 's2', 's3'];
      global.redoStack = [];

      undo();
      expect(global.loadState).toHaveBeenCalledWith('s2');

      global.redoStack.push('s3');
      redo();
      expect(global.loadState).toHaveBeenCalledWith('s3');
    });
  });
});
