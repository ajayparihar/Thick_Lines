// Initialize the application when DOM is fully loaded
document.addEventListener('DOMContentLoaded', init);

// Canvas setup and state management
let canvas;
let ctx;
let isDrawing = false;
let isPanning = false;
let isMiddleMouseDown = false;
let middleMouseStartX = 0;
let middleMouseStartY = 0;
let lastPanPoint = { x: 0, y: 0 };
let currentColor = '#ef4444'; // Default to red
let currentTool = 'pen';
let eraserSize = 10; // Default eraser size (uniform grid)
let penSize = 10; // Default pen size (uniform grid)
let undoStack = [];
let redoStack = [];
let zoomLevel = 1.0; // Default zoom level
let zoomIncrement = 0.1; // Zoom step size
let panOffsetX = 0; // Pan offset X
let panOffsetY = 0; // Pan offset Y
let lastMouseX = 0;
let lastMouseY = 0;
let sizeVisualizer = null; // Element for visualizing pen/eraser size
let contextMenu = null; // Context menu element
let tooltip = null; // Tooltip element
let copiedRegion = null; // Store copied canvas region

// Initiate drawing variables
let drawingPaths = [];
let currentPath = null;
let animationFrameRequested = false;

// DOM element cache
let domElements = {
  sizeVisualizer: null,
  contextMenu: null,
  tooltip: null
};

// Constants
const DEFAULT_COLOR = '#ef4444';
const DEFAULT_ERASER_SIZE = 10;
const DEFAULT_PEN_SIZE = 10;
const DEFAULT_ZOOM = 1.0;
const ZOOM_INCREMENT = 0.1;
const CANVAS_BG_COLOR = '#1e293b';
const UNDO_STACK_LIMIT = 30;

// Flag to track if the app has been initialized
let appInitialized = false;

// Global variable to control ruler visibility
let showRulers = false;

// Performance monitoring
let frameCount = 0;
let lastFpsTime = performance.now();
let currentFps = 60;
let fpsDisplay = null;

// Keyboard navigation state
let keyboardCursorX = 0;
let keyboardCursorY = 0;
let keyboardNavigationEnabled = false;

// High contrast mode
let highContrastMode = false;

// Dirty region tracking for performance
let dirtyRegions = [];
let offscreenCanvas = null;
let offscreenCtx = null;

// Touch and pointer event state
let touchStartTime = 0;
let lastTouchDistance = 0;
let touchZoomCenter = { x: 0, y: 0 };
let activePointers = new Map();
let touchIdentifiers = [];
let lastTouchPanPoint = null;
let touchPanThreshold = 10; // px
let supportsPointerEvents = 'PointerEvent' in window;
let supportsTouchEvents = 'TouchEvent' in window;

// Debounce function for performance optimization
function debounce(func, wait) {
  let timeout;
  return function(...args) {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), wait);
  };
}

// Throttle function to limit how often a function can be called
function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// Create tooltip element if it doesn't exist
function createTooltip() {
  const tooltip = document.createElement('div');
  tooltip.className = 'tooltip';
  document.body.appendChild(tooltip);
  return tooltip;
}

// Initialize the canvas
function init() {
  // Prevent multiple initializations
  if (appInitialized) {
    console.log('App already initialized, skipping init');
    return;
  }

  console.log('Starting app initialization...');

  // Setup canvas with context optimization
  canvas = document.getElementById('drawing-canvas');
  if (!canvas) {
    console.error('CRITICAL ERROR: Could not find canvas element with ID "drawing-canvas"');
    return;
  }

  console.log('Canvas element found, getting context...');

  try {
    // Alpha needs to be enabled for proper eraser functionality
    ctx = canvas.getContext('2d', {
      alpha: true, // Enable alpha to support transparency for eraser
      desynchronized: true // Enable desynchronized hint for potential performance improvement
    });

    if (!ctx) {
      console.error('CRITICAL ERROR: Could not get canvas context');
      return;
    }

    console.log('Canvas context created successfully');

    // Apply initial size
    resizeCanvas();

    // Cache DOM elements
    domElements.sizeVisualizer = document.querySelector('.size-visualizer');
    domElements.contextMenu = document.getElementById('contextMenu');
    domElements.tooltip = document.querySelector('.tooltip') || createTooltip();

    // Set background color
    ctx.fillStyle = CANVAS_BG_COLOR;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Set initial state for rulers in body class
    if (!showRulers) {
      document.body.classList.add('rulers-disabled');
    }

    // Enable minimalist UI theme
    document.body.classList.add('minimal');

    console.log('Setting up event listeners...');
    // Setup event listeners
    setupEventListeners();

    console.log('Setting up UI components...');
    // Setup UI components
    setupUI();

    // Initial state save (blank canvas)
    saveState();

    appInitialized = true;
    console.log('Application initialized successfully');
  } catch (error) {
    console.error('Error during initialization:', error);
    showToast('Failed to initialize application', 'info');
  }
}

// Compute a reasonable click vs drag threshold that accounts for zoom and DPI
function calcClickMoveThreshold() {
  const dpr = window.devicePixelRatio || 1;
  // Base 5px at zoom 1 on standard DPI; scale with zoom and dampen by 0.8 to avoid over-inflation
  const base = 5;
  return Math.max(3, Math.round(base * zoomLevel * Math.min(dpr, 2) * 0.8));
}

// Setup all event listeners
function setupEventListeners() {
  console.log('Setting up event listeners...');

  try {
    if (!canvas) {
      console.error('Cannot set up canvas event listeners - canvas is null');
      return;
    }

    // Canvas events with passive option where appropriate for performance
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', optimizedMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd);
    canvas.addEventListener('contextmenu', handleContextMenu);

    console.log('Canvas event listeners attached successfully');

    // Keyboard events
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    // Add document-level mouseup to ensure panning stops even if cursor moves outside canvas
    document.addEventListener('mouseup', function(e) {
      // Handle middle mouse button click
      if (e.button === 1 && isMiddleMouseDown) {
        // Check if the mouse hasn't moved much (it's a click, not a drag)
        const moveThreshold = calcClickMoveThreshold(); // Dynamic threshold based on DPI/zoom
        const moveX = Math.abs(e.clientX - middleMouseStartX);
        const moveY = Math.abs(e.clientY - middleMouseStartY);

        if (moveX < moveThreshold && moveY < moveThreshold) {
          // It's a middle mouse click without much movement - open in new tab
          console.log('Middle mouse click detected - opening in new tab');
          window.open(window.location.href, '_blank');
        }

        // Reset middle mouse tracking
        isMiddleMouseDown = false;
      }

      // Stop panning if needed
      if (isPanning) {
        stopCanvasPan();
      }
    });

    // Window events
    window.addEventListener('resize', debounce(resizeCanvas, 250));

    // Document clicks
    document.addEventListener('click', handleDocumentClick);

    // Wheel event for zooming
    document.addEventListener('wheel', handleWheel, { passive: false });

    // Handle visibility change to manage memory
    document.addEventListener('visibilitychange', handleVisibilityChange);

    console.log('Global event listeners attached successfully');
  } catch (error) {
    console.error('Error setting up event listeners:', error);
  }
}

// Handle visibility change to free up memory when tab not visible
function handleVisibilityChange() {
  if (document.hidden) {
    // Page is hidden, possibly trim memory usage
    cleanupMemory();
  } else {
    // Page is visible again, ensure canvas is properly displayed
    if (canvas && ctx) {
      // Force a redraw from the undo stack if available
      if (undoStack.length > 0) {
        loadState(undoStack[undoStack.length - 1]);
      }
    }
  }
}

// Trim undo/redo stacks to save memory
function trimUndoRedoStacks() {
  // Keep only last 10 states when memory conservation is needed
  if (undoStack.length > 10) {
    // Remove oldest states but keep the initial state
    const initialState = undoStack[0];
    undoStack = [initialState].concat(undoStack.slice(-9));
  }

  // Clear redo stack entirely
  redoStack = [];

  // Force garbage collection hint if available
  if (window.gc) {
    try {
      window.gc();
    } catch (e) {
      // Ignore errors if gc is not available
    }
  }

  console.log('Memory cleanup performed');
}

// Show context menu
function showContextMenu(e) {
  if (!contextMenu) return;

  // Position menu at cursor
  contextMenu.style.left = `${e.clientX}px`;
  contextMenu.style.top = `${e.clientY}px`;

  // Make menu visible
  contextMenu.classList.add('visible');

  // Update paste button state
  const pasteButton = document.getElementById('ctx-paste');
  if (pasteButton) {
    if (copiedRegion) {
      pasteButton.classList.remove('disabled');
    } else {
      pasteButton.classList.add('disabled');
    }
  }
}

// Hide context menu
function hideContextMenu() {
  if (!contextMenu) return;

  contextMenu.classList.remove('visible');
}

// Handle context menu event (right-click)
function handleContextMenu(e) {
  e.preventDefault();

  // Position and show the context menu
  if (contextMenu) {
    showContextMenu(e);
  }

  return false;
}

// Optimize mouse move handler with requestAnimationFrame
const optimizedMouseMove = throttle((e) => {
  if (!animationFrameRequested) {
    animationFrameRequested = true;
    requestAnimationFrame(() => {
      handleMouseMove(e);
      animationFrameRequested = false;
    });
  }
}, 16); // ~60fps

// Set canvas size to match container with proper device pixel ratio handling
function resizeCanvas() {
  const whiteboard = document.getElementById('whiteboard');

  if (!whiteboard || !canvas || !ctx) {
    console.error('Critical elements not found during resizeCanvas');
    return;
  }

  // Save the current state before resize
  const currentState = undoStack.length > 0 ? undoStack[undoStack.length - 1] : null;

  // Get device pixel ratio
  const dpr = window.devicePixelRatio || 1;

  // Set display size (css pixels)
  const displayWidth = whiteboard.clientWidth;
  const displayHeight = whiteboard.clientHeight;

  // Set actual size with higher resolution
  canvas.width = displayWidth * dpr;
  canvas.height = displayHeight * dpr;

  // Scale down to display size
  canvas.style.width = `${displayWidth}px`;
  canvas.style.height = `${displayHeight}px`;

  // Scale all drawing operations to device pixel ratio
  ctx.scale(dpr, dpr);

  // Reset canvas context properties after resize
  ctx.fillStyle = CANVAS_BG_COLOR;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Apply zoom and pan
  applyTransform();

  // Restore state if available
  if (currentState) {
    loadState(currentState);
  } else if (showRulers) {
    // Draw rulers even if there's no state to restore
    drawRulers();
    if (lastMouseX && lastMouseY) {
      drawCursorGuides(lastMouseX, lastMouseY);
    }
  }
}

// Setup color buttons
function setupColorButtons() {
  console.log('Setting up color buttons...');

  try {
    const colorButtons = document.querySelectorAll('.color-btn');

    if (colorButtons.length === 0) {
      console.error('No color buttons found with class .color-btn');
      return;
    }

    console.log(`Found ${colorButtons.length} color buttons`);

    colorButtons.forEach(btn => {
      if (!btn.dataset.color) {
        console.warn('Color button missing data-color attribute:', btn);
      }

      btn.addEventListener('click', () => {
        console.log(`Color button clicked: ${btn.dataset.color}`);

        // Remove active class from all color buttons
        colorButtons.forEach(b => b.classList.remove('active'));

        // Add active class to clicked color button
        btn.classList.add('active');

        // Set current color
        currentColor = btn.dataset.color;

        // Ensure we're not in eraser mode
        if (currentTool === 'eraser') {
          setTool('pen');
          const penBtn = document.getElementById('penBtn');
          const eraserBtn = document.getElementById('eraserBtn');

          if (penBtn) penBtn.classList.add('active');
          if (eraserBtn) eraserBtn.classList.remove('active');
        }
      });
    });

    // Set initial active color
    const redColorBtn = document.querySelector('.color-btn.red');
    if (redColorBtn) {
      redColorBtn.classList.add('active');
    } else {
      console.warn('Red color button not found, could not set initial active color');
      // Try to set any color button as active
      if (colorButtons.length > 0) {
        colorButtons[0].classList.add('active');
        currentColor = colorButtons[0].dataset.color || DEFAULT_COLOR;
      }
    }
  } catch (error) {
    console.error('Error setting up color buttons:', error);
  }
}

// Setup tool buttons
function setupToolButtons() {
  console.log('Setting up tool buttons...');

  try {
    // Pen tool
    const penBtn = document.getElementById('penBtn');
    if (!penBtn) {
      console.error('Pen button not found with ID "penBtn"');
    } else {
      penBtn.addEventListener('click', function() {
        console.log('Pen button clicked');
        setTool('pen');
      });
    }

    // Pen sizes
    const penSizeDropdown = document.querySelector('.pen-size-dropdown');
    if (!penSizeDropdown) {
      console.error('Pen size dropdown not found with class ".pen-size-dropdown"');
    } else {
      penSizeDropdown.addEventListener('click', function(e) {
        if (e.target.classList.contains('pen-size-option')) {
          const size = parseInt(e.target.dataset.size);
          console.log(`Pen size selected: ${size}px`);
            // Update cursor size if needed
            updateCursor();
          penSize = size;
          if (penBtn) {
            penBtn.click();
            penSizeDropdown.classList.remove('show');
            // Update the pen button to show the current size
            penBtn.innerHTML = `<i class=\"fas fa-pencil-alt\"></i> Pen <span class=\"size-indicator\">${penSize}px</span>`;
            // Mark active option and show brief visualizer
            setActivePenSizeOption(penSize);
            showSizeChangeHint('pen');
          }
        }
      });
    }

    // Eraser tool
    const eraserBtn = document.getElementById('eraserBtn');
    if (!eraserBtn) {
      console.error('Eraser button not found with ID "eraserBtn"');
    } else {
      eraserBtn.addEventListener('click', function() {
        console.log('Eraser button clicked');
        setTool('eraser');
      });
    }

    // Eraser sizes
    const eraserSizeDropdown = document.querySelector('.eraser-size-dropdown');
    if (!eraserSizeDropdown) {
      console.error('Eraser size dropdown not found with class ".eraser-size-dropdown"');
    } else {
      eraserSizeDropdown.addEventListener('click', function(e) {
        if (e.target.classList.contains('eraser-size-option')) {
          const size = parseInt(e.target.dataset.size);
          console.log(`Eraser size selected: ${size}px`);
          eraserSize = size;
          if (eraserBtn) {
            eraserBtn.click();
            eraserSizeDropdown.classList.remove('show');
            // Update the eraser button to show the current size
            eraserBtn.innerHTML = `<i class=\"fas fa-eraser\"></i> Eraser <span class=\"size-indicator\">${eraserSize}px</span>`;
            // Mark active option and show brief visualizer
            setActiveEraserSizeOption(eraserSize);
            showSizeChangeHint('eraser');
          }
        }
      });
    }

    // Show dropdown menus when clicking the buttons
    if (penBtn && penSizeDropdown) {
      penBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        penSizeDropdown.classList.toggle('show');
        if (eraserSizeDropdown) {
          eraserSizeDropdown.classList.remove('show');
        }
      });
    }

    if (eraserBtn && eraserSizeDropdown) {
      eraserBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        eraserSizeDropdown.classList.toggle('show');
        if (penSizeDropdown) {
          penSizeDropdown.classList.remove('show');
        }
      });
    }

    // Update all buttons with current state
    updateToolButtonsText();
  } catch (error) {
    console.error('Error setting up tool buttons:', error);
  }
}

// Set active tool
function setTool(tool) {
  // Reset any active tool buttons
  document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));

  // Hide all active dropdowns
  document.querySelectorAll('.pen-size-dropdown, .eraser-size-dropdown').forEach(dropdown => {
    dropdown.classList.remove('show');
  });

  // Set the current tool
  currentTool = tool;

  // Update cursor based on tool
  updateCursor();

  // Highlight the active tool button
  if (tool === 'pen') {
    const penBtnEl = document.getElementById('penBtn');
    penBtnEl.classList.add('active');
    // Update the pen button to show the current size
    penBtnEl.innerHTML = `<i class=\"fas fa-pencil-alt\"></i> Pen <span class=\"size-indicator\">${penSize}px</span>`;
    setActivePenSizeOption(penSize);
    showSizeChangeHint('pen');
  } else if (tool === 'eraser') {
    const eraserBtnEl = document.getElementById('eraserBtn');
    eraserBtnEl.classList.add('active');
    // Update the eraser button to show the current size
    eraserBtnEl.innerHTML = `<i class=\"fas fa-eraser\"></i> Eraser <span class=\"size-indicator\">${eraserSize}px</span>`;
    setActiveEraserSizeOption(eraserSize);
    showSizeChangeHint('eraser');
  }
}

// Clear canvas with confirmation
function clearCanvas() {
  // Confirm before clearing
  if (undoStack.length <= 1 || confirm('Are you sure you want to clear the canvas? This cannot be undone.')) {
    // Reset transformations
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Clear to background color
    ctx.fillStyle = CANVAS_BG_COLOR;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Apply zoom and pan
    applyTransform();

    // Reset stacks
    undoStack = [];
    redoStack = [];

    // Save the empty state
    saveState();
    showToast('Canvas cleared', 'info');
  }
}

// Render a single animation frame
function renderFrame() {
  // If rulers are enabled, draw them and cursor guides
  if (showRulers && ctx && canvas) {
    // We need to load the current state to avoid drawing rulers multiple times
    if (undoStack.length > 0) {
      // Get the most recent state without modifying the stack
      const currentState = undoStack[undoStack.length - 1];

      // Load it to redraw the canvas
      const img = new Image();
      img.onload = () => {
        // Clear canvas
        ctx.fillStyle = CANVAS_BG_COLOR;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw the image
        ctx.drawImage(img, 0, 0, canvas.width / (window.devicePixelRatio || 1), canvas.height / (window.devicePixelRatio || 1));

        // Add rulers and guides
        drawRulers();
        if (lastMouseX && lastMouseY) {
          drawCursorGuides(lastMouseX, lastMouseY);
        }
      };
      img.src = currentState;
    } else {
      // Just draw rulers on empty canvas
      drawRulers();
      if (lastMouseX && lastMouseY) {
        drawCursorGuides(lastMouseX, lastMouseY);
      }
    }
  }
}

// Handle mouse movement
function handleMouseMove(e) {
  e.preventDefault();

  // Store the last mouse position for cursor guides
  lastMouseX = e.clientX;
  lastMouseY = e.clientY;

  // Update cursor guides if visible
  if (showRulers) {
    renderFrame();
  }

  if (isPanning) {
    moveCanvasPan(e);
  } else if (isDrawing) {
    draw(e);
  }
}

// Handle mouse down
function handleMouseDown(e) {
  e.preventDefault();

  try {
    console.log(`Mouse down detected - button: ${e.button}, tool: ${currentTool}`);

    if (e.button === 0) {
      // Left mouse button
      if (currentTool === 'pen') {
        console.log('Starting pen drawing');
        startDrawing(e);
      } else if (currentTool === 'eraser') {
        console.log('Starting eraser drawing');
        startDrawing(e);
      } else {
        console.log(`Unknown tool: ${currentTool}`);
      }
    } else if (e.button === 1) {
      // Middle mouse button
      // Store initial position to detect if it's a click or drag
      middleMouseStartX = e.clientX;
      middleMouseStartY = e.clientY;

      // Set a flag to track if it's potentially a middle click (without movement)
      isMiddleMouseDown = true;

      // We'll still enable panning for middle mouse drag
      console.log('Middle mouse button detected - waiting to determine if click or drag');
      startCanvasPan(e);
    } else if (e.button === 2) {
      // Right mouse button = context menu
      console.log('Showing context menu');
      handleContextMenu(e);
    }
  } catch (error) {
    console.error('Error in handleMouseDown:', error);
  }
}

// Handle mouse up
function handleMouseUp(e) {
  e.preventDefault();

  // Middle-click handling is now done at the document level

  if (isPanning) {
    stopCanvasPan();
  } else if (isDrawing) {
    stopDrawing();
  }
}

// Handle mouse out
function handleMouseOut() {
  // Hide size visualizer
  hideSizeVisualizer();

  if (isPanning) {
    // When mouse leaves canvas while panning, don't stop panning but make sure cursor is correct when it re-enters
    document.body.style.cursor = 'grabbing';

    // Add a mouseenter handler to restore cursor when mouse comes back to canvas
    const onMouseEnter = () => {
      if (isPanning) {
        canvas.style.cursor = 'grabbing';
      }
      canvas.removeEventListener('mouseenter', onMouseEnter);
    };

    canvas.addEventListener('mouseenter', onMouseEnter);
  }
}

// Start canvas panning (from mouse or touch)
function startCanvasPan(e) {
  // Set panning flag
  isPanning = true;

  // Set the last pan point to the current mouse position
  lastPanPoint = { x: e.clientX, y: e.clientY };

  console.log('Starting canvas pan - setting grabbing cursor');

  // Update cursor
  canvas.style.cursor = 'grabbing';
  document.body.style.cursor = 'grabbing';

  // Add panning class to overlay for visual feedback
  const overlay = document.querySelector('.canvas-overlay');
  if (overlay) {
    overlay.classList.add('panning');
  }
}

// Move the canvas (pan)
function moveCanvasPan(e) {
  if (!isPanning) return;

  const deltaX = e.clientX - lastPanPoint.x;
  const deltaY = e.clientY - lastPanPoint.y;

  panOffsetX += deltaX;
  panOffsetY += deltaY;

  lastPanPoint = { x: e.clientX, y: e.clientY };

  applyTransform(false);
}

// Stop canvas panning
function stopCanvasPan() {
  if (!isPanning) return;

  // Reset panning flag
  isPanning = false;

  console.log('Stopping canvas pan - resetting cursor');

  // Reset cursors explicitly to ensure they don't stay as hand/grab
  canvas.style.cursor = '';
  document.body.style.cursor = '';

  // Remove panning class from overlay
  const overlay = document.querySelector('.canvas-overlay');
  if (overlay) {
    overlay.classList.remove('panning');
  }

  // Force cursor update for current tool
  setTimeout(() => {
    updateCursor();
    console.log('Cursor updated to:', canvas.style.cursor);
  }, 0);
}

// Start drawing with pen or eraser
function startDrawing(e) {
  try {
    e.preventDefault();
    isDrawing = true;

    console.log(`Starting drawing with tool: ${currentTool}, color: ${currentColor}, size: ${currentTool === 'pen' ? penSize : eraserSize}`);

    // Get coordinates based on pointer/touch position
    const { x, y } = getCoordinates(e);
    console.log(`Drawing coordinates: x=${x}, y=${y}`);

    // Save the context state
    ctx.save();

    // Ensure correct composite operation for the active tool
    ctx.globalCompositeOperation = currentTool === 'eraser' ? 'destination-out' : 'source-over';

    // Draw a dot at the starting point
    drawDot(x, y);

    // Create a new path and add it to drawingPaths
    currentPath = {
      tool: currentTool,
      color: currentColor,
      size: currentTool === 'pen' ? penSize : eraserSize,
      points: [{ x, y, t: performance.now() }],
      lastWidth: currentTool === 'pen' ? penSize : eraserSize
    };

    drawingPaths.push(currentPath);

    // Show size visualizer
    if (domElements.sizeVisualizer) {
      showSizeVisualizer(x, y, currentTool === 'pen' ? penSize : eraserSize);
    }
  } catch (error) {
    console.error('Error in startDrawing:', error);
    isDrawing = false; // Reset drawing state on error
  }
}

// Continue drawing as mouse moves
function draw(e) {
  if (!isDrawing) return;

  const { x, y } = getCoordinates(e);
  const now = performance.now();

  if (currentPath && currentPath.points.length > 0) {
    const prevPoint = currentPath.points[currentPath.points.length - 1];

    if (currentTool === 'pen') {
      drawPenPath(prevPoint, { x, y, t: now });
    } else if (currentTool === 'eraser') {
      drawEraserPath(prevPoint, { x, y });
    }

    // Add point to current path
    currentPath.points.push({ x, y, t: now });
  }
}

// Stop drawing
function stopDrawing() {
  if (isDrawing) {
    isDrawing = false;
    currentPath = null;

    // Reset context state
    if (ctx) {
      ctx.restore();
      ctx.globalCompositeOperation = 'source-over';
    }

    // Hide the size visualizer
    if (domElements.sizeVisualizer) {
      hideSizeVisualizer();
    }

    // Save state for undo/redo
    saveState();
  }
}

// Handle touch start
function handleTouchStart(e) {
  try {
    e.preventDefault(); // Prevent default to avoid scrolling

    if (e.touches.length === 1) {
      // Single touch = drawing
      startDrawing(e.touches[0]);
    } else if (e.touches.length === 2) {
      // Two fingers = panning
      isDrawing = false;
      stopDrawing(); // Make sure any drawing is stopped

      // Calculate the midpoint between the two touches
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const midX = (touch1.clientX + touch2.clientX) / 2;
      const midY = (touch1.clientY + touch2.clientY) / 2;

      // Create a synthetic event for panning
      const syntheticEvent = {
        clientX: midX,
        clientY: midY,
        preventDefault: () => {}
      };

      startCanvasPan(syntheticEvent);
    }
  } catch (error) {
    console.error('Error in touch start handler:', error);
    // Reset states to avoid getting stuck
    isDrawing = false;
    isPanning = false;
    updateCursor();
  }
}

// Handle touch move
function handleTouchMove(e) {
  try {
    e.preventDefault(); // Prevent default to avoid scrolling

    if (e.touches.length === 1 && isDrawing) {
      // Single touch = drawing
      draw(e.touches[0]);
    } else if (e.touches.length === 2 && isPanning) {
      // Two fingers = panning
      // Calculate the midpoint between the two touches
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const midX = (touch1.clientX + touch2.clientX) / 2;
      const midY = (touch1.clientY + touch2.clientY) / 2;

      // Create a synthetic event for panning
      const syntheticEvent = {
        clientX: midX,
        clientY: midY,
        preventDefault: () => {}
      };

      moveCanvasPan(syntheticEvent);
    }
  } catch (error) {
    console.error('Error in touch move handler:', error);
    // Reset states to avoid getting stuck
    isDrawing = false;
    isPanning = false;
    updateCursor();
  }
}

// Handle touch end
function handleTouchEnd(e) {
  try {
    // Stop drawing
    if (isDrawing) {
      stopDrawing();
    }

    // Stop panning if no touches remain or just one touch
    if (isPanning && e.touches.length < 2) {
      isPanning = false;
      stopCanvasPan();

      // If one touch remains, start drawing again
      if (e.touches.length === 1) {
        startDrawing(e.touches[0]);
      }

      updateCursor();
    }
  } catch (error) {
    console.error('Error in touch end handler:', error);
    // Reset states to avoid getting stuck
    isDrawing = false;
    isPanning = false;
    updateCursor();
  }
}

// Get coordinates from mouse or touch event
function getCoordinates(e) {
  try {
    if (!canvas) {
      console.error('Cannot get coordinates - canvas is null');
      return { x: 0, y: 0 };
    }

    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;

    // Get client coordinates from mouse or touch event
    if (e.touches && e.touches.length > 0) {
      // Touch event
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
      console.log(`Touch coordinates: clientX=${clientX}, clientY=${clientY}`);
    } else {
      // Mouse event
      clientX = e.clientX;
      clientY = e.clientY;
      console.log(`Mouse coordinates: clientX=${clientX}, clientY=${clientY}`);
    }

    // Canvas space coordinates
    let x = clientX - rect.left;
    let y = clientY - rect.top;

    console.log(`Canvas relative coordinates before transform: x=${x}, y=${y}`);
    console.log(`Current transform: zoom=${zoomLevel}, panX=${panOffsetX}, panY=${panOffsetY}`);

    // Adjust for current zoom and pan
    x = (x - panOffsetX) / zoomLevel;
    y = (y - panOffsetY) / zoomLevel;

    console.log(`Final drawing coordinates: x=${x}, y=${y}`);

    // Update last mouse position for cursor guides
    lastMouseX = clientX;
    lastMouseY = clientY;

    return { x, y };
  } catch (error) {
    console.error('Error in getCoordinates:', error);
    return { x: 0, y: 0 }; // Return default coordinates on error
  }
}

// Save the current state for undo/redo
function saveState() {
  try {
    // Use PNG format to preserve transparency for eraser
    const dataUrl = canvas.toDataURL('image/png');

    // Save current state and clear redo stack
    undoStack.push(dataUrl);
    redoStack = [];

    // Limit undo stack size to prevent memory issues
    if (undoStack.length > UNDO_STACK_LIMIT) {
      // Remove the oldest states to keep within limit
      const excess = undoStack.length - UNDO_STACK_LIMIT;
      undoStack.splice(0, excess);
    }

    // Update UI elements
    updateUndoRedoButtons();

    // Schedule memory cleanup if the stack is getting large
    if (undoStack.length > UNDO_STACK_LIMIT / 2) {
      setTimeout(() => {
        if (document.hidden) {
          trimUndoRedoStacks();
        }
      }, 5000);
    }
  } catch (err) {
    console.error('Error saving canvas state:', err);
    showToast('Error saving canvas state', 'info');
  }
}

// Undo the last action
function undo() {
  if (undoStack.length <= 1) return; // Keep at least the initial state

  // Move current state to redo stack
  redoStack.push(undoStack.pop());

  // Load the previous state
  loadState(undoStack[undoStack.length - 1]);

  // Update button states
  updateUndoRedoButtons();
}

// Redo the last undone action
function redo() {
  if (redoStack.length === 0) return;

  // Get last redo state
  const state = redoStack.pop();

  // Add to undo stack
  undoStack.push(state);

  // Load the state
  loadState(state);

  // Update button states
  updateUndoRedoButtons();
}

// Load a saved state onto the canvas
function loadState(dataURL) {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      // Clear canvas with proper reset of composite operations
      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = CANVAS_BG_COLOR;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw the image
      ctx.drawImage(img, 0, 0, canvas.width / (window.devicePixelRatio || 1), canvas.height / (window.devicePixelRatio || 1));
      ctx.restore();

      // Draw rulers if needed
      if (showRulers) {
        drawRulers();
        if (lastMouseX && lastMouseY) {
          drawCursorGuides(lastMouseX, lastMouseY);
        }
      }

      resolve();
    };

    img.onerror = () => {
      console.error('Failed to load canvas state');
      showToast('Failed to load canvas state', 'info');
      reject();
    };

    img.src = dataURL;
  });
}

// Draw rulers on the canvas
function drawRulers() {
  if (!ctx || !canvas) return;

  const canvasWidth = canvas.width;
  const canvasHeight = canvas.height;
  const rulerWidth = 20;

  // Save current context state
  ctx.save();

  // Set rulers style
  ctx.fillStyle = 'rgba(30, 41, 59, 0.8)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 1;
  ctx.font = '10px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Draw horizontal ruler background
  ctx.fillRect(0, 0, canvasWidth, rulerWidth);

  // Draw vertical ruler background
  ctx.fillRect(0, 0, rulerWidth, canvasHeight);

  // Draw ruler markings
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';

  // Horizontal ruler markings
  for (let x = 0; x < canvasWidth; x += 50) {
    // Major ticks every 50px
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, rulerWidth);
    ctx.stroke();

    // Add label every 100px
    if (x % 100 === 0) {
      ctx.fillText(x.toString(), x, rulerWidth / 2);
    }
  }

  // Vertical ruler markings
  for (let y = 0; y < canvasHeight; y += 50) {
    // Major ticks every 50px
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(rulerWidth, y);
    ctx.stroke();

    // Add label every 100px
    if (y % 100 === 0) {
      ctx.fillText(y.toString(), rulerWidth / 2, y);
    }
  }

  // Restore context
  ctx.restore();
}

// Draw cursor guides
function drawCursorGuides(x, y) {
  if (!ctx || !canvas) return;

  const canvasWidth = canvas.width;
  const canvasHeight = canvas.height;

  // Save current context state
  ctx.save();

  // Set guide style
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 5]);

  // Draw horizontal guide
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(canvasWidth, y);
  ctx.stroke();

  // Draw vertical guide
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, canvasHeight);
  ctx.stroke();

  // Restore context
  ctx.restore();
}

// Update the UI state of undo/redo buttons
function updateUndoRedoButtons() {
  const undoBtn = document.getElementById('undoBtn');
  const redoBtn = document.getElementById('redoBtn');

  if (!undoBtn || !redoBtn) return;

  // Set disabled state based on stack lengths
  undoBtn.disabled = undoStack.length <= 1;
  redoBtn.disabled = redoStack.length === 0;

  // Update classes
  undoBtn.classList.toggle('disabled', undoBtn.disabled);
  redoBtn.classList.toggle('disabled', redoBtn.disabled);
}

// Export canvas as image
function exportCanvas() {
  console.log('exportCanvas function called');
  if (undoStack.length === 0) {
    console.log('No drawing to export');
    showToast('No drawing to export', 'info');
    return;
  }

  try {
    // Create a temporary canvas to render the exported image without UI elements
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');

    // Fill with background color
    tempCtx.fillStyle = '#1e293b';
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

    // Use the last saved state from undoStack to ensure we export the correct state
    if (undoStack.length > 0) {
      const img = new Image();
      img.onload = function() {
        // Draw the image from the undoStack
        tempCtx.drawImage(img, 0, 0);

        // Add timestamp to filename and sanitize it
        const now = new Date();
        const timestamp = now.toISOString().replace(/[:.]/g, '-').replace('T', '_').substring(0, 19);
        const rawFilename = `thick-lines-drawing_${timestamp}.png`;
        const filename = sanitizeFilename(rawFilename);

        // Create a temporary link element
        const link = document.createElement('a');

        // Set the download filename
        link.download = filename;

        // Get the data URL from the temp canvas
        try {
          link.href = tempCanvas.toDataURL('image/png');

          // Append to body, click to trigger download, then remove
          document.body.appendChild(link);
          console.log('Clicking download link');
          link.click();
          document.body.removeChild(link);

          // Check if the file was saved successfully
          setTimeout(() => {
            if (link.href) {
              showToast('Drawing exported successfully!', 'info');
            } else {
              showToast('Failed to save drawing', 'error');
            }
          }, 1000); // Delay to ensure file save operation completes
        } catch (err) {
          console.error('Error creating data URL:', err);
          showToast('Failed to export drawing', 'info');
        }
      };

      img.onerror = function() {
        console.error('Error loading state image for export');
        showToast('Failed to export drawing', 'info');
      };

      // Load the last state
      img.src = undoStack[undoStack.length - 1];
    } else {
      showToast('No drawing to export', 'info');
    }
  } catch (err) {
    console.error('Error during image export:', err);
    showToast('Failed to export drawing', 'info');
  }
}

// Toast notification system
function showToast(message, type = 'info') {
  const toastContainer = document.querySelector('.toast-container');
  if (!toastContainer) return;

  // Reuse existing toast element if possible to avoid DOM creations
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    toastContainer.appendChild(toast);
  }

  // Set toast content and class
  toast.textContent = message;
  toast.className = `toast ${type}`;

  // Show the toast
  toast.classList.add('show');

  // Automatically hide the toast after a delay
  setTimeout(() => {
    toast.classList.remove('show');

    // Remove toast element if too many are created
    const toasts = document.querySelectorAll('.toast');
    if (toasts.length > 3) {
      setTimeout(() => {
        toastContainer.removeChild(toast);
      }, 300); // Wait for fadeout animation
    }
  }, 3000);
}

// Apply zoom and pan transformations
function applyTransform(showAnimation = false) {
  // Reset transformation
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  if (showAnimation) {
    // Animate the transform change
    const duration = 300; // ms
    const startTime = performance.now();
    const startZoom = zoomLevel;
    const startPanX = panOffsetX;
    const startPanY = panOffsetY;

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Apply easing function for smooth animation
      const easeProgress = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      // Calculate intermediary values
      const currentZoom = startZoom + (zoomLevel - startZoom) * easeProgress;
      const currentPanX = startPanX + (panOffsetX - startPanX) * easeProgress;
      const currentPanY = startPanY + (panOffsetY - startPanY) * easeProgress;

      // Apply transform
      ctx.setTransform(currentZoom, 0, 0, currentZoom, currentPanX, currentPanY);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  } else {
    // Apply transform immediately
    ctx.setTransform(zoomLevel, 0, 0, zoomLevel, panOffsetX, panOffsetY);
  }

  // Update cursor and zoom display
  updateCursor();
  updateZoomDisplay();
}

// Update cursor based on current tool and zoom
function updateCursor() {
  if (!canvas) {
    console.error('Cannot update cursor - canvas is null');
    return;
  }

  try {
    console.log(`Updating cursor for tool: ${currentTool}, isPanning: ${isPanning}`);

    if (isPanning) {
      canvas.style.cursor = 'grabbing';
    } else if (currentTool === 'pen') {
      // Use a simple crosshair instead of SVG to ensure compatibility
      canvas.style.cursor = 'crosshair';
    } else if (currentTool === 'eraser') {
      // Use circle cursor to indicate eraser
      const cursorSize = eraserSize;
      const halfSize = cursorSize / 2;
      const cursorColor = 'rgba(255, 255, 255, 0.8)';

      // Create custom cursor with circle shape
      const cursorCanvas = document.createElement('canvas');
      cursorCanvas.width = cursorSize + 2; // +2 for border
      cursorCanvas.height = cursorSize + 2;
      const cursorCtx = cursorCanvas.getContext('2d');

      // Draw circle
      cursorCtx.beginPath();
      cursorCtx.arc(halfSize + 1, halfSize + 1, halfSize, 0, Math.PI * 2);
      cursorCtx.strokeStyle = cursorColor;
      cursorCtx.lineWidth = 1.5;
      cursorCtx.stroke();

      // Set custom cursor
      const dataURL = cursorCanvas.toDataURL();
      canvas.style.cursor = `url(${dataURL}) ${halfSize + 1} ${halfSize + 1}, auto`;
    } else {
      // Default cursor if no tool selected
      canvas.style.cursor = 'default';
    }
    console.log('Cursor set to:', canvas.style.cursor);
  } catch (error) {
    console.error('Error updating cursor:', error);
    // Fallback to default cursor
    canvas.style.cursor = 'default';
  }
}

// Setup help panel
function setupHelpPanel() {
  const helpBtn = document.getElementById('helpBtn');
  const closeHelpBtn = document.getElementById('closeHelpBtn');
  const helpPanel = document.getElementById('helpPanel');

  if (helpBtn && closeHelpBtn && helpPanel) {
    helpBtn.addEventListener('click', toggleHelpPanel);
    closeHelpBtn.addEventListener('click', toggleHelpPanel);

    // Add keyboard event listener to close on escape
    helpPanel.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeHelpPanel();
    });
  }
}

// Toggle help panel
function toggleHelpPanel() {
  const helpPanel = document.getElementById('helpPanel');
  if (helpPanel) {
    helpPanel.classList.toggle('show');

    // Update aria-hidden state for accessibility
    const isVisible = helpPanel.classList.contains('show');
    helpPanel.setAttribute('aria-hidden', !isVisible);

    // Add overlay click to close if showing
    if (isVisible) {
      // Create modal backdrop if it doesn't exist
      let modalBackdrop = document.querySelector('.modal-backdrop');
      if (!modalBackdrop) {
        modalBackdrop = document.createElement('div');
        modalBackdrop.className = 'modal-backdrop';
        document.body.appendChild(modalBackdrop);
      }

      // Show backdrop
      modalBackdrop.classList.add('show');

      // Add click event to close
      modalBackdrop.addEventListener('click', closeHelpPanel, { once: true });
    } else {
      // Remove backdrop when closing
      const modalBackdrop = document.querySelector('.modal-backdrop');
      if (modalBackdrop) {
        modalBackdrop.classList.remove('show');
        setTimeout(() => {
          if (modalBackdrop.parentNode) {
            modalBackdrop.parentNode.removeChild(modalBackdrop);
          }
        }, 300);
      }
    }
  }
}

// Close help panel function
function closeHelpPanel() {
  const helpPanel = document.getElementById('helpPanel');
  if (helpPanel && helpPanel.classList.contains('show')) {
    toggleHelpPanel();
  }
}

// Show pen/eraser size visualizer
function showSizeVisualizer(x, y, size) {
  if (!sizeVisualizer) return;

  sizeVisualizer.style.width = size + 'px';
  sizeVisualizer.style.height = size + 'px';
  sizeVisualizer.style.left = x + 'px';
  sizeVisualizer.style.top = y + 'px';
  sizeVisualizer.classList.add('visible');

  // Set the color based on current tool
  if (currentTool === 'pen') {
    sizeVisualizer.style.backgroundColor = currentColor + '40'; // 25% opacity
    sizeVisualizer.style.borderColor = currentColor;
  } else {
    sizeVisualizer.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
    sizeVisualizer.style.borderColor = 'rgba(255, 255, 255, 0.7)';
  }
}

// Hide pen/eraser size visualizer
function hideSizeVisualizer() {
  if (!sizeVisualizer) return;

  sizeVisualizer.classList.remove('visible');
}

// Update the text of tool buttons to show current size
function updateToolButtonsText() {
  const penBtn = document.getElementById('penBtn');
  const eraserBtn = document.getElementById('eraserBtn');

  if (penBtn) {
    penBtn.innerHTML = `<i class=\"fas fa-pencil-alt\"></i> Pen <span class=\"size-indicator\">${penSize}px</span>`;
  }

  if (eraserBtn) {
    eraserBtn.innerHTML = `<i class=\"fas fa-eraser\"></i> Eraser <span class=\"size-indicator\">${eraserSize}px</span>`;
  }
  // Reflect active sizes in dropdowns
  setActivePenSizeOption(penSize);
  setActiveEraserSizeOption(eraserSize);
}

// Highlight active pen size option
function setActivePenSizeOption(size) {
  const options = document.querySelectorAll('.pen-size-option');
  options.forEach(opt => {
    opt.classList.toggle('active', parseInt(opt.dataset.size) === size);
  });
}

// Highlight active eraser size option
function setActiveEraserSizeOption(size) {
  const options = document.querySelectorAll('.eraser-size-option');
  options.forEach(opt => {
    opt.classList.toggle('active', parseInt(opt.dataset.size) === size);
  });
}

// Briefly show the size at cursor to confirm change
function showSizeChangeHint(tool) {
  try {
    if (!domElements.sizeVisualizer) return;
    // Use last known position; fall back to center
    const rect = canvas.getBoundingClientRect();
    const x = lastMouseX || rect.left + rect.width / 2;
    const y = lastMouseY || rect.top + rect.height / 2;

    const size = tool === 'pen' ? penSize : eraserSize;
    showSizeVisualizer(x - rect.left, y - rect.top, size);
    setTimeout(() => hideSizeVisualizer(), 700);
  } catch (_) {}
}

// Handle escape key
function handleEscapeKey() {
  // Hide all dropdowns
  document.querySelectorAll('.pen-size-dropdown, .eraser-size-dropdown').forEach(dropdown => {
    dropdown.classList.remove('show');
  });

  // Hide help panel if visible
  const helpPanel = document.getElementById('helpPanel');
  if (helpPanel && helpPanel.classList.contains('show')) {
    toggleHelpPanel();
  }

  // Hide context menu if visible
  hideContextMenu();
}

// Handle clicking outside dropdowns
function handleDocumentClick(e) {
  // Close all dropdowns when clicking outside
  const isDropdown =
    e.target.closest('.pen-size-dropdown') ||
    e.target.closest('.eraser-size-dropdown') ||
    e.target.matches('.tool-btn') ||
    e.target.closest('.tool-btn');

  if (!isDropdown) {
    // Hide all dropdowns
    document.querySelectorAll('.pen-size-dropdown, .eraser-size-dropdown').forEach(dropdown => {
      dropdown.classList.remove('show');
    });
  }

  // Hide context menu when clicking outside
  if (!e.target.closest('#contextMenu')) {
    hideContextMenu();
  }
}

// Copy the selected region
function copySelection() {
  // For now, copy the entire canvas as we don't have selection implemented
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = canvas.width;
  tempCanvas.height = canvas.height;
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.drawImage(canvas, 0, 0);

  // Store locally
  copiedRegion = tempCanvas;

  // Save to system clipboard
  tempCanvas.toBlob(blob => {
    try {
      const item = new ClipboardItem({ 'image/png': blob });
      navigator.clipboard.write([item])
        .then(() => {
          showToast('Canvas copied to clipboard', 'info');
        })
        .catch(err => {
          console.error('Clipboard write failed:', err);
          showToast('Failed to copy to system clipboard', 'info');
        });
    } catch (error) {
      console.error('Error creating clipboard item:', error);
      showToast('Canvas copied to internal clipboard only', 'info');
    }
  });
}

// Cut the selected region
function cutSelection() {
  // First copy the canvas
  copySelection();

  // Then clear it (for now, we just clear everything as selection isn't implemented)
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  saveState();
  showToast('Canvas cut to clipboard', 'info');
}

// Paste the copied region
function pasteSelection() {
  // Try to paste from system clipboard first
  try {
    navigator.clipboard.read()
      .then(clipboardItems => {
        // Check if there are clipboard items
        if (clipboardItems && clipboardItems.length > 0) {
          // Get the first item
          const item = clipboardItems[0];

          // Check if it has an image type
          if (item.types.some(type => type.startsWith('image/'))) {
            // Get the image blob
            const imageType = item.types.find(type => type.startsWith('image/'));
            item.getType(imageType)
              .then(blob => {
                // Create an image from the blob
                const img = new Image();
                img.onload = function() {
                  // Draw the image in the center of the view
                  const x = (canvas.width - img.width) / 2;
                  const y = (canvas.height - img.height) / 2;
                  ctx.drawImage(img, x, y);

                  saveState();
                  showToast('Pasted from system clipboard', 'info');
                };
                img.src = URL.createObjectURL(blob);
              })
              .catch(() => {
                // Fall back to internal clipboard if system clipboard access fails
                pasteFromInternalClipboard();
              });
          } else {
            // No image in system clipboard, try internal
            pasteFromInternalClipboard();
          }
        } else {
          // No items in system clipboard, try internal
          pasteFromInternalClipboard();
        }
      })
      .catch(() => {
        // Fall back to internal clipboard if system clipboard access fails
        pasteFromInternalClipboard();
      });
  } catch (error) {
    // Fall back to internal clipboard if system clipboard API is not available
    pasteFromInternalClipboard();
  }
}

// Helper function to paste from internal clipboard
function pasteFromInternalClipboard() {
  if (!copiedRegion) {
    showToast('Nothing to paste', 'info');
    return;
  }

  // Paste the region in the center of the view
  const x = (canvas.width - copiedRegion.width) / 2;
  const y = (canvas.height - copiedRegion.height) / 2;

  ctx.drawImage(copiedRegion, x, y);

  saveState();
  showToast('Pasted from internal clipboard', 'info');
}

// Handle key down
function handleKeyDown(e) {
  // Avoid handling keydown events in input fields
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

  // Check for keyboard navigation first
  if (handleKeyboardNavigation(e)) {
    e.preventDefault();
    return;
  }

  const key = e.key.toLowerCase();

  // Switch statements are faster than multiple if/else in most browsers
  switch (key) {
    case 'z':
      if (e.ctrlKey) {
        e.preventDefault();
        undo();
      }
      break;
    case 'y':
      if (e.ctrlKey) {
        e.preventDefault();
        redo();
      }
      break;
    case 'p':
      if (!e.ctrlKey) {
        setTool('pen');
      }
      break;
    case 'e':
      if (!e.ctrlKey) {
        setTool('eraser');
      }
      break;
    case 's':
      if (e.ctrlKey) {
        e.preventDefault();
        exportCanvas();
      }
      break;
    case 'delete':
      if (e.shiftKey) {
        e.preventDefault();
        clearCanvas();
      }
      break;
    case 'escape':
      handleEscapeKey();
      break;
    case '?':
      toggleHelpPanel();
      break;
    case 'h':
      if (e.ctrlKey) {
        e.preventDefault();
        toggleHighContrastMode();
      }
      break;
    case 'k':
      if (e.ctrlKey) {
        e.preventDefault();
        toggleKeyboardNavigation();
      }
      break;
    case 'f':
      if (e.ctrlKey && e.shiftKey) {
        e.preventDefault();
        toggleFPSDisplay();
      }
      break;
    case '1':
    case '2':
    case '3':
    case '4':
      if (!keyboardNavigationEnabled) {
        // Select color based on number key
        const colorButtons = document.querySelectorAll('.color-btn');
        const index = parseInt(key) - 1;
        if (colorButtons[index]) {
          colorButtons[index].click();
        }
      }
      break;
    case '6':
    case '7':
    case '8':
    case '9':
    case '0':
      // Brush size shortcuts (6=2px, 7=5px, 8=10px, 9=20px, 0=30px)
      const sizeMap = { '6': 2, '7': 5, '8': 10, '9': 20, '0': 30 };
      const size = sizeMap[key];
      if (size) {
        if (currentTool === 'pen') {
          penSize = size;
          updateToolButtonsText();
          showSizeChangeHint('pen');
        } else if (currentTool === 'eraser') {
          eraserSize = size;
          updateToolButtonsText();
          showSizeChangeHint('eraser');
        }
        showToast(`${currentTool === 'pen' ? 'Pen' : 'Eraser'} size: ${size}px`, 'info');
      }
      break;
  }
}

// Handle key up events
function handleKeyUp() {
  // Space key handling removed
}

// Handle wheel event for zooming
function handleWheel(e) {
  // Only handle zoom if Ctrl key is pressed
  if (e.ctrlKey) {
    e.preventDefault();

    // Calculate zoom delta
    const delta = e.deltaY > 0 ? -zoomIncrement : zoomIncrement;
    const newZoom = Math.max(0.5, Math.min(3, zoomLevel + delta));

    // Get mouse position for zoom origin
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Calculate new offsets to zoom toward mouse position
    if (newZoom !== zoomLevel) {
      const scaleFactor = newZoom / zoomLevel;

      // Adjust pan offset to zoom toward mouse position
      panOffsetX = mouseX - (mouseX - panOffsetX) * scaleFactor;
      panOffsetY = mouseY - (mouseY - panOffsetY) * scaleFactor;

      // Update zoom level
      zoomLevel = newZoom;

      // Apply transform
      applyTransform(true);

      // Update zoom display
      updateZoomDisplay();

      // Show toast for feedback
      showToast(`Zoom: ${Math.round(zoomLevel * 100)}%`, 'info');
    }
  }
}

// Update zoom display
function updateZoomDisplay() {
  const zoomPercent = Math.round(zoomLevel * 100);

  // Update zoom slider if exists
  const zoomSlider = document.getElementById('zoomSlider');
  if (zoomSlider) {
    zoomSlider.value = zoomLevel;
  }

  // Update zoom display text
  const zoomDisplay = document.getElementById('zoomDisplay');
  if (zoomDisplay) {
    zoomDisplay.textContent = `${zoomPercent}%`;
    zoomDisplay.classList.add('zooming');

    // Remove animation class after animation completes
    setTimeout(() => {
      zoomDisplay.classList.remove('zooming');
    }, 500);
  }
}

// Initialize everything when the window loads
window.onload = function() {
  try {
    init();
    console.log('Application initialized successfully');

    // Add mousewheel for scrolling - moved inside onload to ensure canvas is initialized
    if (canvas) {
      canvas.addEventListener('wheel', function(e) {
        // Only prevent default if we're actually handling the event
        if (e.shiftKey || !e.ctrlKey) {
          e.preventDefault();

          if (e.shiftKey) {
            // Shift + wheel for horizontal scrolling
            panOffsetX += e.deltaY;
            applyTransform(false);
          } else {
            // Regular wheel for vertical scrolling
            panOffsetY += e.deltaY;
            applyTransform(false);
          }
        }
      }, { passive: false });
    }
  } catch (error) {
    console.error('Error initializing application:', error);
  }
};

// Draw a dot at the specified coordinates
function drawDot(x, y) {
  if (!ctx) return;

  // Set up the style based on current tool
  if (currentTool === 'pen') {
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = currentColor;
    const dotSize = penSize / 2;

    // Draw circle
    ctx.beginPath();
    ctx.arc(x, y, dotSize, 0, Math.PI * 2);
    ctx.fill();
  } else if (currentTool === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0, 0, 0, 1)'; // Color doesn't matter with destination-out
    const dotSize = eraserSize / 2;

    // Draw circle
    ctx.beginPath();
    ctx.arc(x, y, dotSize, 0, Math.PI * 2);
    ctx.fill();
  }
}

// New function for drawing pen paths
function drawPenPath(prevPoint, currentPoint) {
  // Save the current context state
  ctx.save();

  // Set drawing parameters for pen
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = currentColor;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Access previous points for smoothing
  const points = currentPath ? currentPath.points : [];
  const p0 = points && points.length >= 2 ? points[points.length - 2] : null; // point before prev
  const p1 = prevPoint;
  const p2 = currentPoint;

  // Compute velocity (px per ms) and map to dynamic width
  let v = 0;
  if (p1 && p2 && typeof p2.t === 'number' && typeof p1.t === 'number') {
    const dt = Math.max(1, p2.t - p1.t);
    v = distance(p1, p2) / dt;
  }
  const targetWidth = velocityToWidth(v, penSize);
  const last = currentPath && typeof currentPath.lastWidth === 'number' ? currentPath.lastWidth : penSize;
  const width = last * 0.7 + targetWidth * 0.3; // low-pass filter for stability
  if (currentPath) currentPath.lastWidth = width;
  ctx.lineWidth = width;

  // Smooth with quadratic curve between midpoints
  if (p0) {
    const m1 = midpoint(p0, p1);
    const m2 = midpoint(p1, p2);
    ctx.beginPath();
    ctx.moveTo(m1.x, m1.y);
    ctx.quadraticCurveTo(p1.x, p1.y, m2.x, m2.y);
    ctx.stroke();
  } else {
    // Fallback for the very first segment
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  }

  // Restore the context state
  ctx.restore();

  // Helper functions scoped here to avoid polluting global namespace
  function distance(a, b) { const dx = a.x - b.x; const dy = a.y - b.y; return Math.hypot(dx, dy); }
  function midpoint(a, b) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }
  function velocityToWidth(v, base) {
    const minW = Math.max(0.5, base * 0.35);
    const maxW = base * 1.25;
    const norm = Math.min(v / 0.4, 1); // 0..1 where ~0.4 px/ms is fast
    return maxW - (maxW - minW) * norm;
  }
}

// New function for drawing eraser paths
function drawEraserPath(prevPoint, currentPoint) {
  // Smooth, constant-width eraser using midpoint quadratic curves
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.strokeStyle = 'rgba(0,0,0,1)';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const points = currentPath ? currentPath.points : [];
  const p0 = points && points.length >= 2 ? points[points.length - 2] : null;
  const p1 = prevPoint;
  const p2 = currentPoint;

  ctx.lineWidth = eraserSize; // keep constant eraser size to avoid artifacts

  if (p0) {
    const m1 = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
    const m2 = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    ctx.beginPath();
    ctx.moveTo(m1.x, m1.y);
    ctx.quadraticCurveTo(p1.x, p1.y, m2.x, m2.y);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  }

  ctx.restore();
}

// Cache frequently used elements for event handlers
const getCanvasContainer = (() => {
  let container;
  return () => {
    if (!container) {
      container = document.getElementById('whiteboard');
    }
    return container;
  };
})();

// Setup UI components
function setupUI() {
  setupColorButtons();
  setupToolButtons();
  updateToolButtonsText();
  setupUndoRedoButtons();
  setupHelpPanel();
  setupContextMenu();
  
  // Initialize accessibility features
  initHighContrastMode();
  
  // Set up performance monitoring
  if (window.requestAnimationFrame) {
    const performanceLoop = () => {
      updateFPS();
      requestAnimationFrame(performanceLoop);
    };
    requestAnimationFrame(performanceLoop);
  }

  // Show welcome toast
  showToast('Welcome to Thick Lines!', 'info');
}

// Setup undo/redo buttons
function setupUndoRedoButtons() {
  const undoBtn = document.getElementById('undoBtn');
  const redoBtn = document.getElementById('redoBtn');
  if (undoBtn && redoBtn) {
    undoBtn.addEventListener('click', undo);
    redoBtn.addEventListener('click', redo);
    updateUndoRedoButtons();
  }
}

// Setup context menu
function setupContextMenu() {
  contextMenu = document.getElementById('contextMenu');

  if (!contextMenu) return;

  // Set up event listeners for context menu items
  document.getElementById('ctx-undo').addEventListener('click', () => {
    undo();
    hideContextMenu();
  });

  document.getElementById('ctx-redo').addEventListener('click', () => {
    redo();
    hideContextMenu();
  });

  document.getElementById('ctx-cut').addEventListener('click', () => {
    cutSelection();
    hideContextMenu();
  });

  document.getElementById('ctx-copy').addEventListener('click', () => {
    copySelection();
    hideContextMenu();
  });

  document.getElementById('ctx-paste').addEventListener('click', () => {
    pasteSelection();
    hideContextMenu();
  });

  document.getElementById('ctx-clear').addEventListener('click', () => {
    clearCanvas();
    hideContextMenu();
  });

  // Hide context menu when clicking elsewhere
  document.addEventListener('click', (e) => {
    if (!contextMenu.contains(e.target)) {
      hideContextMenu();
    }
  });
}

// Memory cleaning function for better performance
function cleanupMemory() {
  // Trim undo/redo stacks
  trimUndoRedoStacks();

  // Clear any unused path data
  drawingPaths = [];

  // Clear copied region data if not needed
  copiedRegion = null;

  // Free up any additional resources
  if (domElements.sizeVisualizer) {
    hideSizeVisualizer();
  }

  console.log('Deep memory cleanup performed');
}

// Security utility functions

// Sanitize HTML content to prevent XSS
function sanitizeHTML(input) {
  const element = document.createElement('div');
  element.textContent = input;
  return element.innerHTML;
}

// Validate color inputs to ensure they're proper hex codes or named colors
function validateColor(color) {
  // Allow standard CSS color names
  const namedColors = ['black', 'white', 'red', 'green', 'blue', 'yellow', 'orange', 'purple', 'pink', 'brown', 'gray', 'cyan', 'magenta'];
  if (namedColors.includes(color.toLowerCase())) {
    return color.toLowerCase();
  }
  
  // Check if it's a valid hex color
  const hexRegex = /^#([0-9A-F]{3}){1,2}$/i;
  if (hexRegex.test(color)) {
    return color;
  }
  
  // Check if it's a valid rgb/rgba color
  const rgbRegex = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)$/i;
  if (rgbRegex.test(color)) {
    return color;
  }
  
  // Default to a safe color if validation fails
  console.warn(`Invalid color detected: ${color}, defaulting to fallback color`);
  return DEFAULT_COLOR;
}

// Validate numeric inputs to ensure they're within acceptable ranges
function validateNumericInput(value, min, max, defaultValue) {
  const num = parseFloat(value);
  if (isNaN(num) || num < min || num > max) {
    console.warn(`Invalid numeric input: ${value}, defaulting to ${defaultValue}`);
    return defaultValue;
  }
  return num;
}

// Sanitize filename for export
function sanitizeFilename(filename) {
  // Remove any path traversal characters and invalid filename characters
  return filename.replace(/[/\\?%*:|"<>]/g, '-')
                .replace(/\.\.+/g, '-') // Prevent path traversal attempts
                .substring(0, 255); // Limit length
}

// Validate URL to prevent potential security issues
function validateURL(url) {
  try {
    const parsedUrl = new URL(url);
    // Only allow http and https protocols
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return false;
    }
    return true;
  } catch (e) {
    return false;
  }
}

// Add a cleanup method when the app is closed or tab is changed
window.addEventListener('beforeunload', cleanupMemory);

// Refactor repeated event listener setup logic into a utility function
function addEventListenerToElement(element, event, handler) {
  if (element) {
    element.addEventListener(event, handler);
  }
}

// Use the utility function for setting up event listeners
addEventListenerToElement(document.getElementById('penBtn'), 'click', () => setTool('pen'));
addEventListenerToElement(document.getElementById('eraserBtn'), 'click', () => setTool('eraser'));
addEventListenerToElement(document.getElementById('undoBtn'), 'click', undo);
addEventListenerToElement(document.getElementById('redoBtn'), 'click', redo);
addEventListenerToElement(document.getElementById('clearBtn'), 'click', clearCanvas);
addEventListenerToElement(document.getElementById('exportBtn'), 'click', exportCanvas);
addEventListenerToElement(document.getElementById('contrastBtn'), 'click', toggleHighContrastMode);

// Toggle high contrast mode
function toggleHighContrastMode() {
  highContrastMode = !highContrastMode;
  document.body.classList.toggle('high-contrast', highContrastMode);
  
  // Update button state
  const contrastBtn = document.getElementById('contrastBtn');
  if (contrastBtn) {
    contrastBtn.classList.toggle('active', highContrastMode);
    contrastBtn.title = highContrastMode ? 'Disable High Contrast Mode' : 'Enable High Contrast Mode';
    contrastBtn.setAttribute('aria-pressed', highContrastMode.toString());
  }
  
  // Store preference
  localStorage.setItem('thick-lines-high-contrast', highContrastMode.toString());
  
  showToast(`High contrast mode ${highContrastMode ? 'enabled' : 'disabled'}`, 'info');
}

// Initialize high contrast mode from saved preference
function initHighContrastMode() {
  const saved = localStorage.getItem('thick-lines-high-contrast');
  if (saved === 'true') {
    toggleHighContrastMode();
  }
}

// Performance monitoring functions
function updateFPS() {
  frameCount++;
  const now = performance.now();
  
  if (now - lastFpsTime >= 1000) {
    currentFps = Math.round((frameCount * 1000) / (now - lastFpsTime));
    frameCount = 0;
    lastFpsTime = now;
    
    if (fpsDisplay) {
      fpsDisplay.textContent = `FPS: ${currentFps}`;
    }
  }
}

// Create FPS display element
function createFPSDisplay() {
  fpsDisplay = document.createElement('div');
  fpsDisplay.style.position = 'fixed';
  fpsDisplay.style.top = '10px';
  fpsDisplay.style.left = '10px';
  fpsDisplay.style.backgroundColor = 'rgba(0,0,0,0.7)';
  fpsDisplay.style.color = 'white';
  fpsDisplay.style.padding = '5px 10px';
  fpsDisplay.style.borderRadius = '5px';
  fpsDisplay.style.fontSize = '12px';
  fpsDisplay.style.fontFamily = 'monospace';
  fpsDisplay.style.zIndex = '10000';
  fpsDisplay.style.display = 'none';
  fpsDisplay.textContent = 'FPS: 60';
  document.body.appendChild(fpsDisplay);
}

// Toggle FPS display
function toggleFPSDisplay() {
  if (!fpsDisplay) createFPSDisplay();
  
  const isVisible = fpsDisplay.style.display !== 'none';
  fpsDisplay.style.display = isVisible ? 'none' : 'block';
  
  showToast(`FPS display ${!isVisible ? 'enabled' : 'disabled'}`, 'info');
}

// Keyboard navigation functions
function enableKeyboardNavigation() {
  keyboardNavigationEnabled = true;
  
  // Initialize cursor position at center
  const rect = canvas.getBoundingClientRect();
  keyboardCursorX = rect.width / 2;
  keyboardCursorY = rect.height / 2;
  
  updateKeyboardCursor();
  showToast('Keyboard navigation enabled. Use arrow keys to move, Enter to draw', 'info');
}

function disableKeyboardNavigation() {
  keyboardNavigationEnabled = false;
  hideKeyboardCursor();
  showToast('Keyboard navigation disabled', 'info');
}

function toggleKeyboardNavigation() {
  if (keyboardNavigationEnabled) {
    disableKeyboardNavigation();
  } else {
    enableKeyboardNavigation();
  }
}

// Create and update keyboard cursor
function updateKeyboardCursor() {
  if (!keyboardNavigationEnabled) return;
  
  let cursor = document.getElementById('keyboard-cursor');
  if (!cursor) {
    cursor = document.createElement('div');
    cursor.id = 'keyboard-cursor';
    cursor.style.position = 'fixed';
    cursor.style.width = '20px';
    cursor.style.height = '20px';
    cursor.style.border = '2px solid #fff';
    cursor.style.borderRadius = '50%';
    cursor.style.pointerEvents = 'none';
    cursor.style.zIndex = '1000';
    cursor.style.backgroundColor = 'rgba(255,255,255,0.2)';
    cursor.style.transform = 'translate(-50%, -50%)';
    document.body.appendChild(cursor);
  }
  
  const rect = canvas.getBoundingClientRect();
  cursor.style.left = `${rect.left + keyboardCursorX}px`;
  cursor.style.top = `${rect.top + keyboardCursorY}px`;
}

function hideKeyboardCursor() {
  const cursor = document.getElementById('keyboard-cursor');
  if (cursor) {
    cursor.remove();
  }
}

// Handle keyboard navigation and additional shortcuts
function handleKeyboardNavigation(e) {
  if (!keyboardNavigationEnabled) return false;
  
  const step = 10; // pixels to move
  let moved = false;
  
  switch (e.key) {
    case 'ArrowUp':
      keyboardCursorY = Math.max(0, keyboardCursorY - step);
      moved = true;
      break;
    case 'ArrowDown':
      keyboardCursorY = Math.min(canvas.clientHeight, keyboardCursorY + step);
      moved = true;
      break;
    case 'ArrowLeft':
      keyboardCursorX = Math.max(0, keyboardCursorX - step);
      moved = true;
      break;
    case 'ArrowRight':
      keyboardCursorX = Math.min(canvas.clientWidth, keyboardCursorX + step);
      moved = true;
      break;
    case 'Enter':
      // Draw a dot at cursor position
      const rect = canvas.getBoundingClientRect();
      const syntheticEvent = {
        clientX: rect.left + keyboardCursorX,
        clientY: rect.top + keyboardCursorY,
        preventDefault: () => {}
      };
      
      startDrawing(syntheticEvent);
      setTimeout(() => stopDrawing(), 100); // Brief draw
      return true;
    case '5': // Number pad 5 or regular 5
      // Center position
      keyboardCursorX = canvas.clientWidth / 2;
      keyboardCursorY = canvas.clientHeight / 2;
      moved = true;
      break;
  }
  
  if (moved) {
    updateKeyboardCursor();
    return true;
  }
  
  return false;
}

// Switch to integer coordinates for performance
function normalizeCoordinates(x, y) {
  return {
    x: Math.round(x),
    y: Math.round(y)
  };
}

// Export functions for testing (only in Node.js environment)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    // Core functions
    init,
    debounce,
    throttle,
    createTooltip,
    resizeCanvas,
    getCoordinates,
    applyTransform,
    updateCursor,
    
    // Drawing functions
    startDrawing,
    stopDrawing,
    draw,
    drawDot,
    drawPenPath,
    drawEraserPath,
    
    // State management
    saveState,
    loadState,
    undo,
    redo,
    trimUndoRedoStacks,
    updateUndoRedoButtons,
    cleanupMemory,
    
    // UI functions
    setupColorButtons,
    setupToolButtons,
    setupHelpPanel,
    setupContextMenu,
    setTool,
    clearCanvas,
    exportCanvas,
    showToast,
    showContextMenu,
    hideContextMenu,
    toggleHelpPanel,
    closeHelpPanel,
    showSizeVisualizer,
    hideSizeVisualizer,
    updateToolButtonsText,
    setActivePenSizeOption,
    setActiveEraserSizeOption,
    
    // Input handling
    handleMouseDown,
    handleMouseUp,
    handleMouseMove,
    handleMouseOut,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleKeyDown,
    handleKeyUp,
    handleWheel,
    handleDocumentClick,
    handleEscapeKey,
    handleContextMenu,
    handleVisibilityChange,
    
    // Pan and zoom
    startCanvasPan,
    moveCanvasPan,
    stopCanvasPan,
    calcClickMoveThreshold,
    
    // Canvas operations
    renderFrame,
    copySelection,
    cutSelection,
    pasteSelection,
    
    // Event setup
    setupEventListeners,
    setupUI,
    setupUndoRedoButtons,
    
    // Mouse movement optimization
    optimizedMouseMove,
    
    // Global state variables for testing
    get canvas() { return canvas; },
    set canvas(value) { canvas = value; },
    get ctx() { return ctx; },
    set ctx(value) { ctx = value; },
    get isDrawing() { return isDrawing; },
    set isDrawing(value) { isDrawing = value; },
    get isPanning() { return isPanning; },
    set isPanning(value) { isPanning = value; },
    get isMiddleMouseDown() { return isMiddleMouseDown; },
    set isMiddleMouseDown(value) { isMiddleMouseDown = value; },
    get currentColor() { return currentColor; },
    set currentColor(value) { currentColor = value; },
    get currentTool() { return currentTool; },
    set currentTool(value) { currentTool = value; },
    get penSize() { return penSize; },
    set penSize(value) { penSize = value; },
    get eraserSize() { return eraserSize; },
    set eraserSize(value) { eraserSize = value; },
    get undoStack() { return undoStack; },
    set undoStack(value) { undoStack = value; },
    get redoStack() { return redoStack; },
    set redoStack(value) { redoStack = value; },
    get zoomLevel() { return zoomLevel; },
    set zoomLevel(value) { zoomLevel = value; },
    get panOffsetX() { return panOffsetX; },
    set panOffsetX(value) { panOffsetX = value; },
    get panOffsetY() { return panOffsetY; },
    set panOffsetY(value) { panOffsetY = value; },
    get lastMouseX() { return lastMouseX; },
    set lastMouseX(value) { lastMouseX = value; },
    get lastMouseY() { return lastMouseY; },
    set lastMouseY(value) { lastMouseY = value; },
    get currentPath() { return currentPath; },
    set currentPath(value) { currentPath = value; },
    get drawingPaths() { return drawingPaths; },
    set drawingPaths(value) { drawingPaths = value; },
    get appInitialized() { return appInitialized; },
    set appInitialized(value) { appInitialized = value; },
    get showRulers() { return showRulers; },
    set showRulers(value) { showRulers = value; },
    get sizeVisualizer() { return sizeVisualizer; },
    set sizeVisualizer(value) { sizeVisualizer = value; },
    get contextMenu() { return contextMenu; },
    set contextMenu(value) { contextMenu = value; },
    get copiedRegion() { return copiedRegion; },
    set copiedRegion(value) { copiedRegion = value; },
    get middleMouseStartX() { return middleMouseStartX; },
    set middleMouseStartX(value) { middleMouseStartX = value; },
    get middleMouseStartY() { return middleMouseStartY; },
    set middleMouseStartY(value) { middleMouseStartY = value; },
    get lastPanPoint() { return lastPanPoint; },
    set lastPanPoint(value) { lastPanPoint = value; },
    get domElements() { return domElements; },
    set domElements(value) { domElements = value; }
  };
}


