/**
 * UI Components and interactions for DeepShield
 */

class UIManager {
    constructor() {
        this.toasts = [];
        this.modals = new Map();
        this.init();
    }

    /**
     * Initialize UI components
     */
    init() {
        this.setupToastContainer();
        this.setupModalHandlers();
        this.setupGlobalEventListeners();
        this.setupLoadingStates();
    }

    /**
     * Setup toast notification container
     */
    setupToastContainer() {
        if (!document.getElementById('toast-container')) {
            const container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }
    }

    /**
     * Show toast notification
     */
    showToast(message, type = 'info', duration = CONFIG.TOAST_DURATION) {
        const toast = document.createElement('div');
        const toastId = Utils.generateId();
        
        toast.id = toastId;
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                <i class="toast-icon fas fa-${this.getToastIcon(type)}"></i>
                <span class="toast-message">${Utils.sanitizeHTML(message)}</span>
                <button class="toast-close" onclick="ui.hideToast('${toastId}')">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        const container = document.getElementById('toast-container');
        container.appendChild(toast);

        // Animate in
        setTimeout(() => toast.classList.add('toast-show'), 100);

        // Auto hide
        if (duration > 0) {
            setTimeout(() => this.hideToast(toastId), duration);
        }

        this.toasts.push({ id: toastId, element: toast });
        return toastId;
    }

    /**
     * Hide toast notification
     */
    hideToast(toastId) {
        const toast = document.getElementById(toastId);
        if (toast) {
            toast.classList.add('toast-hide');
            setTimeout(() => {
                toast.remove();
                this.toasts = this.toasts.filter(t => t.id !== toastId);
            }, CONFIG.ANIMATION_DURATION);
        }
    }

    /**
     * Get icon for toast type
     */
    getToastIcon(type) {
        const icons = {
            success: 'check-circle',
            error: 'exclamation-circle',
            warning: 'exclamation-triangle',
            info: 'info-circle'
        };
        return icons[type] || 'info-circle';
    }

    /**
     * Show loading state
     */
    showLoading(element, text = 'Loading...') {
        if (typeof element === 'string') {
            element = document.getElementById(element);
        }
        
        if (!element) return;

        const loadingOverlay = document.createElement('div');
        loadingOverlay.className = 'loading-overlay';
        loadingOverlay.innerHTML = `
            <div class="loading-spinner">
                <i class="fas fa-spinner fa-spin"></i>
                <span class="loading-text">${Utils.sanitizeHTML(text)}</span>
            </div>
        `;

        element.style.position = 'relative';
        element.appendChild(loadingOverlay);
        
        setTimeout(() => loadingOverlay.classList.add('loading-show'), 10);
    }

    /**
     * Hide loading state
     */
    hideLoading(element) {
        if (typeof element === 'string') {
            element = document.getElementById(element);
        }
        
        if (!element) return;

        const loadingOverlay = element.querySelector('.loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.classList.add('loading-hide');
            setTimeout(() => loadingOverlay.remove(), CONFIG.ANIMATION_DURATION);
        }
    }

    /**
     * Show modal
     */
    showModal(modalId, data = {}) {
        const modal = document.getElementById(modalId);
        if (!modal) return;

        // Populate modal with data if provided
        if (data && Object.keys(data).length > 0) {
            this.populateModal(modal, data);
        }

        modal.style.display = 'flex';
        document.body.classList.add('modal-open');
        
        setTimeout(() => modal.classList.add('modal-show'), 10);
        
        this.modals.set(modalId, { element: modal, data });
    }

    /**
     * Hide modal
     */
    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;

        modal.classList.add('modal-hide');
        
        setTimeout(() => {
            modal.style.display = 'none';
            modal.classList.remove('modal-show', 'modal-hide');
            document.body.classList.remove('modal-open');
        }, CONFIG.ANIMATION_DURATION);

        this.modals.delete(modalId);
    }

    /**
     * Populate modal with data
     */
    populateModal(modal, data) {
        Object.keys(data).forEach(key => {
            const element = modal.querySelector(`[data-field="${key}"]`);
            if (element) {
                if (element.tagName === 'IMG') {
                    element.src = data[key];
                } else if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                    element.value = data[key];
                } else {
                    element.textContent = data[key];
                }
            }
        });
    }

    /**
     * Setup modal event handlers
     */
    setupModalHandlers() {
        document.addEventListener('click', (e) => {
            // Close modal when clicking backdrop
            if (e.target.classList.contains('modal')) {
                const modalId = e.target.id;
                this.hideModal(modalId);
            }
            
            // Close modal when clicking close button
            if (e.target.classList.contains('modal-close') || e.target.closest('.modal-close')) {
                const modal = e.target.closest('.modal');
                if (modal) {
                    this.hideModal(modal.id);
                }
            }
        });

        // Close modal with Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modals.size > 0) {
                const lastModal = Array.from(this.modals.keys()).pop();
                this.hideModal(lastModal);
            }
        });
    }

    /**
     * Setup global event listeners
     */
    setupGlobalEventListeners() {
        // Handle form submissions
        document.addEventListener('submit', (e) => {
            const form = e.target;
            if (form.classList.contains('ajax-form')) {
                e.preventDefault();
                this.handleAjaxForm(form);
            }
        });

        // Handle file inputs
        document.addEventListener('change', (e) => {
            if (e.target.type === 'file') {
                this.handleFileInput(e.target);
            }
        });

        // Handle responsive navigation
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('hamburger') || e.target.closest('.hamburger')) {
                this.toggleMobileNav();
            }
        });
    }

    /**
     * Handle AJAX form submissions
     */
    async handleAjaxForm(form) {
        const submitButton = form.querySelector('button[type="submit"]');
        const originalText = submitButton.innerHTML;
        
        try {
            // Show loading state
            submitButton.disabled = true;
            submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
            
            const formData = new FormData(form);
            const action = form.action || form.dataset.action;
            const method = form.method || 'POST';
            
            let response;
            if (method.toLowerCase() === 'post') {
                response = await api.postForm(action, formData);
            } else {
                response = await api.request(action, { method, body: formData });
            }
            
            // Handle success
            this.showToast(response.message || 'Success!', 'success');
            
            // Trigger custom event
            form.dispatchEvent(new CustomEvent('form-success', { detail: response }));
            
        } catch (error) {
            console.error('Form submission error:', error);
            this.showToast(error.message || CONFIG.ERRORS.GENERIC, 'error');
            
            // Trigger custom event
            form.dispatchEvent(new CustomEvent('form-error', { detail: error }));
        } finally {
            // Restore button state
            submitButton.disabled = false;
            submitButton.innerHTML = originalText;
        }
    }

    /**
     * Handle file input changes
     */
    handleFileInput(input) {
        const file = input.files[0];
        if (!file) return;

        // Validate file
        if (!Utils.isValidFileType(file)) {
            this.showToast(CONFIG.ERRORS.INVALID_FILE_TYPE, 'error');
            input.value = '';
            return;
        }

        if (!Utils.isValidFileSize(file)) {
            this.showToast(CONFIG.ERRORS.FILE_TOO_LARGE, 'error');
            input.value = '';
            return;
        }

        // Update file info display
        this.updateFileDisplay(input, file);
    }

    /**
     * Update file display information
     */
    updateFileDisplay(input, file) {
        const container = input.closest('.upload-area') || input.closest('.file-input-container');
        if (!container) return;

        const fileInfo = container.querySelector('.file-info') || this.createFileInfoElement();
        
        fileInfo.innerHTML = `
            <div class="file-details">
                <i class="fas fa-${file.type.startsWith('image/') ? 'image' : 'video'}"></i>
                <div class="file-meta">
                    <div class="file-name">${Utils.sanitizeHTML(file.name)}</div>
                    <div class="file-size">${Utils.formatFileSize(file.size)}</div>
                </div>
                <button type="button" class="file-remove" onclick="this.closest('.upload-area').querySelector('input[type=file]').value=''; this.parentElement.parentElement.remove();">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        if (!container.contains(fileInfo)) {
            container.appendChild(fileInfo);
        }
    }

    /**
     * Create file info element
     */
    createFileInfoElement() {
        const element = document.createElement('div');
        element.className = 'file-info';
        return element;
    }

    /**
     * Toggle mobile navigation
     */
    toggleMobileNav() {
        const hamburger = document.querySelector('.hamburger');
        const navMenu = document.querySelector('.nav-menu');
        
        if (hamburger && navMenu) {
            hamburger.classList.toggle('active');
            navMenu.classList.toggle('active');
        }
    }

    /**
     * Setup loading states for buttons
     */
    setupLoadingStates() {
        document.addEventListener('click', (e) => {
            const button = e.target.closest('button[data-loading]');
            if (button && !button.disabled) {
                const loadingText = button.dataset.loading || 'Loading...';
                const originalText = button.innerHTML;
                
                button.disabled = true;
                button.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${loadingText}`;
                
                // Restore after 5 seconds if not manually restored
                setTimeout(() => {
                    if (button.disabled) {
                        button.disabled = false;
                        button.innerHTML = originalText;
                    }
                }, 5000);
            }
        });
    }

    /**
     * Create progress bar
     */
    createProgressBar(container, options = {}) {
        const progressBar = document.createElement('div');
        progressBar.className = 'progress-bar';
        progressBar.innerHTML = `
            <div class="progress-fill" style="width: 0%"></div>
            <div class="progress-text">${options.text || '0%'}</div>
        `;

        if (typeof container === 'string') {
            container = document.getElementById(container);
        }
        
        container.appendChild(progressBar);
        return progressBar;
    }

    /**
     * Update progress bar
     */
    updateProgressBar(progressBar, percentage, text = null) {
        const fill = progressBar.querySelector('.progress-fill');
        const textElement = progressBar.querySelector('.progress-text');
        
        fill.style.width = `${Math.min(100, Math.max(0, percentage))}%`;
        
        if (text) {
            textElement.textContent = text;
        } else {
            textElement.textContent = `${Math.round(percentage)}%`;
        }
    }

    /**
     * Animate number counting
     */
    animateNumber(element, start, end, duration = 1000) {
        const startTime = performance.now();
        const difference = end - start;

        const step = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            const current = start + (difference * this.easeOutQuart(progress));
            element.textContent = Math.round(current);
            
            if (progress < 1) {
                requestAnimationFrame(step);
            }
        };

        requestAnimationFrame(step);
    }

    /**
     * Easing function for animations
     */
    easeOutQuart(t) {
        return 1 - Math.pow(1 - t, 4);
    }

    /**
     * Create confirmation dialog
     */
    showConfirmDialog(message, onConfirm, onCancel = null) {
        const dialog = document.createElement('div');
        dialog.className = 'modal confirmation-modal';
        dialog.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Confirm Action</h3>
                </div>
                <div class="modal-body">
                    <p>${Utils.sanitizeHTML(message)}</p>
                </div>
                <div class="modal-actions">
                    <button class="modal-btn secondary cancel-btn">Cancel</button>
                    <button class="modal-btn primary confirm-btn">Confirm</button>
                </div>
            </div>
        `;

        document.body.appendChild(dialog);
        dialog.style.display = 'flex';
        document.body.classList.add('modal-open');

        const confirmBtn = dialog.querySelector('.confirm-btn');
        const cancelBtn = dialog.querySelector('.cancel-btn');

        const cleanup = () => {
            dialog.remove();
            document.body.classList.remove('modal-open');
        };

        confirmBtn.addEventListener('click', () => {
            cleanup();
            if (onConfirm) onConfirm();
        });

        cancelBtn.addEventListener('click', () => {
            cleanup();
            if (onCancel) onCancel();
        });

        // Close on backdrop click
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                cleanup();
                if (onCancel) onCancel();
            }
        });
    }
}

// Create global UI manager instance
const ui = new UIManager();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { UIManager, ui };
}