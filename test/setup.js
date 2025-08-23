// Jest test setup file
require('@testing-library/jest-dom');

// Mock Canvas API since jsdom doesn't have full Canvas support
const mockCanvasContext = {
  fillRect: jest.fn(),
  clearRect: jest.fn(),
  getImageData: jest.fn(() => ({ data: new Array(4).fill(255) })),
  putImageData: jest.fn(),
  drawImage: jest.fn(),
  save: jest.fn(),
  restore: jest.fn(),
  setTransform: jest.fn(),
  scale: jest.fn(),
  rotate: jest.fn(),
  translate: jest.fn(),
  strokeRect: jest.fn(),
  strokeText: jest.fn(),
  fillText: jest.fn(),
  measureText: jest.fn(() => ({ width: 100 })),
  arc: jest.fn(),
  beginPath: jest.fn(),
  moveTo: jest.fn(),
  lineTo: jest.fn(),
  quadraticCurveTo: jest.fn(),
  bezierCurveTo: jest.fn(),
  closePath: jest.fn(),
  stroke: jest.fn(),
  fill: jest.fn(),
  clip: jest.fn(),
  setLineDash: jest.fn(),
  createLinearGradient: jest.fn(() => ({
    addColorStop: jest.fn()
  })),
  createRadialGradient: jest.fn(() => ({
    addColorStop: jest.fn()
  })),
  toDataURL: jest.fn(() => 'data:image/png;base64,mock-data'),
  globalCompositeOperation: 'source-over',
  strokeStyle: '#000000',
  fillStyle: '#000000',
  lineWidth: 1,
  lineCap: 'butt',
  lineJoin: 'miter',
  font: '10px sans-serif',
  textAlign: 'start',
  textBaseline: 'alphabetic',
  globalAlpha: 1.0
};

// Mock Canvas element
const mockCanvas = {
  getContext: jest.fn(() => mockCanvasContext),
  toDataURL: jest.fn(() => 'data:image/png;base64,mock-data'),
  toBlob: jest.fn((callback) => {
    const blob = new Blob(['mock-blob'], { type: 'image/png' });
    callback(blob);
  }),
  width: 800,
  height: 600,
  style: {
    width: '800px',
    height: '600px',
    cursor: 'crosshair'
  },
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  getBoundingClientRect: jest.fn(() => ({
    left: 0,
    top: 0,
    right: 800,
    bottom: 600,
    width: 800,
    height: 600
  })),
  // Add setter properties for width/height to avoid NaN
  set width(value) { this._width = value; },
  get width() { return this._width || 800; },
  set height(value) { this._height = value; },
  get height() { return this._height || 600; }
};

// Initialize canvas dimensions
mockCanvas.width = 800;
mockCanvas.height = 600;

// Mock HTML elements
Object.defineProperty(document, 'getElementById', {
  value: jest.fn((id) => {
    if (id === 'drawing-canvas') return mockCanvas;
    return {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      click: jest.fn(),
      style: {},
      classList: {
        add: jest.fn(),
        remove: jest.fn(),
        toggle: jest.fn(),
        contains: jest.fn()
      },
      dataset: {},
      innerHTML: '',
      textContent: '',
      disabled: false,
      setAttribute: jest.fn(),
      getAttribute: jest.fn(),
      clientWidth: 800,
      clientHeight: 600
    };
  })
});

// Mock query selectors
Object.defineProperty(document, 'querySelector', {
  value: jest.fn(() => ({
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    click: jest.fn(),
    style: {},
    classList: {
      add: jest.fn(),
      remove: jest.fn(),
      toggle: jest.fn(),
      contains: jest.fn()
    },
    dataset: {},
    innerHTML: '',
    textContent: '',
    clientWidth: 800,
    clientHeight: 600,
    setAttribute: jest.fn(),
    getAttribute: jest.fn()
  }))
});

Object.defineProperty(document, 'querySelectorAll', {
  value: jest.fn((selector) => {
    // Mock specific selectors that tests expect
    if (selector === '.color-btn') {
      return [
        {
          addEventListener: jest.fn(),
          click: jest.fn(),
          dataset: { color: '#ef4444' },
          classList: { add: jest.fn(), remove: jest.fn(), toggle: jest.fn(), contains: jest.fn() },
          style: {}
        },
        {
          addEventListener: jest.fn(), 
          click: jest.fn(),
          dataset: { color: '#10b981' },
          classList: { add: jest.fn(), remove: jest.fn(), toggle: jest.fn(), contains: jest.fn() },
          style: {}
        },
        {
          addEventListener: jest.fn(),
          click: jest.fn(), 
          dataset: { color: '#3b82f6' },
          classList: { add: jest.fn(), remove: jest.fn(), toggle: jest.fn(), contains: jest.fn() },
          style: {}
        },
        {
          addEventListener: jest.fn(),
          click: jest.fn(),
          dataset: { color: '#f59e0b' },
          classList: { add: jest.fn(), remove: jest.fn(), toggle: jest.fn(), contains: jest.fn() },
          style: {}
        }
      ];
    }
    if (selector.includes('pen-size')) {
      return [
        {
          dataset: { size: '10' },
          classList: { toggle: jest.fn() }
        },
        {
          dataset: { size: '20' },
          classList: { toggle: jest.fn() }
        }
      ];
    }
    if (selector.includes('eraser-size')) {
      return [
        {
          dataset: { size: '10' },
          classList: { toggle: jest.fn() }
        },
        {
          dataset: { size: '30' },
          classList: { toggle: jest.fn() }
        }
      ];
    }
    return [];
  })
});

// Mock window properties
Object.defineProperty(window, 'devicePixelRatio', {
  value: 1,
  writable: true
});

// Mock window.confirm
Object.defineProperty(window, 'confirm', {
  value: jest.fn(() => true),
  writable: true
});

// Mock window.alert
Object.defineProperty(window, 'alert', {
  value: jest.fn(),
  writable: true
});

Object.defineProperty(window, 'requestAnimationFrame', {
  value: jest.fn(callback => setTimeout(callback, 16)),
  writable: true
});

Object.defineProperty(window, 'performance', {
  value: {
    now: jest.fn(() => Date.now())
  },
  writable: true
});

// Mock clipboard API
Object.defineProperty(navigator, 'clipboard', {
  value: {
    write: jest.fn(() => Promise.resolve()),
    read: jest.fn(() => Promise.resolve([])),
    writeText: jest.fn(() => Promise.resolve()),
    readText: jest.fn(() => Promise.resolve(''))
  },
  writable: true
});

// Mock ClipboardItem
global.ClipboardItem = jest.fn().mockImplementation((data) => ({ data }));

// Mock Image constructor
global.Image = jest.fn().mockImplementation(() => ({
  onload: null,
  onerror: null,
  src: '',
  width: 100,
  height: 100
}));

// Mock Blob constructor
global.Blob = jest.fn().mockImplementation((data, options) => ({
  data,
  type: options?.type || 'application/octet-stream',
  size: data ? data.length : 0
}));

// Mock URL object
global.URL = {
  createObjectURL: jest.fn(() => 'blob:mock-url'),
  revokeObjectURL: jest.fn()
};

// Mock console methods to reduce noise
global.console = {
  ...global.console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Mock additional document methods that app.js expects
document.addEventListener = jest.fn();
document.removeEventListener = jest.fn();

// Mock body properties
Object.defineProperty(document.body, 'appendChild', {
  value: jest.fn(),
  writable: true
});

Object.defineProperty(document.body, 'removeChild', {
  value: jest.fn(),
  writable: true
});

Object.defineProperty(document.body, 'classList', {
  value: {
    add: jest.fn(),
    remove: jest.fn(),
    toggle: jest.fn(),
    contains: jest.fn(() => false)
  },
  writable: true
});

Object.defineProperty(document.body, 'style', {
  value: {},
  writable: true
});

// Mock createElement
Object.defineProperty(document, 'createElement', {
  value: jest.fn((tag) => ({
    tagName: tag.toUpperCase(),
    className: '',
    style: {},
    innerHTML: '',
    textContent: '',
    onclick: null,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    click: jest.fn(),
    appendChild: jest.fn(),
    removeChild: jest.fn(),
    setAttribute: jest.fn(),
    getAttribute: jest.fn(),
    classList: {
      add: jest.fn(),
      remove: jest.fn(),
      toggle: jest.fn(),
      contains: jest.fn(() => false)
    }
  })),
  writable: true
});

// Mock document.hidden property for visibility API
Object.defineProperty(document, 'hidden', {
  value: false,
  writable: true
});

// Set up DOM for testing
document.body.innerHTML = `
  <div class="container">
    <header>
      <div class="header-left">Thick Lines</div>
      <div class="header-center">
        <div class="color-section">
          <div class="color-buttons">
            <button class="color-btn red" data-color="#ef4444"></button>
            <button class="color-btn green" data-color="#10b981"></button>
            <button class="color-btn blue" data-color="#3b82f6"></button>
            <button class="color-btn yellow" data-color="#f59e0b"></button>
          </div>
        </div>
        <div class="toolbox">
          <button id="penBtn" class="tool-btn">Pen</button>
          <button id="eraserBtn" class="tool-btn">Eraser</button>
          <button id="undoBtn">Undo</button>
          <button id="redoBtn">Redo</button>
        </div>
      </div>
      <div class="header-right">
        <button id="clearBtn">Clear</button>
        <button id="exportBtn">Export</button>
        <button id="helpBtn">Help</button>
      </div>
    </header>
    <main id="whiteboard">
      <canvas id="drawing-canvas"></canvas>
      <div class="canvas-overlay"></div>
      <div class="size-visualizer"></div>
    </main>
    <div class="toast-container"></div>
    <div id="helpPanel" class="help-panel"></div>
    <div id="contextMenu" class="context-menu">
      <div id="ctx-undo">Undo</div>
      <div id="ctx-redo">Redo</div>
      <div id="ctx-cut">Cut</div>
      <div id="ctx-copy">Copy</div>
      <div id="ctx-paste">Paste</div>
      <div id="ctx-clear">Clear</div>
    </div>
  </div>
`;

// Load the main app.js file to make functions available globally
// This is done after DOM mocking to prevent reference errors
try {
  const appFunctions = require('../app.js');
  
  // Make all app functions globally available for tests
  Object.keys(appFunctions).forEach(key => {
    if (typeof appFunctions[key] === 'function') {
      global[key] = appFunctions[key];
    }
  });
  
  // Make global state variables available through the module exports
  // This creates a bridge between the module's internal state and the global test environment
  global.appModule = appFunctions;
  
  // Create proxy properties on global object to bridge state access
  // Tests expect direct access like global.isDrawing, but the module uses getter/setters
  const stateVariables = [
    'canvas', 'ctx', 'isDrawing', 'isPanning', 'isMiddleMouseDown',
    'currentColor', 'currentTool', 'penSize', 'eraserSize', 'undoStack',
    'redoStack', 'zoomLevel', 'panOffsetX', 'panOffsetY', 'lastMouseX',
    'lastMouseY', 'currentPath', 'drawingPaths', 'appInitialized',
    'showRulers', 'sizeVisualizer', 'contextMenu', 'copiedRegion',
    'middleMouseStartX', 'middleMouseStartY', 'lastPanPoint', 'domElements'
  ];
  
  stateVariables.forEach(varName => {
    Object.defineProperty(global, varName, {
      get: () => appFunctions[varName],
      set: (value) => { appFunctions[varName] = value; },
      configurable: true,
      enumerable: true
    });
  });
  
  console.log('App functions loaded successfully:', Object.keys(appFunctions).filter(k => typeof appFunctions[k] === 'function').length, 'functions available');
  console.log('State variables bridged:', stateVariables.length, 'variables accessible via global.*');
} catch (error) {
  console.error('Failed to load app.js:', error.message);
}

// Make sure DOM elements are available
afterEach(() => {
  jest.clearAllMocks();
});
