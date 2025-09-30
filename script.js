/**
 * Thick Lines - Drawing Tool JavaScript
 * A comprehensive drawing application with accessibility features
 */

class ThickLines {
    constructor() {
        // Canvas and context
        this.canvas = null;
        this.ctx = null;
        
        // Drawing state
        this.isDrawing = false;
        this.currentTool = 'pen';
        this.currentColor = '#ff4444';
        this.brushSize = 5;
        this.eraserSize = 50;
        
        // Color palette
        this.colors = {
            red: '#ff4444',
            green: '#44ff44',
            blue: '#4444ff',
            yellow: '#ffff44'
        };
        
        // UI state
        this.isDarkTheme = false;
        this.isHighContrast = false;
        
        // Undo/Redo system
        this.undoStack = [];
        this.redoStack = [];
        this.maxUndoSteps = 50;
        
        // Touch/mouse tracking
        this.lastX = 0;
        this.lastY = 0;
        
        // Mobile detection and touch state
        this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        this.isZooming = false;
        this.initialDistance = 0;
        this.currentScale = 1;
        this.maxScale = 3;
        this.minScale = 0.5;
        
        // Initialize the application
        this.init();
    }
    
    init() {
        this.setupCanvas();
        this.setupEventListeners();
        this.setupKeyboardShortcuts();
        this.loadPreferences();
        this.saveState(); // Save initial blank state
        this.updateStatus();
        this.updateCanvasInfo();
        this.announceToScreenReader('Thick Lines drawing tool initialized. Press ? for help.');
    }
    
    setupCanvas() {
        this.canvas = document.getElementById('drawing-canvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Set initial canvas state
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.imageSmoothingEnabled = true;
        
        // Handle high DPI displays
        this.setupHighDPI();
    }
    
    setupHighDPI() {
        const rect = this.canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        
        // Set actual size in memory based on device pixel ratio
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        
        // Scale the canvas back down using CSS
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
        
        // Scale the drawing context to match device pixel ratio
        this.ctx.scale(dpr, dpr);
    }
    
    setupEventListeners() {
        // Tool selection
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.selectTool(e.target.closest('.tool-btn').dataset.tool));
        });
        
        // Color selection
        document.querySelectorAll('.color-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.selectColor(e.target.closest('.color-btn').dataset.color));
        });
        
        // Brush size
        const brushSize = document.getElementById('brushSize');
        brushSize.addEventListener('input', (e) => {
            this.brushSize = parseInt(e.target.value);
            document.getElementById('sizeDisplay').textContent = `${this.brushSize}px`;
            this.updateStatus();
        });
        
        // Eraser size
        const eraserSize = document.getElementById('eraserSize');
        eraserSize.addEventListener('input', (e) => {
            this.eraserSize = parseInt(e.target.value);
            document.getElementById('eraserSizeDisplay').textContent = `${this.eraserSize}px`;
            this.updateStatus();
        });
        
        // Action buttons
        document.getElementById('undoBtn').addEventListener('click', () => this.undo());
        document.getElementById('redoBtn').addEventListener('click', () => this.redo());
        document.getElementById('clearBtn').addEventListener('click', () => this.showClearConfirmation());
        document.getElementById('exportBtn').addEventListener('click', () => this.exportImage());
        document.getElementById('contrastBtn').addEventListener('click', () => this.toggleContrast());
        document.getElementById('themeToggle').addEventListener('click', () => this.toggleTheme());
        document.getElementById('helpBtn').addEventListener('click', () => this.showHelp());
        document.getElementById('canvasSettingsBtn').addEventListener('click', () => this.showCanvasSettings());
        
        // Clear modal
        document.getElementById('clearCancel').addEventListener('click', () => this.hideClearConfirmation());
        document.getElementById('clearConfirm').addEventListener('click', () => this.clearCanvas());
        
        // Export modal
        document.getElementById('exportCancel').addEventListener('click', () => this.hideExportModal());
        document.getElementById('exportConfirm').addEventListener('click', () => this.performExport());
        
        // Quality slider
        const qualitySlider = document.getElementById('qualitySlider');
        qualitySlider.addEventListener('input', (e) => {
            document.getElementById('qualityValue').textContent = `${e.target.value}%`;
        });
        
        // Canvas settings modal
        document.getElementById('canvasCancel').addEventListener('click', () => this.hideCanvasSettings());
        document.getElementById('canvasApply').addEventListener('click', () => this.applyCanvasSettings());
        
        // Canvas size options
        document.querySelectorAll('input[name="canvasSize"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                const customInputs = document.getElementById('customSizeInputs');
                if (e.target.value === 'custom') {
                    customInputs.style.display = 'block';
                } else {
                    customInputs.style.display = 'none';
                }
            });
        });
        
        // Help modal
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', (e) => this.hideModal(e.target.closest('.modal')));
        });
        
        // Modal overlay clicks
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => this.hideModal(e.target.closest('.modal')));
        });
        
        // Canvas drawing events
        this.setupDrawingEvents();
        
        // Window resize
        window.addEventListener('resize', () => this.handleResize());
    }
    
    setupDrawingEvents() {
        // Mouse events
        this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
        this.canvas.addEventListener('mousemove', (e) => this.draw(e));
        this.canvas.addEventListener('mouseup', () => this.stopDrawing());
        this.canvas.addEventListener('mouseout', () => this.stopDrawing());
        
        // Touch events for mobile
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.handleTouchStart(e);
        });
        
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            this.handleTouchMove(e);
        });
        
        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.handleTouchEnd(e);
        });
        
        // Prevent scrolling on touch devices
        document.body.addEventListener('touchstart', (e) => {
            if (e.target === this.canvas) {
                e.preventDefault();
            }
        }, { passive: false });
        
        document.body.addEventListener('touchend', (e) => {
            if (e.target === this.canvas) {
                e.preventDefault();
            }
        }, { passive: false });
        
        document.body.addEventListener('touchmove', (e) => {
            if (e.target === this.canvas) {
                e.preventDefault();
            }
        }, { passive: false });
    }
    
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Skip if typing in an input
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }
            
            // Color shortcuts
            if (e.key >= '1' && e.key <= '4') {
                e.preventDefault();
                const colors = ['red', 'green', 'blue', 'yellow'];
                this.selectColor(colors[parseInt(e.key) - 1]);
                return;
            }
            
            // Handle modifier key combinations
            if (e.ctrlKey || e.metaKey) {
                switch (e.key.toLowerCase()) {
                    case 'z':
                        e.preventDefault();
                        this.undo();
                        break;
                    case 'y':
                        e.preventDefault();
                        this.redo();
                        break;
                    case 's':
                        e.preventDefault();
                        this.exportImage();
                        break;
                }
                return;
            }
            
            // Other shortcuts
            switch (e.key.toLowerCase()) {
                case 'p':
                    e.preventDefault();
                    this.selectTool('pen');
                    break;
                case 'e':
                    e.preventDefault();
                    this.selectTool('eraser');
                    break;
                case 'u':
                    e.preventDefault();
                    this.undo();
                    break;
                case 'r':
                    e.preventDefault();
                    this.redo();
                    break;
                case 't':
                    e.preventDefault();
                    this.toggleTheme();
                    break;
                case 'c':
                    e.preventDefault();
                    this.toggleContrast();
                    break;
                case '0':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        this.resetZoom();
                    }
                    break;
                case '?':
                case '/':
                    if (e.shiftKey) {
                        e.preventDefault();
                        this.showHelp();
                    }
                    break;
                case 'escape':
                    e.preventDefault();
                    this.hideAllModals();
                    break;
                case 'delete':
                    if (e.shiftKey) {
                        e.preventDefault();
                        this.showClearConfirmation();
                    }
                    break;
            }
        });
    }
    
    selectTool(tool) {
        this.currentTool = tool;
        
        // Update UI
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.classList.remove('active');
            btn.setAttribute('aria-pressed', 'false');
        });
        
        const selectedBtn = document.querySelector(`[data-tool="${tool}"]`);
        selectedBtn.classList.add('active');
        selectedBtn.setAttribute('aria-pressed', 'true');
        
        // Update cursor
        this.updateCanvasCursor();
        this.updateStatus();
        this.announceToScreenReader(`${tool} tool selected`);
    }
    
    selectColor(colorName) {
        this.currentColor = this.colors[colorName];
        
        // Update UI
        document.querySelectorAll('.color-btn').forEach(btn => {
            btn.classList.remove('active');
            btn.setAttribute('aria-pressed', 'false');
        });
        
        const selectedBtn = document.querySelector(`[data-color="${colorName}"]`);
        selectedBtn.classList.add('active');
        selectedBtn.setAttribute('aria-pressed', 'true');
        
        this.updateStatus();
        this.announceToScreenReader(`${colorName} color selected`);
    }
    
    updateCanvasCursor() {
        if (this.currentTool === 'pen') {
            this.canvas.style.cursor = 'crosshair';
        } else if (this.currentTool === 'eraser') {
            this.canvas.style.cursor = 'grab';
        }
    }
    
    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }
    
    getTouchPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.touches[0].clientX - rect.left,
            y: e.touches[0].clientY - rect.top
        };
    }
    
    handleTouchStart(e) {
        if (e.touches.length === 1) {
            // Single touch - drawing
            this.startDrawing(this.getTouchPos(e));
        } else if (e.touches.length === 2) {
            // Two finger touch - start zoom
            this.isZooming = true;
            this.initialDistance = this.getTouchDistance(e.touches);
            
            if (this.isDrawing) {
                this.stopDrawing();
            }
        }
    }
    
    handleTouchMove(e) {
        if (e.touches.length === 1 && !this.isZooming) {
            // Single touch - drawing
            this.draw(this.getTouchPos(e));
        } else if (e.touches.length === 2 && this.isZooming) {
            // Two finger touch - zoom
            const currentDistance = this.getTouchDistance(e.touches);
            const scaleChange = currentDistance / this.initialDistance;
            
            let newScale = this.currentScale * scaleChange;
            newScale = Math.max(this.minScale, Math.min(this.maxScale, newScale));
            
            if (newScale !== this.currentScale) {
                this.applyZoom(newScale);
                this.currentScale = newScale;
            }
            
            this.initialDistance = currentDistance;
        }
    }
    
    handleTouchEnd(e) {
        if (e.touches.length === 0) {
            // No more touches
            if (this.isZooming) {
                this.isZooming = false;
            } else {
                this.stopDrawing();
            }
        } else if (e.touches.length === 1 && this.isZooming) {
            // One touch remaining after zoom
            this.isZooming = false;
        }
    }
    
    getTouchDistance(touches) {
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    applyZoom(scale) {
        const canvasContainer = this.canvas.parentElement;
        canvasContainer.style.transform = `scale(${scale})`;
        canvasContainer.style.transformOrigin = 'center center';
        
        // Announce zoom level to screen reader
        if (this.isMobile) {
            this.announceToScreenReader(`Zoom ${Math.round(scale * 100)}%`);
        }
    }
    
    resetZoom() {
        this.currentScale = 1;
        this.applyZoom(1);
        this.showToast('Zoom reset to 100%', 'info');
    }
    
    startDrawing(e) {
        this.isDrawing = true;
        const pos = e.x !== undefined ? e : this.getMousePos(e);
        this.lastX = pos.x;
        this.lastY = pos.y;
        
        // Set drawing properties
        if (this.currentTool === 'pen') {
            this.ctx.globalCompositeOperation = 'source-over';
            this.ctx.strokeStyle = this.currentColor;
            this.ctx.lineWidth = this.brushSize;
        } else if (this.currentTool === 'eraser') {
            this.ctx.globalCompositeOperation = 'destination-out';
            this.ctx.lineWidth = this.eraserSize;
        }
        
        // Start path
        this.ctx.beginPath();
        this.ctx.moveTo(this.lastX, this.lastY);
    }
    
    draw(e) {
        if (!this.isDrawing) return;
        
        const pos = e.x !== undefined ? e : this.getMousePos(e);
        
        // Draw line to current position
        this.ctx.lineTo(pos.x, pos.y);
        this.ctx.stroke();
        
        // Update last position
        this.lastX = pos.x;
        this.lastY = pos.y;
    }
    
    stopDrawing() {
        if (!this.isDrawing) return;
        
        this.isDrawing = false;
        this.ctx.beginPath();
        
        // Save state for undo/redo
        this.saveState();
        this.updateUndoRedoButtons();
    }
    
    saveState() {
        // Remove any redo states when new action is performed
        this.redoStack = [];
        
        // Add current state to undo stack
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        this.undoStack.push(imageData);
        
        // Limit undo stack size
        if (this.undoStack.length > this.maxUndoSteps) {
            this.undoStack.shift();
        }
        
        this.updateUndoRedoButtons();
    }
    
    undo() {
        if (this.undoStack.length <= 1) return; // Keep at least one state
        
        // Move current state to redo stack
        const currentState = this.undoStack.pop();
        this.redoStack.push(currentState);
        
        // Restore previous state
        const previousState = this.undoStack[this.undoStack.length - 1];
        this.ctx.putImageData(previousState, 0, 0);
        
        this.updateUndoRedoButtons();
        this.announceToScreenReader('Undo performed');
    }
    
    redo() {
        if (this.redoStack.length === 0) return;
        
        // Move state from redo to undo stack
        const redoState = this.redoStack.pop();
        this.undoStack.push(redoState);
        
        // Restore state
        this.ctx.putImageData(redoState, 0, 0);
        
        this.updateUndoRedoButtons();
        this.announceToScreenReader('Redo performed');
    }
    
    updateUndoRedoButtons() {
        const undoBtn = document.getElementById('undoBtn');
        const redoBtn = document.getElementById('redoBtn');
        
        const canUndo = this.undoStack.length > 1;
        const canRedo = this.redoStack.length > 0;
        
        undoBtn.disabled = !canUndo;
        redoBtn.disabled = !canRedo;
        
        // Update tooltips with status
        undoBtn.title = canUndo ? `Undo (Ctrl+Z) - ${this.undoStack.length - 1} steps available` : 'Nothing to undo';
        redoBtn.title = canRedo ? `Redo (Ctrl+Y) - ${this.redoStack.length} steps available` : 'Nothing to redo';
    }
    
    updateCanvasInfo() {
        const canvasInfo = document.getElementById('canvasSize');
        if (canvasInfo) {
            canvasInfo.textContent = `${this.canvas.width}×${this.canvas.height}`;
        }
    }
    
    showClearConfirmation() {
        this.showModal(document.getElementById('clearModal'));
    }
    
    hideClearConfirmation() {
        this.hideModal(document.getElementById('clearModal'));
    }
    
    clearCanvas() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.saveState();
        this.hideClearConfirmation();
        this.announceToScreenReader('Canvas cleared');
        this.showToast('Canvas cleared', 'info');
    }
    
    exportImage() {
        this.showExportModal();
    }
    
    showExportModal() {
        this.showModal(document.getElementById('exportModal'));
    }
    
    hideExportModal() {
        this.hideModal(document.getElementById('exportModal'));
    }
    
    performExport() {
        try {
            const format = document.querySelector('input[name="exportFormat"]:checked').value;
            const size = document.querySelector('input[name="exportSize"]:checked').value;
            const quality = parseInt(document.getElementById('qualitySlider').value) / 100;
            
            // Get dimensions based on size selection
            let width, height;
            const aspectRatio = this.canvas.width / this.canvas.height;
            
            switch (size) {
                case 'hd':
                    width = 1920;
                    height = Math.round(1920 / aspectRatio);
                    break;
                case '4k':
                    width = 3840;
                    height = Math.round(3840 / aspectRatio);
                    break;
                default: // original
                    width = this.canvas.width;
                    height = this.canvas.height;
            }
            
            // Create export canvas
            const exportCanvas = document.createElement('canvas');
            const exportCtx = exportCanvas.getContext('2d');
            
            exportCanvas.width = width;
            exportCanvas.height = height;
            
            // Set high quality rendering
            exportCtx.imageSmoothingEnabled = true;
            exportCtx.imageSmoothingQuality = 'high';
            
            // Fill background (white for JPEG, transparent for PNG)
            if (format === 'jpeg') {
                exportCtx.fillStyle = '#ffffff';
                exportCtx.fillRect(0, 0, width, height);
            }
            
            // Scale and draw the current canvas content
            exportCtx.drawImage(this.canvas, 0, 0, width, height);
            
            // Determine MIME type and file extension
            const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
            const extension = format === 'jpeg' ? 'jpg' : 'png';
            
            // Create download link
            exportCanvas.toBlob((blob) => {
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `drawing-${Date.now()}.${extension}`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
                
                this.hideExportModal();
                this.showToast(`Image exported successfully as ${format.toUpperCase()}`, 'success');
                this.announceToScreenReader(`Image exported as ${format.toUpperCase()} file`);
            }, mimeType, format === 'jpeg' ? quality : 1.0);
            
        } catch (error) {
            console.error('Export failed:', error);
            this.showToast('Export failed. Please try again.', 'error');
        }
    }
    
    toggleTheme() {
        this.isDarkTheme = !this.isDarkTheme;
        document.body.setAttribute('data-theme', this.isDarkTheme ? 'dark' : 'light');
        this.savePreferences();
        this.announceToScreenReader(`Switched to ${this.isDarkTheme ? 'dark' : 'light'} theme`);
    }
    
    toggleContrast() {
        this.isHighContrast = !this.isHighContrast;
        document.body.setAttribute('data-contrast', this.isHighContrast ? 'high' : 'normal');
        
        const contrastBtn = document.getElementById('contrastBtn');
        contrastBtn.setAttribute('aria-pressed', this.isHighContrast.toString());
        
        this.savePreferences();
        this.announceToScreenReader(`High contrast mode ${this.isHighContrast ? 'enabled' : 'disabled'}`);
    }
    
    showHelp() {
        this.showModal(document.getElementById('helpModal'));
    }
    
    showCanvasSettings() {
        this.showModal(document.getElementById('canvasModal'));
    }
    
    hideCanvasSettings() {
        this.hideModal(document.getElementById('canvasModal'));
    }
    
    applyCanvasSettings() {
        try {
            const selectedSize = document.querySelector('input[name="canvasSize"]:checked').value;
            let newWidth, newHeight;
            
            switch (selectedSize) {
                case 'small':
                    newWidth = 800;
                    newHeight = 600;
                    break;
                case 'medium':
                    newWidth = 1200;
                    newHeight = 800;
                    break;
                case 'large':
                    newWidth = 1600;
                    newHeight = 1200;
                    break;
                case 'hd':
                    newWidth = 1920;
                    newHeight = 1080;
                    break;
                case 'square':
                    newWidth = 1000;
                    newHeight = 1000;
                    break;
                case 'custom':
                    newWidth = parseInt(document.getElementById('customWidth').value);
                    newHeight = parseInt(document.getElementById('customHeight').value);
                    
                    if (newWidth < 100 || newWidth > 4000 || newHeight < 100 || newHeight > 4000) {
                        this.showToast('Canvas dimensions must be between 100 and 4000 pixels', 'error');
                        return;
                    }
                    break;
                default:
                    return;
            }
            
            // Update canvas dimensions
            this.canvas.width = newWidth;
            this.canvas.height = newHeight;
            this.canvas.style.width = newWidth + 'px';
            this.canvas.style.height = newHeight + 'px';
            
            // Clear the canvas
            this.ctx.clearRect(0, 0, newWidth, newHeight);
            
            // Reset drawing properties
            this.ctx.lineCap = 'round';
            this.ctx.lineJoin = 'round';
            this.ctx.imageSmoothingEnabled = true;
            
            // Update undo/redo system
            this.undoStack = [];
            this.redoStack = [];
            this.saveState();
            this.updateUndoRedoButtons();
            
            // Update UI
            this.updateCanvasInfo();
            this.hideCanvasSettings();
            this.showToast(`Canvas resized to ${newWidth}×${newHeight}`, 'success');
            this.announceToScreenReader(`Canvas resized to ${newWidth} by ${newHeight} pixels`);
            
        } catch (error) {
            console.error('Canvas resize failed:', error);
            this.showToast('Failed to resize canvas. Please try again.', 'error');
        }
    }
    
    showModal(modal) {
        modal.setAttribute('aria-hidden', 'false');
        modal.style.display = 'flex';
        
        // Focus the first focusable element
        const focusable = modal.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (focusable) {
            focusable.focus();
        }
        
        // Trap focus within modal
        this.trapFocus(modal);
    }
    
    hideModal(modal) {
        modal.setAttribute('aria-hidden', 'true');
        modal.style.display = 'none';
        
        // Return focus to canvas or appropriate element
        this.canvas.focus();
    }
    
    hideAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            this.hideModal(modal);
        });
    }
    
    trapFocus(modal) {
        const focusableElements = modal.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstFocusable = focusableElements[0];
        const lastFocusable = focusableElements[focusableElements.length - 1];
        
        const handleTabKey = (e) => {
            if (e.key === 'Tab') {
                if (e.shiftKey) {
                    if (document.activeElement === firstFocusable) {
                        lastFocusable.focus();
                        e.preventDefault();
                    }
                } else {
                    if (document.activeElement === lastFocusable) {
                        firstFocusable.focus();
                        e.preventDefault();
                    }
                }
            }
        };
        
        modal.addEventListener('keydown', handleTabKey);
        
        // Remove event listener when modal is closed
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'aria-hidden') {
                    if (modal.getAttribute('aria-hidden') === 'true') {
                        modal.removeEventListener('keydown', handleTabKey);
                        observer.disconnect();
                    }
                }
            });
        });
        
        observer.observe(modal, { attributes: true });
    }
    
    showToast(message, type = 'info', duration = 3000) {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'polite');
        
        container.appendChild(toast);
        
        // Animate in
        setTimeout(() => toast.classList.add('show'), 100);
        
        // Auto remove
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                if (toast.parentNode) {
                    container.removeChild(toast);
                }
            }, 300);
        }, duration);
    }
    
    updateStatus() {
        const currentTool = document.getElementById('currentTool');
        const currentColor = document.getElementById('currentColor');
        const currentSize = document.getElementById('currentSize');
        
        currentTool.textContent = `${this.currentTool.charAt(0).toUpperCase() + this.currentTool.slice(1)} tool selected`;
        
        const colorName = Object.keys(this.colors).find(key => this.colors[key] === this.currentColor);
        currentColor.textContent = `${colorName.charAt(0).toUpperCase() + colorName.slice(1)} color`;
        
        const size = this.currentTool === 'pen' ? this.brushSize : this.eraserSize;
        currentSize.textContent = `${size}px ${this.currentTool === 'pen' ? 'brush' : 'eraser'}`;
    }
    
    announceToScreenReader(message) {
        const announcer = document.getElementById('sr-announcements');
        announcer.textContent = '';
        setTimeout(() => {
            announcer.textContent = message;
        }, 100);
    }
    
    handleResize() {
        // Save current drawing
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        
        // Update canvas size
        this.setupHighDPI();
        
        // Restore drawing
        this.ctx.putImageData(imageData, 0, 0);
    }
    
    savePreferences() {
        const preferences = {
            isDarkTheme: this.isDarkTheme,
            isHighContrast: this.isHighContrast,
            brushSize: this.brushSize,
            eraserSize: this.eraserSize,
            currentColor: this.currentColor,
            currentTool: this.currentTool
        };
        
        localStorage.setItem('thickLinesPreferences', JSON.stringify(preferences));
    }
    
    loadPreferences() {
        try {
            const saved = localStorage.getItem('thickLinesPreferences');
            if (saved) {
                const preferences = JSON.parse(saved);
                
                // Apply theme
                if (preferences.isDarkTheme) {
                    this.isDarkTheme = true;
                    document.body.setAttribute('data-theme', 'dark');
                }
                
                // Apply contrast
                if (preferences.isHighContrast) {
                    this.isHighContrast = true;
                    document.body.setAttribute('data-contrast', 'high');
                    document.getElementById('contrastBtn').setAttribute('aria-pressed', 'true');
                }
                
                // Apply tool settings
                if (preferences.brushSize) {
                    this.brushSize = preferences.brushSize;
                    document.getElementById('brushSize').value = this.brushSize;
                    document.getElementById('sizeDisplay').textContent = `${this.brushSize}px`;
                }
                
                if (preferences.eraserSize) {
                    this.eraserSize = preferences.eraserSize;
                    document.getElementById('eraserSize').value = this.eraserSize;
                    document.getElementById('eraserSizeDisplay').textContent = `${this.eraserSize}px`;
                }
                
                if (preferences.currentColor) {
                    const colorName = Object.keys(this.colors).find(key => this.colors[key] === preferences.currentColor);
                    if (colorName) {
                        this.selectColor(colorName);
                    }
                }
                
                if (preferences.currentTool) {
                    this.selectTool(preferences.currentTool);
                }
            }
        } catch (error) {
            console.error('Failed to load preferences:', error);
        }
    }
}

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.thickLines = new ThickLines();
});

// Handle visibility change to save state
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && window.thickLines) {
        window.thickLines.savePreferences();
    }
});

// Handle beforeunload to save state
window.addEventListener('beforeunload', () => {
    if (window.thickLines) {
        window.thickLines.savePreferences();
    }
});

// Export for potential external use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ThickLines;
}