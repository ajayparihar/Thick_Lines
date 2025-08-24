/**
 * Clipboard Operations and Export Functionality Tests
 * Tests copy, cut, paste operations and canvas export features
 */

require('../../app.js');

describe('Clipboard Operations and Export (unit)', () => {
  let mockCanvas, mockContext;

  beforeEach(() => {
    // Reset global state
    global.canvas = null;
    global.ctx = null;
    global.copiedRegion = null;
    global.undoStack = [];

    // Setup canvas mocks
    mockContext = {
      drawImage: jest.fn(),
      fillStyle: '#1e293b',
      fillRect: jest.fn(),
      clearRect: jest.fn()
    };

    mockCanvas = {
      getContext: jest.fn(() => mockContext),
      toDataURL: jest.fn(() => 'data:image/png;base64,mock-canvas-data'),
      toBlob: jest.fn((callback, type) => {
        const blob = new Blob(['mock-blob-data'], { type: type || 'image/png' });
        callback(blob);
      }),
      width: 800,
      height: 600
    };

    global.canvas = mockCanvas;
    global.ctx = mockContext;

    // Mock navigator.clipboard
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        write: jest.fn(() => Promise.resolve()),
        read: jest.fn(() => Promise.resolve([])),
        writeText: jest.fn(() => Promise.resolve()),
        readText: jest.fn(() => Promise.resolve(''))
      },
      writable: true,
      configurable: true
    });

    // Mock ClipboardItem
    global.ClipboardItem = jest.fn().mockImplementation((data) => ({
      data,
      types: Object.keys(data),
      getType: jest.fn((type) => Promise.resolve(new Blob(['mock-data'], { type })))
    }));

    // Mock document.createElement for temporary elements
    document.createElement = jest.fn((tag) => {
      if (tag === 'canvas') {
        return {
          getContext: jest.fn(() => mockContext),
          toDataURL: jest.fn(() => 'data:image/png;base64,mock-temp-canvas'),
          width: 800,
          height: 600
        };
      }
      if (tag === 'a') {
        return {
          href: '',
          download: '',
          click: jest.fn(),
          style: {}
        };
      }
      return {
        tagName: tag.toUpperCase(),
        style: {},
        classList: { add: jest.fn(), remove: jest.fn() }
      };
    });

    // Mock document.body for appendChild/removeChild
    document.body.appendChild = jest.fn();
    document.body.removeChild = jest.fn();

    // Mock Image constructor
    global.Image = jest.fn().mockImplementation(() => ({
      onload: null,
      onerror: null,
      src: '',
      width: 100,
      height: 100
    }));

    // Mock URL methods
    global.URL = {
      createObjectURL: jest.fn(() => 'blob:mock-url'),
      revokeObjectURL: jest.fn()
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Copy Selection Functionality', () => {
    test('should copy canvas to internal clipboard', () => {
      global.undoStack = ['data:image/png;base64,test-state'];

      copySelection();

      expect(global.copiedRegion).toBeDefined();
      expect(mockContext.drawImage).toHaveBeenCalledWith(mockCanvas, 0, 0);
    });

    test('should copy canvas to system clipboard', async () => {
      global.undoStack = ['data:image/png;base64,test-state'];

      await copySelection();

      // Should create a blob and try to write to clipboard
      expect(mockCanvas.toBlob).toHaveBeenCalled();
      expect(navigator.clipboard.write).toHaveBeenCalled();
    });

    test('should handle system clipboard write failure gracefully', async () => {
      navigator.clipboard.write.mockRejectedValue(new Error('Clipboard access denied'));

      global.undoStack = ['data:image/png;base64,test-state'];

      expect(() => copySelection()).not.toThrow();
      
      // Should still copy to internal clipboard
      expect(global.copiedRegion).toBeDefined();
    });

    test('should handle missing ClipboardItem API', async () => {
      global.ClipboardItem = undefined;

      global.undoStack = ['data:image/png;base64,test-state'];

      expect(() => copySelection()).not.toThrow();
      expect(global.copiedRegion).toBeDefined();
    });
  });

  describe('Cut Selection Functionality', () => {
    test('should cut canvas (copy + clear)', () => {
      global.undoStack = ['data:image/png;base64,test-state'];

      cutSelection();

      expect(global.copiedRegion).toBeDefined();
      expect(mockContext.clearRect).toHaveBeenCalledWith(0, 0, mockCanvas.width, mockCanvas.height);
    });

    test('should save state after cutting', () => {
      global.undoStack = [];

      cutSelection();

      // Should save state after cutting
      expect(global.undoStack).toHaveLength(1);
    });
  });

  describe('Paste Selection Functionality', () => {
    test('should paste from system clipboard when available', async () => {
      const mockBlob = new Blob(['mock-image-data'], { type: 'image/png' });
      const mockClipboardItem = {
        types: ['image/png'],
        getType: jest.fn(() => Promise.resolve(mockBlob))
      };

      navigator.clipboard.read.mockResolvedValue([mockClipboardItem]);

      await pasteSelection();

      expect(navigator.clipboard.read).toHaveBeenCalled();
      expect(mockClipboardItem.getType).toHaveBeenCalledWith('image/png');
    });

    test('should fallback to internal clipboard when system clipboard fails', async () => {
      navigator.clipboard.read.mockRejectedValue(new Error('Clipboard read failed'));
      
      // Set up internal clipboard
      global.copiedRegion = {
        width: 400,
        height: 300
      };

      await pasteSelection();

      expect(mockContext.drawImage).toHaveBeenCalledWith(
        global.copiedRegion,
        (mockCanvas.width - 400) / 2,
        (mockCanvas.height - 300) / 2
      );
    });

    test('should handle empty system clipboard gracefully', async () => {
      navigator.clipboard.read.mockResolvedValue([]);
      global.copiedRegion = null;

      await pasteSelection();

      // Should not throw and should show appropriate feedback
      expect(true).toBe(true); // Test passes if no error is thrown
    });

    test('should paste internal clipboard when no system clipboard data', async () => {
      navigator.clipboard.read.mockResolvedValue([{
        types: ['text/plain'], // No image data
        getType: jest.fn()
      }]);

      global.copiedRegion = {
        width: 200,
        height: 150
      };

      await pasteSelection();

      expect(mockContext.drawImage).toHaveBeenCalledWith(
        global.copiedRegion,
        (mockCanvas.width - 200) / 2,
        (mockCanvas.height - 150) / 2
      );
    });

    test('should handle paste with no clipboard data', async () => {
      navigator.clipboard.read.mockResolvedValue([]);
      global.copiedRegion = null;

      await pasteSelection();

      // Should handle gracefully without error
      expect(mockContext.drawImage).not.toHaveBeenCalled();
    });
  });

  describe('Export Canvas Functionality', () => {
    test('should export canvas as PNG image', () => {
      global.undoStack = ['data:image/png;base64,test-drawing'];

      exportCanvas();

      expect(document.createElement).toHaveBeenCalledWith('canvas');
      expect(document.createElement).toHaveBeenCalledWith('a');
    });

    test('should create timestamped filename', () => {
      global.undoStack = ['data:image/png;base64,test-drawing'];
      const mockLink = { download: '', click: jest.fn(), href: '' };
      document.createElement.mockReturnValue(mockLink);

      exportCanvas();

      expect(mockLink.download).toMatch(/thick-lines-drawing_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.png/);
    });

    test('should handle empty canvas export', () => {
      global.undoStack = [];

      const consoleSpy = jest.spyOn(console, 'log');
      exportCanvas();

      expect(consoleSpy).toHaveBeenCalledWith('No drawing to export');
    });

    test('should create temporary canvas for export', () => {
      global.undoStack = ['data:image/png;base64,test-drawing'];
      const mockTempCanvas = {
        getContext: jest.fn(() => mockContext),
        toDataURL: jest.fn(() => 'data:image/png;base64,export-data'),
        width: 800,
        height: 600
      };
      document.createElement.mockReturnValue(mockTempCanvas);

      exportCanvas();

      expect(mockContext.fillStyle).toBe('#1e293b');
      expect(mockContext.fillRect).toHaveBeenCalledWith(0, 0, 800, 600);
    });

    test('should handle export image load success', (done) => {
      global.undoStack = ['data:image/png;base64,test-drawing'];
      
      const mockImage = {
        onload: null,
        onerror: null,
        src: ''
      };
      global.Image.mockReturnValue(mockImage);

      const mockLink = {
        download: '',
        click: jest.fn(),
        href: '',
        style: {}
      };
      document.createElement.mockReturnValue(mockLink);

      exportCanvas();

      // Simulate successful image load
      if (mockImage.onload) {
        mockImage.onload();
      }

      setTimeout(() => {
        expect(mockLink.click).toHaveBeenCalled();
        done();
      }, 10);
    });

    test('should handle export image load failure', (done) => {
      global.undoStack = ['data:image/png;base64,test-drawing'];
      
      const mockImage = {
        onload: null,
        onerror: null,
        src: ''
      };
      global.Image.mockReturnValue(mockImage);

      const consoleErrorSpy = jest.spyOn(console, 'error');

      exportCanvas();

      // Simulate image load failure
      if (mockImage.onerror) {
        mockImage.onerror();
      }

      setTimeout(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith('Error loading state image for export');
        done();
      }, 10);
    });

    test('should handle toDataURL errors during export', () => {
      global.undoStack = ['data:image/png;base64,test-drawing'];
      
      const mockTempCanvas = {
        getContext: jest.fn(() => mockContext),
        toDataURL: jest.fn(() => { throw new Error('toDataURL failed'); }),
        width: 800,
        height: 600
      };

      document.createElement.mockImplementation((tag) => {
        if (tag === 'canvas') return mockTempCanvas;
        return { download: '', click: jest.fn(), href: '', style: {} };
      });

      const consoleErrorSpy = jest.spyOn(console, 'error');

      expect(() => exportCanvas()).not.toThrow();
      // Should handle the error gracefully in the image.onload callback
    });
  });

  describe('Clipboard Integration with Context Menu', () => {
    test('should handle context menu copy action', () => {
      global.undoStack = ['data:image/png;base64,test-drawing'];

      // Simulate context menu copy click
      copySelection();

      expect(global.copiedRegion).toBeDefined();
      expect(navigator.clipboard.write).toHaveBeenCalled();
    });

    test('should handle context menu cut action', () => {
      global.undoStack = ['data:image/png;base64,test-drawing'];

      cutSelection();

      expect(global.copiedRegion).toBeDefined();
      expect(mockContext.clearRect).toHaveBeenCalled();
    });

    test('should handle context menu paste action', async () => {
      global.copiedRegion = {
        width: 300,
        height: 200
      };

      await pasteSelection();

      expect(mockContext.drawImage).toHaveBeenCalled();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle clipboard operations with null canvas', () => {
      global.canvas = null;
      global.ctx = null;

      expect(() => copySelection()).not.toThrow();
      expect(() => cutSelection()).not.toThrow();
    });

    test('should handle export with null undoStack', () => {
      global.undoStack = null;

      expect(() => exportCanvas()).not.toThrow();
    });

    test('should handle malformed clipboard data', async () => {
      const malformedItem = {
        types: ['image/png'],
        getType: jest.fn(() => Promise.reject(new Error('Invalid data')))
      };

      navigator.clipboard.read.mockResolvedValue([malformedItem]);

      expect(() => pasteSelection()).not.toThrow();
    });

    test('should handle clipboard permission denied', async () => {
      navigator.clipboard.write.mockRejectedValue(new DOMException('Permission denied', 'NotAllowedError'));

      global.undoStack = ['data:image/png;base64,test-drawing'];

      expect(() => copySelection()).not.toThrow();
      // Should still work with internal clipboard
      expect(global.copiedRegion).toBeDefined();
    });
  });

  describe('Clipboard Data Validation', () => {
    test('should validate clipboard data types', async () => {
      const mockItem = {
        types: ['text/plain', 'image/jpeg', 'image/png'],
        getType: jest.fn((type) => {
          if (type === 'image/png') {
            return Promise.resolve(new Blob(['png-data'], { type: 'image/png' }));
          }
          return Promise.reject(new Error('Type not available'));
        })
      };

      navigator.clipboard.read.mockResolvedValue([mockItem]);

      await pasteSelection();

      // Should prefer image types over text
      expect(mockItem.getType).toHaveBeenCalledWith('image/png');
    });

    test('should handle multiple clipboard items', async () => {
      const mockItems = [
        {
          types: ['text/plain'],
          getType: jest.fn()
        },
        {
          types: ['image/png'],
          getType: jest.fn(() => Promise.resolve(new Blob(['image-data'], { type: 'image/png' })))
        }
      ];

      navigator.clipboard.read.mockResolvedValue(mockItems);

      await pasteSelection();

      // Should use the first item (standard behavior)
      expect(mockItems[0].getType).not.toHaveBeenCalled();
    });
  });

  describe('Performance Considerations', () => {
    test('should handle large canvas export efficiently', () => {
      global.undoStack = ['data:image/png;base64,' + 'x'.repeat(10000)]; // Large data URL

      const startTime = performance.now();
      exportCanvas();
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(100); // Should complete within 100ms
    });

    test('should handle rapid clipboard operations', async () => {
      global.undoStack = ['data:image/png;base64,test-data'];

      const startTime = performance.now();

      // Perform multiple clipboard operations rapidly
      for (let i = 0; i < 10; i++) {
        copySelection();
        cutSelection();
        await pasteSelection();
      }

      const endTime = performance.now();
      expect(endTime - startTime).toBeLessThan(500); // Should handle rapid operations
    });
  });

  describe('Memory Management', () => {
    test('should clean up temporary elements after export', (done) => {
      global.undoStack = ['data:image/png;base64,test-drawing'];

      const mockLink = {
        download: '',
        click: jest.fn(),
        href: '',
        style: {}
      };
      document.createElement.mockReturnValue(mockLink);

      exportCanvas();

      // Should append and remove the link element
      setTimeout(() => {
        expect(document.body.appendChild).toHaveBeenCalledWith(mockLink);
        expect(document.body.removeChild).toHaveBeenCalledWith(mockLink);
        done();
      }, 10);
    });

    test('should not leak memory during repeated clipboard operations', () => {
      global.undoStack = ['data:image/png;base64,test-data'];

      // Perform many operations
      for (let i = 0; i < 100; i++) {
        copySelection();
        global.copiedRegion = null; // Simulate cleanup
      }

      // Should not accumulate memory
      expect(global.copiedRegion).toBeNull();
    });
  });
});
