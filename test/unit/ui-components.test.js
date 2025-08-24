/**
 * Unit Tests for UI Components
 * Tests color selection, tool switching, help panel, context menu, and notifications
 */

require('../../app.js');

describe('UI Components (unit)', () => {
  let mockElements;

  beforeEach(() => {
    // Reset global state
    global.currentColor = '#ef4444';
    global.currentTool = 'pen';
    global.penSize = 10;
    global.eraserSize = 10;

    // Create comprehensive mock elements
    mockElements = {
      colorButtons: [
        { 
          dataset: { color: '#ef4444' }, 
          classList: { add: jest.fn(), remove: jest.fn() },
          addEventListener: jest.fn()
        },
        { 
          dataset: { color: '#10b981' }, 
          classList: { add: jest.fn(), remove: jest.fn() },
          addEventListener: jest.fn()
        },
        { 
          dataset: { color: '#3b82f6' }, 
          classList: { add: jest.fn(), remove: jest.fn() },
          addEventListener: jest.fn()
        },
        { 
          dataset: { color: '#f59e0b' }, 
          classList: { add: jest.fn(), remove: jest.fn() },
          addEventListener: jest.fn()
        }
      ],
      penBtn: {
        addEventListener: jest.fn(),
        classList: { add: jest.fn(), remove: jest.fn() },
        innerHTML: '',
        click: jest.fn()
      },
      eraserBtn: {
        addEventListener: jest.fn(),
        classList: { add: jest.fn(), remove: jest.fn() },
        innerHTML: '',
        click: jest.fn()
      },
      penSizeDropdown: {
        addEventListener: jest.fn(),
        classList: { remove: jest.fn() }
      },
      eraserSizeDropdown: {
        addEventListener: jest.fn(),
        classList: { remove: jest.fn() }
      },
      helpPanel: {
        classList: { toggle: jest.fn(), contains: jest.fn(), add: jest.fn(), remove: jest.fn() },
        setAttribute: jest.fn(),
        addEventListener: jest.fn()
      },
      contextMenu: {
        style: {},
        classList: { add: jest.fn(), remove: jest.fn() }
      }
    };

    // Mock DOM queries
    document.querySelectorAll = jest.fn((selector) => {
      if (selector === '.color-btn') return mockElements.colorButtons;
      if (selector === '.tool-btn') return [mockElements.penBtn, mockElements.eraserBtn];
      if (selector.includes('pen-size-option')) return [];
      if (selector.includes('eraser-size-option')) return [];
      return [];
    });

    document.querySelector = jest.fn((selector) => {
      if (selector === '.color-btn.red') return mockElements.colorButtons[0];
      if (selector === '.pen-size-dropdown') return mockElements.penSizeDropdown;
      if (selector === '.eraser-size-dropdown') return mockElements.eraserSizeDropdown;
      if (selector === '.toast-container') return { appendChild: jest.fn() };
      if (selector === '.toast') return null;
      return null;
    });

    document.getElementById = jest.fn((id) => {
      if (id === 'penBtn') return mockElements.penBtn;
      if (id === 'eraserBtn') return mockElements.eraserBtn;
      if (id === 'helpPanel') return mockElements.helpPanel;
      if (id === 'helpBtn') return { addEventListener: jest.fn() };
      if (id === 'closeHelpBtn') return { addEventListener: jest.fn() };
      if (id === 'contextMenu') return mockElements.contextMenu;
      return {
        addEventListener: jest.fn(),
        classList: { add: jest.fn(), remove: jest.fn() },
        style: {}
      };
    });

    document.createElement = jest.fn((tag) => ({
      className: '',
      textContent: '',
      classList: { add: jest.fn(), remove: jest.fn() },
      appendChild: jest.fn(),
      addEventListener: jest.fn()
    }));

    document.body.appendChild = jest.fn();
  });

  describe('Color Selection', () => {
    test('should setup color buttons correctly', () => {
      setupColorButtons();

      // Verify all color buttons have event listeners
      mockElements.colorButtons.forEach(btn => {
        expect(btn.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
      });

      // Verify red button is set as active initially
      expect(mockElements.colorButtons[0].classList.add).toHaveBeenCalledWith('active');
    });

    test('should handle color button click', () => {
      setupColorButtons();
      
      // Get the click handler for the first color button
      const clickHandler = mockElements.colorButtons[0].addEventListener.mock.calls[0][1];
      
      // Simulate click
      clickHandler();

      expect(global.currentColor).toBe('#ef4444');
      expect(mockElements.colorButtons[0].classList.add).toHaveBeenCalledWith('active');
    });

    test('should switch to pen when color selected while in eraser mode', () => {
      global.currentTool = 'eraser';
      setupColorButtons();
      
      const clickHandler = mockElements.colorButtons[1].addEventListener.mock.calls[0][1];
      clickHandler();

      expect(global.currentColor).toBe('#10b981');
      // Should switch to pen tool
      expect(mockElements.penBtn.classList.add).toHaveBeenCalledWith('active');
    });

    test('should handle missing color data gracefully', () => {
      mockElements.colorButtons[0].dataset = {}; // Missing data-color
      const consoleSpy = jest.spyOn(console, 'warn');

      setupColorButtons();

      expect(consoleSpy).toHaveBeenCalledWith('Color button missing data-color attribute:', expect.any(Object));
    });

    test('should fallback when no red button found', () => {
      document.querySelector = jest.fn(() => null); // No red button
      const consoleSpy = jest.spyOn(console, 'warn');

      setupColorButtons();

      expect(consoleSpy).toHaveBeenCalledWith('Red color button not found, could not set initial active color');
    });
  });

  describe('Tool Selection', () => {
    test('should setup tool buttons correctly', () => {
      setupToolButtons();

      expect(mockElements.penBtn.addEventListener).toHaveBeenCalled();
      expect(mockElements.eraserBtn.addEventListener).toHaveBeenCalled();
      expect(mockElements.penSizeDropdown.addEventListener).toHaveBeenCalled();
      expect(mockElements.eraserSizeDropdown.addEventListener).toHaveBeenCalled();
    });

    test('should set pen tool correctly', () => {
      setTool('pen');

      expect(global.currentTool).toBe('pen');
      expect(mockElements.penBtn.classList.add).toHaveBeenCalledWith('active');
      expect(mockElements.penBtn.innerHTML).toContain('Pen');
      expect(mockElements.penBtn.innerHTML).toContain('10px');
    });

    test('should set eraser tool correctly', () => {
      setTool('eraser');

      expect(global.currentTool).toBe('eraser');
      expect(mockElements.eraserBtn.classList.add).toHaveBeenCalledWith('active');
      expect(mockElements.eraserBtn.innerHTML).toContain('Eraser');
      expect(mockElements.eraserBtn.innerHTML).toContain('10px');
    });

    test('should handle pen size selection', () => {
      const mockSizeEvent = {
        target: {
          classList: { contains: jest.fn(() => true) },
          dataset: { size: '20' }
        }
      };

      setupToolButtons();
      const clickHandler = mockElements.penSizeDropdown.addEventListener.mock.calls[0][1];
      clickHandler(mockSizeEvent);

      expect(global.penSize).toBe(20);
      expect(mockElements.penBtn.click).toHaveBeenCalled();
    });

    test('should handle eraser size selection', () => {
      const mockSizeEvent = {
        target: {
          classList: { contains: jest.fn(() => true) },
          dataset: { size: '30' }
        }
      };

      setupToolButtons();
      const clickHandler = mockElements.eraserSizeDropdown.addEventListener.mock.calls[0][1];
      clickHandler(mockSizeEvent);

      expect(global.eraserSize).toBe(30);
      expect(mockElements.eraserBtn.click).toHaveBeenCalled();
    });

    test('should handle missing tool buttons gracefully', () => {
      document.getElementById = jest.fn(() => null);
      const consoleSpy = jest.spyOn(console, 'error');

      setupToolButtons();

      expect(consoleSpy).toHaveBeenCalledWith('Pen button not found with ID "penBtn"');
    });
  });

  describe('Help Panel', () => {
    test('should setup help panel correctly', () => {
      setupHelpPanel();

      expect(mockElements.helpPanel.addEventListener).toHaveBeenCalled();
    });

    test('should toggle help panel visibility', () => {
      toggleHelpPanel();

      expect(mockElements.helpPanel.classList.toggle).toHaveBeenCalledWith('show');
      expect(mockElements.helpPanel.setAttribute).toHaveBeenCalled();
    });

    test('should close help panel when visible', () => {
      mockElements.helpPanel.classList.contains = jest.fn(() => true);

      closeHelpPanel();

      expect(mockElements.helpPanel.classList.toggle).toHaveBeenCalled();
    });

    test('should handle modal backdrop creation', () => {
      document.querySelector = jest.fn(() => null); // No existing backdrop
      mockElements.helpPanel.classList.contains = jest.fn(() => true);

      toggleHelpPanel();

      expect(document.createElement).toHaveBeenCalledWith('div');
      expect(document.body.appendChild).toHaveBeenCalled();
    });
  });

  describe('Context Menu', () => {
    beforeEach(() => {
      global.contextMenu = mockElements.contextMenu;
    });

    test('should show context menu at cursor position', () => {
      const mockEvent = { clientX: 100, clientY: 150 };

      showContextMenu(mockEvent);

      expect(mockElements.contextMenu.style.left).toBe('100px');
      expect(mockElements.contextMenu.style.top).toBe('150px');
      expect(mockElements.contextMenu.classList.add).toHaveBeenCalledWith('visible');
    });

    test('should hide context menu', () => {
      hideContextMenu();

      expect(mockElements.contextMenu.classList.remove).toHaveBeenCalledWith('visible');
    });

    test('should handle context menu when no menu element', () => {
      global.contextMenu = null;

      expect(() => showContextMenu({ clientX: 100, clientY: 100 })).not.toThrow();
      expect(() => hideContextMenu()).not.toThrow();
    });

    test('should setup context menu event handlers', () => {
      setupContextMenu();

      // Verify context menu was cached
      expect(global.contextMenu).toBe(mockElements.contextMenu);
    });
  });

  describe('Toast Notifications', () => {
    test('should show toast notification', () => {
      const mockToastContainer = {
        appendChild: jest.fn()
      };
      const mockToast = {
        textContent: '',
        className: '',
        classList: { add: jest.fn(), remove: jest.fn() }
      };

      document.querySelector = jest.fn((selector) => {
        if (selector === '.toast-container') return mockToastContainer;
        if (selector === '.toast') return null;
        return null;
      });

      document.createElement = jest.fn(() => mockToast);

      showToast('Test message', 'info');

      expect(mockToast.textContent).toBe('Test message');
      expect(mockToast.className).toBe('toast info');
      expect(mockToast.classList.add).toHaveBeenCalledWith('show');
    });

    test('should reuse existing toast element', () => {
      const mockToast = {
        textContent: '',
        className: '',
        classList: { add: jest.fn(), remove: jest.fn() }
      };

      document.querySelector = jest.fn((selector) => {
        if (selector === '.toast-container') return { appendChild: jest.fn() };
        if (selector === '.toast') return mockToast;
        return null;
      });

      showToast('Reused toast', 'success');

      expect(mockToast.textContent).toBe('Reused toast');
      expect(mockToast.className).toBe('toast success');
    });

    test('should handle missing toast container gracefully', () => {
      document.querySelector = jest.fn(() => null);

      expect(() => showToast('Test', 'info')).not.toThrow();
    });
  });

  describe('Size Visualization', () => {
    test('should show size visualizer correctly', () => {
      global.sizeVisualizer = {
        style: {},
        classList: { add: jest.fn() }
      };
      global.currentTool = 'pen';
      global.currentColor = '#ff0000';

      showSizeVisualizer(100, 150, 20);

      expect(global.sizeVisualizer.style.width).toBe('20px');
      expect(global.sizeVisualizer.style.height).toBe('20px');
      expect(global.sizeVisualizer.style.left).toBe('100px');
      expect(global.sizeVisualizer.style.top).toBe('150px');
      expect(global.sizeVisualizer.classList.add).toHaveBeenCalledWith('visible');
    });

    test('should set pen color for visualizer', () => {
      global.sizeVisualizer = { style: {}, classList: { add: jest.fn() } };
      global.currentTool = 'pen';
      global.currentColor = '#ff0000';

      showSizeVisualizer(100, 150, 20);

      expect(global.sizeVisualizer.style.backgroundColor).toBe('#ff000040');
      expect(global.sizeVisualizer.style.borderColor).toBe('#ff0000');
    });

    test('should set eraser color for visualizer', () => {
      global.sizeVisualizer = { style: {}, classList: { add: jest.fn() } };
      global.currentTool = 'eraser';

      showSizeVisualizer(100, 150, 20);

      expect(global.sizeVisualizer.style.backgroundColor).toBe('rgba(255, 255, 255, 0.2)');
      expect(global.sizeVisualizer.style.borderColor).toBe('rgba(255, 255, 255, 0.7)');
    });

    test('should hide size visualizer', () => {
      global.sizeVisualizer = {
        classList: { remove: jest.fn() }
      };

      hideSizeVisualizer();

      expect(global.sizeVisualizer.classList.remove).toHaveBeenCalledWith('visible');
    });

    test('should handle null visualizer gracefully', () => {
      global.sizeVisualizer = null;

      expect(() => showSizeVisualizer(100, 100, 10)).not.toThrow();
      expect(() => hideSizeVisualizer()).not.toThrow();
    });
  });

  describe('Document Event Handling', () => {
    test('should handle escape key correctly', () => {
      mockElements.helpPanel.classList.contains = jest.fn(() => true);
      global.contextMenu = mockElements.contextMenu;

      handleEscapeKey();

      expect(mockElements.helpPanel.classList.toggle).toHaveBeenCalled();
      expect(mockElements.contextMenu.classList.remove).toHaveBeenCalledWith('visible');
    });

    test('should handle document click outside dropdowns', () => {
      const mockEvent = {
        target: {
          closest: jest.fn(() => null),
          matches: jest.fn(() => false)
        }
      };

      handleDocumentClick(mockEvent);

      // Should close dropdowns when clicking outside
      expect(mockEvent.target.closest).toHaveBeenCalled();
    });

    test('should not close dropdowns when clicking inside', () => {
      const mockEvent = {
        target: {
          closest: jest.fn((selector) => selector === '.tool-btn' ? {} : null),
          matches: jest.fn(() => false)
        }
      };

      handleDocumentClick(mockEvent);

      // Should not close dropdowns when clicking tool button
      expect(mockEvent.target.closest).toHaveBeenCalled();
    });
  });

  describe('UI Updates', () => {
    test('should update tool button text correctly', () => {
      global.penSize = 15;
      global.eraserSize = 25;

      updateToolButtonsText();

      expect(mockElements.penBtn.innerHTML).toContain('15px');
      expect(mockElements.eraserBtn.innerHTML).toContain('25px');
    });

    test('should set active pen size option', () => {
      const mockOptions = [
        { dataset: { size: '10' }, classList: { toggle: jest.fn() } },
        { dataset: { size: '20' }, classList: { toggle: jest.fn() } }
      ];
      document.querySelectorAll = jest.fn(() => mockOptions);

      setActivePenSizeOption(20);

      expect(mockOptions[0].classList.toggle).toHaveBeenCalledWith('active', false);
      expect(mockOptions[1].classList.toggle).toHaveBeenCalledWith('active', true);
    });

    test('should set active eraser size option', () => {
      const mockOptions = [
        { dataset: { size: '15' }, classList: { toggle: jest.fn() } },
        { dataset: { size: '30' }, classList: { toggle: jest.fn() } }
      ];
      document.querySelectorAll = jest.fn(() => mockOptions);

      setActiveEraserSizeOption(30);

      expect(mockOptions[0].classList.toggle).toHaveBeenCalledWith('active', false);
      expect(mockOptions[1].classList.toggle).toHaveBeenCalledWith('active', true);
    });
  });

  describe('Error Handling', () => {
    test('should handle setupColorButtons with no buttons', () => {
      document.querySelectorAll = jest.fn(() => []);
      const consoleSpy = jest.spyOn(console, 'error');

      setupColorButtons();

      expect(consoleSpy).toHaveBeenCalledWith('No color buttons found with class .color-btn');
    });

    test('should handle setupToolButtons with missing elements', () => {
      document.getElementById = jest.fn(() => null);
      document.querySelector = jest.fn(() => null);
      const consoleSpy = jest.spyOn(console, 'error');

      setupToolButtons();

      expect(consoleSpy).toHaveBeenCalledWith('Pen button not found with ID "penBtn"');
    });

    test('should handle DOM manipulation errors gracefully', () => {
      document.createElement = jest.fn(() => { throw new Error('DOM error'); });

      expect(() => createTooltip()).toThrow();
    });
  });

  describe('Accessibility', () => {
    test('should set proper ARIA attributes on help panel', () => {
      mockElements.helpPanel.classList.contains = jest.fn(() => true);

      toggleHelpPanel();

      expect(mockElements.helpPanel.setAttribute).toHaveBeenCalledWith('aria-hidden', false);
    });

    test('should handle keyboard navigation', () => {
      const mockKeyEvent = {
        key: 'Escape',
        preventDefault: jest.fn()
      };

      // Test help panel keyboard handling
      setupHelpPanel();
      const keyHandler = mockElements.helpPanel.addEventListener.mock.calls.find(
        call => call[0] === 'keydown'
      )[1];

      keyHandler(mockKeyEvent);

      // Should close help panel on escape
      expect(mockElements.helpPanel.classList.contains).toHaveBeenCalled();
    });
  });

  describe('Tool and Color Switching', () => {
    test('should switch to pen tool on click', () => {
      setupToolButtons();
      const clickHandler = mockElements.penBtn.addEventListener.mock.calls[0][1];
      clickHandler({ stopPropagation: jest.fn() });
      expect(global.currentTool).toBe('pen');
    });

    test('should switch to eraser tool on click', () => {
      setupToolButtons();
      const clickHandler = mockElements.eraserBtn.addEventListener.mock.calls[0][1];
      clickHandler({ stopPropagation: jest.fn() });
      expect(global.currentTool).toBe('eraser');
    });

    test('should switch color on click', () => {
      setupColorButtons();
      const greenButton = mockElements.colorButtons[1];
      const clickHandler = greenButton.addEventListener.mock.calls[0][1];
      clickHandler();
      expect(global.currentColor).toBe('#10b981');
    });
  });
});
