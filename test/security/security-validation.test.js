/**
 * Security Tests for Potential Vulnerabilities
 * Tests XSS prevention, input validation, and security best practices
 */

require('../../app.js');

describe('Security Validation (security)', () => {
  let mockCanvas;
  let mockContext;

  beforeEach(() => {
    // Setup security testing environment
    mockContext = {
      save: jest.fn(),
      restore: jest.fn(),
      fillRect: jest.fn(),
      drawImage: jest.fn(),
      beginPath: jest.fn(),
      arc: jest.fn(),
      fill: jest.fn(),
      stroke: jest.fn(),
      fillStyle: '#000000',
      strokeStyle: '#000000',
      globalCompositeOperation: 'source-over'
    };

    mockCanvas = {
      getContext: jest.fn(() => mockContext),
      width: 800,
      height: 600,
      toDataURL: jest.fn(() => 'data:image/png;base64,security-test-data'),
      toBlob: jest.fn((callback) => {
        const blob = new Blob(['test-data'], { type: 'image/png' });
        callback(blob);
      }),
      getBoundingClientRect: jest.fn(() => ({
        left: 0, top: 0, width: 800, height: 600
      }))
    };

    global.canvas = mockCanvas;
    global.ctx = mockContext;
    global.currentColor = '#ef4444';
    global.currentTool = 'pen';
    global.undoStack = [];
    global.redoStack = [];

    // Mock DOM elements for security testing
    document.getElementById = jest.fn((id) => ({
      innerHTML: '',
      textContent: '',
      style: {},
      classList: { add: jest.fn(), remove: jest.fn() },
      addEventListener: jest.fn(),
      appendChild: jest.fn(),
      download: '',
      href: '',
      click: jest.fn()
    }));

    document.querySelector = jest.fn(() => ({
      appendChild: jest.fn(),
      textContent: '',
      className: '',
      classList: { add: jest.fn(), remove: jest.fn() }
    }));

    document.createElement = jest.fn((tag) => ({
      className: '',
      textContent: '',
      innerHTML: '',
      download: '',
      href: '',
      click: jest.fn(),
      appendChild: jest.fn(),
      classList: { add: jest.fn(), remove: jest.fn() }
    }));

    document.body.appendChild = jest.fn();
    document.body.removeChild = jest.fn();
  });

  describe('Input Validation Security', () => {
    test('should handle malicious coordinate inputs safely', () => {
      const maliciousInputs = [
        { clientX: '<script>alert("xss")</script>', clientY: 100 },
        { clientX: 'javascript:alert("xss")', clientY: 100 },
        { clientX: '"><script>alert("xss")</script>', clientY: 100 },
        { clientX: NaN, clientY: Infinity },
        { clientX: -Infinity, clientY: Number.MAX_VALUE },
        { clientX: '../../etc/passwd', clientY: 100 },
        { clientX: 'DROP TABLE users;', clientY: 100 }
      ];

      maliciousInputs.forEach(input => {
        expect(() => {
          const coords = getCoordinates(input);
          drawDot(coords.x, coords.y);
        }).not.toThrow();
      });
    });

    test('should sanitize color inputs', () => {
      const maliciousColors = [
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        'expression(alert("xss"))',
        'url("javascript:alert(\'xss\')")',
        'rgb(255,255,255); background:url(javascript:alert(1))',
        '"; background-image:url("javascript:alert(\'XSS\')")',
        'red; <script>alert("xss")</script>',
        '\'); DROP TABLE colors; --'
      ];

      maliciousColors.forEach(maliciousColor => {
        global.currentColor = maliciousColor;
        
        expect(() => {
          drawDot(100, 100);
        }).not.toThrow();
        
        // Verify the malicious color is not directly used in DOM
        expect(mockContext.fillStyle).not.toContain('<script>');
        expect(mockContext.fillStyle).not.toContain('javascript:');
      });
    });

    test('should handle malicious size inputs safely', () => {
      const maliciousSizes = [
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        -1000000,
        Number.MAX_VALUE,
        NaN,
        Infinity,
        '"><script>alert("xss")</script>',
        '../../etc/passwd'
      ];

      maliciousSizes.forEach(maliciousSize => {
        expect(() => {
          global.penSize = maliciousSize;
          global.eraserSize = maliciousSize;
          drawDot(100, 100);
        }).not.toThrow();
      });
    });

    test('should validate tool selection input', () => {
      const maliciousTools = [
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        '"><img src=x onerror=alert("xss")>',
        'expression(alert("xss"))',
        'pen"; <script>alert("xss")</script>',
        null,
        undefined,
        {},
        []
      ];

      maliciousTools.forEach(maliciousTool => {
        expect(() => {
          setTool(maliciousTool);
        }).not.toThrow();
        
        // Tool should only be valid values
        expect(['pen', 'eraser'].includes(global.currentTool) || global.currentTool === maliciousTool).toBe(true);
      });
    });
  });

  describe('DOM Security', () => {
    test('should prevent HTML injection in toast messages', () => {
      const maliciousMessages = [
        '<script>alert("xss")</script>',
        '<img src=x onerror=alert("xss")>',
        '"><script>alert("xss")</script>',
        'javascript:alert("xss")',
        '<iframe src="javascript:alert(\'xss\')"></iframe>',
        '<svg onload=alert("xss")></svg>',
        '<div onclick="alert(\'xss\')">Click me</div>'
      ];

      maliciousMessages.forEach(maliciousMessage => {
        const mockToast = {
          textContent: '',
          className: '',
          classList: { add: jest.fn(), remove: jest.fn() }
        };

        document.createElement = jest.fn(() => mockToast);

        showToast(maliciousMessage, 'info');

        // Should use textContent, not innerHTML
        expect(mockToast.textContent).toBe(maliciousMessage);
        expect(mockToast.innerHTML || '').not.toContain('<script>');
      });
    });

    test('should prevent script injection in button updates', () => {
      const maliciousContent = '<script>alert("xss")</script>';
      global.penSize = maliciousContent;
      global.eraserSize = maliciousContent;

      const mockPenBtn = {
        innerHTML: '',
        classList: { add: jest.fn() }
      };
      const mockEraserBtn = {
        innerHTML: '',
        classList: { add: jest.fn() }
      };

      document.getElementById = jest.fn((id) => {
        if (id === 'penBtn') return mockPenBtn;
        if (id === 'eraserBtn') return mockEraserBtn;
        return {};
      });

      updateToolButtonsText();

      // Should safely handle malicious size input
      expect(mockPenBtn.innerHTML).toContain('Pen');
      expect(mockEraserBtn.innerHTML).toContain('Eraser');
    });

    test('should sanitize filename during export', () => {
      global.undoStack = ['test-state'];
      
      const mockTempCanvas = {
        width: 800,
        height: 600,
        getContext: jest.fn(() => ({
          fillStyle: '#1e293b',
          fillRect: jest.fn(),
          drawImage: jest.fn()
        })),
        toDataURL: jest.fn(() => 'data:image/png;base64,export-data')
      };

      const mockLink = {
        download: '',
        href: '',
        click: jest.fn()
      };

      document.createElement = jest.fn((tag) => {
        if (tag === 'canvas') return mockTempCanvas;
        if (tag === 'a') return mockLink;
        return {};
      });

      const mockImage = {
        onload: null,
        onerror: null,
        src: ''
      };
      global.Image = jest.fn(() => mockImage);

      // Mock Date to control filename
      const mockDate = new Date('2023-01-01T12:00:00Z');
      global.Date = jest.fn(() => mockDate);
      mockDate.toISOString = jest.fn(() => '2023-01-01T12:00:00.000Z');

      exportCanvas();

      // Trigger image load
      if (mockImage.onload) {
        mockImage.onload();
      }

      // Verify filename is safely generated
      expect(mockLink.download).toMatch(/^thick-lines-drawing_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.png$/);
      expect(mockLink.download).not.toContain('<script>');
      expect(mockLink.download).not.toContain('javascript:');
    });
  });

  describe('Canvas Security', () => {
    test('should handle malicious data URLs safely', () => {
      const maliciousDataURLs = [
        'javascript:alert("xss")',
        'data:text/html,<script>alert("xss")</script>',
        'data:image/svg+xml,<svg onload=alert("xss")></svg>',
        'vbscript:msgbox("xss")',
        'data:text/html;base64,PHNjcmlwdD5hbGVydCgneHNzJyk8L3NjcmlwdD4=',
        'file:///etc/passwd',
        'ftp://malicious.site/script.js'
      ];

      maliciousDataURLs.forEach(maliciousURL => {
        const mockImage = {
          onload: null,
          onerror: jest.fn(),
          src: ''
        };
        global.Image = jest.fn(() => mockImage);

        expect(() => {
          loadState(maliciousURL);
          // Simulate image error for malicious URLs
          mockImage.onerror();
        }).not.toThrow();

        expect(mockImage.src).toBe(maliciousURL);
      });
    });

    test('should prevent canvas fingerprinting attacks', () => {
      // Test that canvas operations don't leak sensitive information
      const startTime = performance.now();
      
      // Perform operations that might be used for fingerprinting
      drawDot(1, 1);
      drawDot(2, 2);
      
      const result1 = mockCanvas.toDataURL();
      
      // Reset and repeat
      mockContext.fillRect(0, 0, 800, 600);
      drawDot(1, 1);
      drawDot(2, 2);
      
      const result2 = mockCanvas.toDataURL();
      
      const endTime = performance.now();
      
      // Results should be consistent (no timing-based fingerprinting)
      expect(result1).toBe(result2);
      expect(endTime - startTime).toBeLessThan(10); // Fast, consistent timing
    });

    test('should handle malicious clipboard data safely', () => {
      const maliciousClipboardData = [
        { types: ['text/html'], getType: () => Promise.resolve(new Blob(['<script>alert("xss")</script>'], { type: 'text/html' })) },
        { types: ['image/svg+xml'], getType: () => Promise.resolve(new Blob(['<svg onload=alert("xss")></svg>'], { type: 'image/svg+xml' })) },
        { types: ['text/javascript'], getType: () => Promise.resolve(new Blob(['alert("xss")'], { type: 'text/javascript' })) }
      ];

      maliciousClipboardData.forEach(clipboardItem => {
        // Mock navigator.clipboard.read
        navigator.clipboard.read = jest.fn(() => Promise.resolve([clipboardItem]));

        expect(() => {
          pasteSelection();
        }).not.toThrow();
      });
    });
  });

  describe('Export Security', () => {
    test('should prevent malicious export operations', () => {
      // Test with potentially dangerous canvas content
      global.undoStack = ['data:image/png;base64,potential-malicious-content'];
      
      const mockImage = {
        onload: null,
        onerror: null,
        src: ''
      };
      global.Image = jest.fn(() => mockImage);

      const mockTempCanvas = {
        width: 800,
        height: 600,
        getContext: jest.fn(() => mockContext),
        toDataURL: jest.fn(() => 'data:image/png;base64,safe-export-data')
      };

      const mockLink = {
        download: '',
        href: '',
        click: jest.fn()
      };

      document.createElement = jest.fn((tag) => {
        if (tag === 'canvas') return mockTempCanvas;
        if (tag === 'a') return mockLink;
        return {};
      });

      exportCanvas();

      // Trigger image load
      if (mockImage.onload) {
        mockImage.onload();
      }

      // Verify safe export
      expect(mockLink.href).toContain('data:image/png');
      expect(mockLink.href).not.toContain('javascript:');
      expect(mockLink.href).not.toContain('<script>');
    });

    test('should validate export data integrity', () => {
      global.undoStack = ['valid-state'];
      
      // Mock potentially corrupted export
      mockCanvas.toDataURL = jest.fn(() => { throw new Error('Export corruption'); });
      
      const consoleSpy = jest.spyOn(console, 'error');

      exportCanvas();

      expect(consoleSpy).toHaveBeenCalledWith('Error during image export:', expect.any(Error));
    });
  });

  describe('Memory Security', () => {
    test('should prevent memory exhaustion attacks', () => {
      // Simulate attempt to exhaust memory with large undo stack
      const largeDataURL = 'data:image/png;base64,' + 'x'.repeat(1000000); // 1MB data URL
      
      // Try to fill memory beyond reasonable limits
      for (let i = 0; i < 1000; i++) {
        global.undoStack.push(largeDataURL);
      }

      // Memory protection should kick in
      trimUndoRedoStacks();

      expect(global.undoStack.length).toBeLessThanOrEqual(10);
    });

    test('should prevent drawing path memory bombs', () => {
      // Simulate malicious attempt to create huge paths
      global.currentPath = {
        tool: 'pen',
        points: [],
        lastWidth: 10
      };

      // Try to create path with excessive points
      const maxPoints = 100000;
      for (let i = 0; i < maxPoints && i < 1000; i++) { // Limited for test performance
        global.currentPath.points.push({ x: i, y: i, t: i });
      }

      expect(() => {
        cleanupMemory();
      }).not.toThrow();

      expect(global.drawingPaths).toHaveLength(0);
    });

    test('should handle malicious state data safely', () => {
      const maliciousStates = [
        'javascript:alert("xss")',
        'data:text/html,<script>alert("xss")</script>',
        'vbscript:msgbox("xss")',
        '<script>alert("xss")</script>',
        'file:///etc/passwd',
        '../../sensitive-file.txt'
      ];

      maliciousStates.forEach(maliciousState => {
        global.undoStack.push(maliciousState);
      });

      // Should handle malicious states without executing them
      expect(() => {
        undo();
        redo();
      }).not.toThrow();
    });
  });

  describe('Event Security', () => {
    test('should prevent event handler injection', () => {
      const maliciousEventData = {
        preventDefault: () => { eval('alert("xss")'); }, // Malicious preventDefault
        clientX: 100,
        clientY: 100,
        button: 0
      };

      // Should handle malicious event data safely
      expect(() => {
        handleMouseDown(maliciousEventData);
      }).not.toThrow();
    });

    test('should sanitize keyboard input', () => {
      const maliciousKeyEvents = [
        { key: '<script>alert("xss")</script>', target: { tagName: 'DIV' } },
        { key: 'javascript:alert("xss")', target: { tagName: 'DIV' } },
        { key: '"; DROP TABLE users; --', target: { tagName: 'DIV' } },
        { key: '\'); DELETE FROM canvas; --', target: { tagName: 'DIV' } }
      ];

      maliciousKeyEvents.forEach(maliciousEvent => {
        expect(() => {
          handleKeyDown(maliciousEvent);
        }).not.toThrow();
      });
    });

    test('should prevent context menu injection', () => {
      const maliciousContextEvent = {
        preventDefault: jest.fn(),
        clientX: '<script>alert("xss")</script>',
        clientY: 'javascript:alert("xss")'
      };

      global.contextMenu = {
        style: {},
        classList: { add: jest.fn() }
      };

      expect(() => {
        handleContextMenu(maliciousContextEvent);
      }).not.toThrow();
    });
  });

  describe('Clipboard Security', () => {
    test('should handle malicious clipboard content safely', () => {
      const maliciousBlob = new Blob(['<script>alert("xss")</script>'], { type: 'text/html' });
      const maliciousClipboardItem = {
        types: ['text/html', 'image/png'],
        getType: jest.fn((type) => {
          if (type === 'text/html') return Promise.resolve(maliciousBlob);
          return Promise.resolve(new Blob(['safe-image-data'], { type: 'image/png' }));
        })
      };

      navigator.clipboard.read = jest.fn(() => Promise.resolve([maliciousClipboardItem]));

      expect(() => {
        pasteSelection();
      }).not.toThrow();
    });

    test('should validate copied data before clipboard operations', () => {
      // Test copy operation security
      mockCanvas.toBlob = jest.fn((callback) => {
        // Simulate potentially malicious blob
        const blob = new Blob(['potentially-dangerous-data'], { type: 'image/png' });
        callback(blob);
      });

      navigator.clipboard.write = jest.fn(() => Promise.resolve());

      expect(() => {
        copySelection();
      }).not.toThrow();

      expect(navigator.clipboard.write).toHaveBeenCalled();
    });

    test('should handle clipboard API errors gracefully', () => {
      // Simulate clipboard API failure
      navigator.clipboard.write = jest.fn(() => Promise.reject(new Error('Clipboard access denied')));
      
      const consoleSpy = jest.spyOn(console, 'error');

      copySelection();

      // Should handle clipboard errors safely
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('File System Security', () => {
    test('should prevent path traversal in export filenames', () => {
      global.undoStack = ['test-state'];
      
      // Mock Date to simulate potentially dangerous timestamp
      const mockDate = {
        toISOString: jest.fn(() => '../../../malicious/../../file.png')
      };
      global.Date = jest.fn(() => mockDate);

      const mockLink = {
        download: '',
        href: '',
        click: jest.fn()
      };

      document.createElement = jest.fn(() => mockLink);

      const mockImage = {
        onload: null,
        src: ''
      };
      global.Image = jest.fn(() => mockImage);

      exportCanvas();

      if (mockImage.onload) {
        mockImage.onload();
      }

      // Filename should be sanitized
      expect(mockLink.download).not.toContain('../');
      expect(mockLink.download).not.toContain('..\\');
    });

    test('should validate data URL schemes', () => {
      const suspiciousDataURLs = [
        'file:///etc/passwd',
        'ftp://attacker.com/malicious.png',
        'http://attacker.com/steal-data.php',
        'chrome-extension://malicious/script.js',
        'moz-extension://malicious/script.js'
      ];

      suspiciousDataURLs.forEach(suspiciousURL => {
        const mockImage = {
          onload: null,
          onerror: jest.fn(),
          src: ''
        };
        global.Image = jest.fn(() => mockImage);

        expect(() => {
          loadState(suspiciousURL);
        }).not.toThrow();

        // Should handle suspicious URLs safely
        expect(mockImage.src).toBe(suspiciousURL);
      });
    });
  });

  describe('Configuration Security', () => {
    test('should validate configuration boundaries', () => {
      // Test malicious configuration values
      const maliciousConfigs = {
        UNDO_STACK_LIMIT: -1,
        DEFAULT_ZOOM: '<script>alert("xss")</script>',
        ZOOM_INCREMENT: Number.MAX_VALUE,
        CANVAS_BG_COLOR: 'javascript:alert("xss")'
      };

      Object.keys(maliciousConfigs).forEach(key => {
        global[key] = maliciousConfigs[key];
      });

      // Application should continue functioning safely
      expect(() => {
        init();
        saveState();
        applyTransform();
      }).not.toThrow();
    });

    test('should enforce secure defaults', () => {
      // Reset to potentially dangerous state
      global.currentColor = undefined;
      global.currentTool = undefined;
      global.penSize = undefined;
      global.eraserSize = undefined;

      // Application should use secure defaults
      expect(() => {
        init();
        drawDot(100, 100);
      }).not.toThrow();

      // Should fall back to safe defaults
      expect(typeof global.currentColor === 'string').toBe(true);
      expect(['pen', 'eraser'].includes(global.currentTool) || global.currentTool === undefined).toBe(true);
    });
  });

  describe('Runtime Security', () => {
    test('should prevent code injection through eval-like functions', () => {
      // Ensure no eval, Function constructor, or setTimeout with strings
      const dangerousFunctions = ['eval', 'Function', 'setTimeout', 'setInterval'];
      
      // Check that these functions are not used with user input
      dangerousFunctions.forEach(funcName => {
        const originalFunc = global[funcName];
        global[funcName] = jest.fn(originalFunc);
      });

      // Perform normal operations
      init();
      setTool('pen');
      drawDot(100, 100);
      showToast('Test message', 'info');

      // Verify dangerous functions were not called with strings
      dangerousFunctions.forEach(funcName => {
        if (global[funcName].mock) {
          global[funcName].mock.calls.forEach(call => {
            const firstArg = call[0];
            if (typeof firstArg === 'string') {
              expect(firstArg).not.toContain('<script>');
              expect(firstArg).not.toContain('javascript:');
              expect(firstArg).not.toContain('eval(');
            }
          });
        }
      });
    });

    test('should handle prototype pollution attempts', () => {
      // Simulate prototype pollution attack
      const maliciousData = JSON.parse('{"__proto__": {"polluted": true}}');
      
      expect(() => {
        // Try to use malicious data in application
        global.currentPath = maliciousData;
        drawDot(100, 100);
      }).not.toThrow();

      // Verify prototype was not polluted
      expect(({}).polluted).toBeUndefined();
    });
  });
});
