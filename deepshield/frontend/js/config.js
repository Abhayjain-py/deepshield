/**
 * Configuration for DeepShield Frontend
 */

const CONFIG = {
    // API Configuration
    API_BASE_URL: window.location.hostname === 'localhost' 
        ? 'http://localhost:8000' 
        : 'https://api.deepshield.com',
    
    // Authentication
    TOKEN_KEY: 'deepshield_token',
    USER_KEY: 'deepshield_user',
    TOKEN_REFRESH_THRESHOLD: 5 * 60 * 1000, // 5 minutes in milliseconds
    
    // File Upload
    MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
    ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/bmp', 'image/webp'],
    ALLOWED_VIDEO_TYPES: ['video/mp4', 'video/avi', 'video/quicktime', 'video/webm'],
    
    // UI Configuration
    TOAST_DURATION: 5000,
    LOADING_DELAY: 300,
    ANIMATION_DURATION: 300,
    
    // Rate Limiting (client-side)
    MAX_REQUESTS_PER_HOUR: 100,
    OTP_RESEND_COOLDOWN: 60, // seconds
    
    // Features
    FEATURES: {
        VOICE_COMPLAINTS: true,
        REAL_TIME_DETECTION: false,
        BATCH_UPLOAD: false,
        EXPORT_REPORTS: true
    },
    
    // External Links
    LINKS: {
        CYBERCRIME_HELPLINE: 'tel:1930',
        CYBERCRIME_EMAIL: 'mailto:help@cybercrime.gov.in',
        PRIVACY_POLICY: '/privacy',
        TERMS_OF_SERVICE: '/terms',
        HELP_CENTER: '/help'
    },
    
    // Error Messages
    ERRORS: {
        NETWORK: 'Network error. Please check your connection and try again.',
        FILE_TOO_LARGE: 'File is too large. Maximum size is 50MB.',
        INVALID_FILE_TYPE: 'Invalid file type. Please upload images or videos only.',
        AUTHENTICATION_REQUIRED: 'Please log in to continue.',
        RATE_LIMIT_EXCEEDED: 'Too many requests. Please wait before trying again.',
        GENERIC: 'Something went wrong. Please try again.'
    },
    
    // Success Messages
    SUCCESS: {
        FILE_UPLOADED: 'File uploaded successfully!',
        COMPLAINT_SUBMITTED: 'Complaint submitted successfully!',
        OTP_SENT: 'Verification code sent to your email.',
        LOGIN_SUCCESS: 'Login successful!',
        LOGOUT_SUCCESS: 'Logged out successfully.'
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}