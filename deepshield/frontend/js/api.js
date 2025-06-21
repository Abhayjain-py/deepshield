/**
 * API Client for DeepShield Frontend
 */

class APIClient {
    constructor() {
        this.baseURL = CONFIG.API_BASE_URL;
        this.token = localStorage.getItem(CONFIG.TOKEN_KEY);
    }

    /**
     * Make HTTP request with error handling
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        // Add authorization header if token exists
        if (this.token && !config.headers.Authorization) {
            config.headers.Authorization = `Bearer ${this.token}`;
        }

        try {
            const response = await fetch(url, config);
            
            // Handle different response types
            const contentType = response.headers.get('content-type');
            let data;
            
            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            } else {
                data = await response.text();
            }

            if (!response.ok) {
                throw new APIError(data.detail || data.message || 'Request failed', response.status, data);
            }

            return data;
        } catch (error) {
            if (error instanceof APIError) {
                throw error;
            }
            
            // Network or other errors
            console.error('API Request Error:', error);
            throw new APIError(CONFIG.ERRORS.NETWORK, 0, error);
        }
    }

    /**
     * GET request
     */
    async get(endpoint, params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const url = queryString ? `${endpoint}?${queryString}` : endpoint;
        return this.request(url, { method: 'GET' });
    }

    /**
     * POST request with JSON body
     */
    async post(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    /**
     * POST request with FormData
     */
    async postForm(endpoint, formData) {
        return this.request(endpoint, {
            method: 'POST',
            headers: {}, // Let browser set Content-Type for FormData
            body: formData
        });
    }

    /**
     * PUT request
     */
    async put(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    /**
     * DELETE request
     */
    async delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }

    /**
     * Set authentication token
     */
    setToken(token) {
        this.token = token;
        if (token) {
            localStorage.setItem(CONFIG.TOKEN_KEY, token);
        } else {
            localStorage.removeItem(CONFIG.TOKEN_KEY);
        }
    }

    /**
     * Clear authentication
     */
    clearAuth() {
        this.token = null;
        localStorage.removeItem(CONFIG.TOKEN_KEY);
        localStorage.removeItem(CONFIG.USER_KEY);
    }

    // Authentication endpoints
    async sendOTP(email) {
        const formData = new FormData();
        formData.append('email', email);
        return this.postForm('/auth/send-otp', formData);
    }

    async verifyOTP(email, otp) {
        const formData = new FormData();
        formData.append('email', email);
        formData.append('otp', otp);
        return this.postForm('/auth/verify-otp', formData);
    }

    // Media detection endpoints
    async detectDeepfake(file) {
        const formData = new FormData();
        formData.append('file', file);
        return this.postForm('/media/detect', formData);
    }

    // Complaint endpoints
    async submitComplaint(complaintData) {
        const formData = new FormData();
        Object.keys(complaintData).forEach(key => {
            if (complaintData[key] !== null && complaintData[key] !== undefined) {
                formData.append(key, complaintData[key]);
            }
        });
        return this.postForm('/complaints/submit', formData);
    }

    // Dashboard endpoints
    async getDashboard() {
        return this.get('/dashboard');
    }

    // Profile endpoints
    async getProfile() {
        return this.get('/profile');
    }

    async updateProfile(profileData) {
        return this.put('/profile', profileData);
    }

    // Health check
    async healthCheck() {
        return this.get('/health');
    }
}

/**
 * Custom API Error class
 */
class APIError extends Error {
    constructor(message, status = 0, data = null) {
        super(message);
        this.name = 'APIError';
        this.status = status;
        this.data = data;
    }

    isNetworkError() {
        return this.status === 0;
    }

    isAuthError() {
        return this.status === 401 || this.status === 403;
    }

    isValidationError() {
        return this.status === 400 || this.status === 422;
    }

    isRateLimitError() {
        return this.status === 429;
    }

    isServerError() {
        return this.status >= 500;
    }
}

// Create global API client instance
const api = new APIClient();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { APIClient, APIError, api };
}