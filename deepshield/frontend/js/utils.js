/**
 * Utility functions for DeepShield Frontend
 */

class Utils {
    /**
     * Format file size in human readable format
     */
    static formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Format date in user-friendly format
     */
    static formatDate(dateString, options = {}) {
        const date = new Date(dateString);
        const defaultOptions = {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };
        return date.toLocaleDateString('en-US', { ...defaultOptions, ...options });
    }

    /**
     * Format relative time (e.g., "2 hours ago")
     */
    static formatRelativeTime(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);

        const intervals = [
            { label: 'year', seconds: 31536000 },
            { label: 'month', seconds: 2592000 },
            { label: 'day', seconds: 86400 },
            { label: 'hour', seconds: 3600 },
            { label: 'minute', seconds: 60 },
            { label: 'second', seconds: 1 }
        ];

        for (const interval of intervals) {
            const count = Math.floor(diffInSeconds / interval.seconds);
            if (count >= 1) {
                return `${count} ${interval.label}${count > 1 ? 's' : ''} ago`;
            }
        }

        return 'just now';
    }

    /**
     * Validate email address
     */
    static isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /**
     * Validate file type
     */
    static isValidFileType(file) {
        const allowedTypes = [...CONFIG.ALLOWED_IMAGE_TYPES, ...CONFIG.ALLOWED_VIDEO_TYPES];
        return allowedTypes.includes(file.type);
    }

    /**
     * Check if file size is within limits
     */
    static isValidFileSize(file) {
        return file.size <= CONFIG.MAX_FILE_SIZE;
    }

    /**
     * Generate unique ID
     */
    static generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    /**
     * Debounce function calls
     */
    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Throttle function calls
     */
    static throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    /**
     * Copy text to clipboard
     */
    static async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (error) {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                return true;
            } catch (err) {
                return false;
            } finally {
                document.body.removeChild(textArea);
            }
        }
    }

    /**
     * Download file from blob
     */
    static downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Create and download text file
     */
    static downloadTextFile(content, filename) {
        const blob = new Blob([content], { type: 'text/plain' });
        this.downloadBlob(blob, filename);
    }

    /**
     * Sanitize HTML to prevent XSS
     */
    static sanitizeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    /**
     * Parse URL parameters
     */
    static getURLParams() {
        const params = new URLSearchParams(window.location.search);
        const result = {};
        for (const [key, value] of params) {
            result[key] = value;
        }
        return result;
    }

    /**
     * Set URL parameter without page reload
     */
    static setURLParam(key, value) {
        const url = new URL(window.location);
        url.searchParams.set(key, value);
        window.history.replaceState({}, '', url);
    }

    /**
     * Remove URL parameter without page reload
     */
    static removeURLParam(key) {
        const url = new URL(window.location);
        url.searchParams.delete(key);
        window.history.replaceState({}, '', url);
    }

    /**
     * Check if device is mobile
     */
    static isMobile() {
        return window.innerWidth <= 768;
    }

    /**
     * Check if device supports touch
     */
    static isTouchDevice() {
        return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    }

    /**
     * Get device type
     */
    static getDeviceType() {
        if (this.isMobile()) {
            return 'mobile';
        } else if (window.innerWidth <= 1024) {
            return 'tablet';
        } else {
            return 'desktop';
        }
    }

    /**
     * Smooth scroll to element
     */
    static scrollToElement(element, offset = 0) {
        const elementPosition = element.offsetTop - offset;
        window.scrollTo({
            top: elementPosition,
            behavior: 'smooth'
        });
    }

    /**
     * Check if element is in viewport
     */
    static isInViewport(element) {
        const rect = element.getBoundingClientRect();
        return (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );
    }

    /**
     * Wait for specified time
     */
    static wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Retry function with exponential backoff
     */
    static async retry(fn, maxAttempts = 3, baseDelay = 1000) {
        let lastError;
        
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error;
                
                if (attempt === maxAttempts) {
                    throw lastError;
                }
                
                const delay = baseDelay * Math.pow(2, attempt - 1);
                await this.wait(delay);
            }
        }
    }

    /**
     * Format confidence score with color
     */
    static formatConfidenceScore(score, isDeepfake = false) {
        const percentage = Math.round(score);
        let className = 'confidence-low';
        
        if (percentage >= 80) {
            className = isDeepfake ? 'confidence-high-danger' : 'confidence-high';
        } else if (percentage >= 60) {
            className = 'confidence-medium';
        }
        
        return {
            percentage,
            className,
            text: `${percentage}%`
        };
    }

    /**
     * Generate case number display format
     */
    static formatCaseNumber(id) {
        const year = new Date().getFullYear();
        const paddedId = id.toString().padStart(4, '0');
        return `DS-${year}-${paddedId}`;
    }

    /**
     * Validate and format phone number
     */
    static formatPhoneNumber(phone) {
        const cleaned = phone.replace(/\D/g, '');
        if (cleaned.length === 10) {
            return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
        }
        return phone;
    }

    /**
     * Generate secure random string
     */
    static generateSecureRandom(length = 32) {
        const array = new Uint8Array(length);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Check if browser supports required features
     */
    static checkBrowserSupport() {
        const required = {
            fetch: typeof fetch !== 'undefined',
            localStorage: typeof Storage !== 'undefined',
            crypto: typeof crypto !== 'undefined',
            fileAPI: typeof FileReader !== 'undefined'
        };

        const unsupported = Object.keys(required).filter(key => !required[key]);
        
        return {
            supported: unsupported.length === 0,
            missing: unsupported
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Utils;
}