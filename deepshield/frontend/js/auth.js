/**
 * Authentication management for DeepShield
 */

class AuthManager {
    constructor() {
        this.currentUser = null;
        this.token = null;
        this.refreshTimer = null;
        this.init();
    }

    /**
     * Initialize authentication state
     */
    init() {
        this.loadStoredAuth();
        this.setupTokenRefresh();
        this.bindEvents();
    }

    /**
     * Load stored authentication data
     */
    loadStoredAuth() {
        const token = localStorage.getItem(CONFIG.TOKEN_KEY);
        const userData = localStorage.getItem(CONFIG.USER_KEY);

        if (token && userData) {
            try {
                this.token = token;
                this.currentUser = JSON.parse(userData);
                api.setToken(token);
                
                // Check if token is expired
                if (this.isTokenExpired()) {
                    this.logout();
                } else {
                    this.updateUI();
                }
            } catch (error) {
                console.error('Error loading stored auth:', error);
                this.logout();
            }
        }
    }

    /**
     * Check if token is expired
     */
    isTokenExpired() {
        if (!this.token) return true;
        
        try {
            const payload = JSON.parse(atob(this.token.split('.')[1]));
            const now = Date.now() / 1000;
            return payload.exp < now;
        } catch (error) {
            return true;
        }
    }

    /**
     * Setup automatic token refresh
     */
    setupTokenRefresh() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
        }

        if (this.token) {
            // Check token expiry every minute
            this.refreshTimer = setInterval(() => {
                if (this.isTokenExpired()) {
                    this.logout();
                }
            }, 60000);
        }
    }

    /**
     * Bind authentication events
     */
    bindEvents() {
        // Listen for storage changes (multi-tab support)
        window.addEventListener('storage', (e) => {
            if (e.key === CONFIG.TOKEN_KEY || e.key === CONFIG.USER_KEY) {
                this.loadStoredAuth();
            }
        });

        // Handle API authentication errors
        document.addEventListener('api-auth-error', () => {
            this.logout();
        });
    }

    /**
     * Send OTP to email
     */
    async sendOTP(email) {
        try {
            const response = await api.sendOTP(email);
            
            // Store email for OTP verification
            sessionStorage.setItem('otp_email', email);
            
            return response;
        } catch (error) {
            this.handleAuthError(error);
            throw error;
        }
    }

    /**
     * Verify OTP and login
     */
    async verifyOTP(email, otp) {
        try {
            const response = await api.verifyOTP(email, otp);
            
            if (response.access_token && response.user) {
                this.setAuthData(response.access_token, response.user);
                
                // Clear stored email
                sessionStorage.removeItem('otp_email');
                
                return response;
            } else {
                throw new Error('Invalid response format');
            }
        } catch (error) {
            this.handleAuthError(error);
            throw error;
        }
    }

    /**
     * Set authentication data
     */
    setAuthData(token, user) {
        this.token = token;
        this.currentUser = user;
        
        // Store in localStorage
        localStorage.setItem(CONFIG.TOKEN_KEY, token);
        localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(user));
        
        // Set API token
        api.setToken(token);
        
        // Setup token refresh
        this.setupTokenRefresh();
        
        // Update UI
        this.updateUI();
        
        // Dispatch login event
        document.dispatchEvent(new CustomEvent('user-login', { detail: user }));
    }

    /**
     * Logout user
     */
    logout() {
        // Clear data
        this.token = null;
        this.currentUser = null;
        
        // Clear storage
        localStorage.removeItem(CONFIG.TOKEN_KEY);
        localStorage.removeItem(CONFIG.USER_KEY);
        sessionStorage.removeItem('otp_email');
        
        // Clear API token
        api.clearAuth();
        
        // Clear refresh timer
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
        }
        
        // Update UI
        this.updateUI();
        
        // Dispatch logout event
        document.dispatchEvent(new CustomEvent('user-logout'));
        
        // Redirect to login if on protected page
        if (this.isProtectedPage()) {
            window.location.href = 'login.html';
        }
    }

    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
        return this.token && this.currentUser && !this.isTokenExpired();
    }

    /**
     * Get current user
     */
    getCurrentUser() {
        return this.currentUser;
    }

    /**
     * Check if current page requires authentication
     */
    isProtectedPage() {
        const protectedPages = ['dashboard.html', 'complaint.html', 'profile.html'];
        const currentPage = window.location.pathname.split('/').pop();
        return protectedPages.includes(currentPage);
    }

    /**
     * Require authentication for current page
     */
    requireAuth() {
        if (!this.isAuthenticated()) {
            window.location.href = 'login.html';
            return false;
        }
        return true;
    }

    /**
     * Update UI based on authentication state
     */
    updateUI() {
        const userMenus = document.querySelectorAll('.user-menu');
        const loginLinks = document.querySelectorAll('.login-link');
        const userEmails = document.querySelectorAll('.user-email');
        const authRequired = document.querySelectorAll('.auth-required');

        if (this.isAuthenticated()) {
            // Show user menus
            userMenus.forEach(menu => menu.style.display = 'flex');
            
            // Hide login links
            loginLinks.forEach(link => link.style.display = 'none');
            
            // Update user email displays
            userEmails.forEach(email => {
                email.textContent = this.currentUser.email;
            });
            
            // Show auth-required elements
            authRequired.forEach(element => element.style.display = 'block');
        } else {
            // Hide user menus
            userMenus.forEach(menu => menu.style.display = 'none');
            
            // Show login links
            loginLinks.forEach(link => link.style.display = 'block');
            
            // Hide auth-required elements
            authRequired.forEach(element => element.style.display = 'none');
        }
    }

    /**
     * Handle authentication errors
     */
    handleAuthError(error) {
        if (error instanceof APIError) {
            if (error.isAuthError()) {
                this.logout();
            }
        }
    }

    /**
     * Get stored email for OTP verification
     */
    getStoredEmail() {
        return sessionStorage.getItem('otp_email');
    }
}

// Create global auth manager instance
const auth = new AuthManager();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AuthManager, auth };
}