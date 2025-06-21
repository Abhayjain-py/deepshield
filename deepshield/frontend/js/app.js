/**
 * Main application logic for DeepShield
 */

class DeepShieldApp {
    constructor() {
        this.currentPage = this.getCurrentPage();
        this.init();
    }

    /**
     * Initialize the application
     */
    async init() {
        try {
            // Check browser support
            const browserSupport = Utils.checkBrowserSupport();
            if (!browserSupport.supported) {
                this.showBrowserWarning(browserSupport.missing);
                return;
            }

            // Initialize page-specific functionality
            await this.initializePage();
            
            // Setup global event listeners
            this.setupGlobalEvents();
            
            // Check API health
            this.checkAPIHealth();
            
            console.log('DeepShield app initialized successfully');
        } catch (error) {
            console.error('App initialization error:', error);
            ui.showToast('Failed to initialize application', 'error');
        }
    }

    /**
     * Get current page name
     */
    getCurrentPage() {
        const path = window.location.pathname;
        const page = path.split('/').pop() || 'index.html';
        return page.replace('.html', '');
    }

    /**
     * Initialize page-specific functionality
     */
    async initializePage() {
        switch (this.currentPage) {
            case 'index':
            case '':
                await this.initHomePage();
                break;
            case 'login':
                await this.initLoginPage();
                break;
            case 'dashboard':
                await this.initDashboardPage();
                break;
            case 'complaint':
                await this.initComplaintPage();
                break;
            case 'results':
                await this.initResultsPage();
                break;
            default:
                console.log(`No specific initialization for page: ${this.currentPage}`);
        }
    }

    /**
     * Initialize home page
     */
    async initHomePage() {
        this.setupFileUpload();
        this.setupHeroAnimations();
    }

    /**
     * Initialize login page
     */
    async initLoginPage() {
        // Redirect if already authenticated
        if (auth.isAuthenticated()) {
            window.location.href = 'dashboard.html';
            return;
        }

        this.setupOTPInputs();
        this.setupLoginForm();
    }

    /**
     * Initialize dashboard page
     */
    async initDashboardPage() {
        // Require authentication
        if (!auth.requireAuth()) {
            return;
        }

        await this.loadDashboardData();
        this.setupDashboardFilters();
        this.setupDashboardActions();
    }

    /**
     * Initialize complaint page
     */
    async initComplaintPage() {
        // Require authentication
        if (!auth.requireAuth()) {
            return;
        }

        this.setupComplaintForm();
        this.setupVoiceRecording();
    }

    /**
     * Initialize results page
     */
    async initResultsPage() {
        const resultData = this.getStoredResults();
        if (!resultData) {
            window.location.href = 'index.html';
            return;
        }

        this.displayResults(resultData);
        this.setupResultsActions();
    }

    /**
     * Setup file upload functionality
     */
    setupFileUpload() {
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');
        const analyzeBtn = document.getElementById('analyzeBtn');

        if (!uploadArea || !fileInput) return;

        // Click to upload
        uploadArea.addEventListener('click', () => {
            fileInput.click();
        });

        // File selection
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.handleFileSelection(file);
            }
        });

        // Drag and drop
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            
            const file = e.dataTransfer.files[0];
            if (file) {
                this.handleFileSelection(file);
            }
        });

        // Analyze button
        if (analyzeBtn) {
            analyzeBtn.addEventListener('click', () => this.analyzeMedia());
        }
    }

    /**
     * Handle file selection
     */
    handleFileSelection(file) {
        // Validation is handled by UI manager
        this.selectedFile = file;
        
        // Update UI
        const uploadContent = document.querySelector('.upload-content');
        if (uploadContent) {
            uploadContent.innerHTML = `
                <i class="fas fa-file-alt upload-icon"></i>
                <h3>File Selected</h3>
                <p><strong>${Utils.sanitizeHTML(file.name)}</strong></p>
                <p class="upload-info">${Utils.formatFileSize(file.size)} • ${file.type}</p>
            `;
        }

        const analyzeBtn = document.getElementById('analyzeBtn');
        if (analyzeBtn) {
            analyzeBtn.disabled = false;
        }
    }

    /**
     * Analyze selected media
     */
    async analyzeMedia() {
        if (!this.selectedFile) {
            ui.showToast('Please select a file first', 'error');
            return;
        }

        if (!auth.isAuthenticated()) {
            ui.showToast('Please log in to analyze media', 'error');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
            return;
        }

        const analyzeBtn = document.getElementById('analyzeBtn');
        const progressSection = document.getElementById('uploadProgress');
        
        try {
            // Show progress
            if (progressSection) {
                progressSection.style.display = 'block';
                this.simulateProgress();
            }

            analyzeBtn.disabled = true;
            analyzeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analyzing...';

            const response = await api.detectDeepfake(this.selectedFile);

            // Store results for results page
            this.storeResults({
                ...response,
                originalFile: {
                    name: this.selectedFile.name,
                    size: this.selectedFile.size,
                    type: this.selectedFile.type
                },
                fileUrl: URL.createObjectURL(this.selectedFile)
            });

            ui.showToast('Analysis complete!', 'success');
            
            setTimeout(() => {
                window.location.href = 'results.html';
            }, 1000);

        } catch (error) {
            console.error('Analysis error:', error);
            ui.showToast(error.message || 'Analysis failed', 'error');
        } finally {
            analyzeBtn.disabled = false;
            analyzeBtn.innerHTML = '<i class="fas fa-search"></i> Analyze Media';
            if (progressSection) {
                progressSection.style.display = 'none';
            }
        }
    }

    /**
     * Simulate upload progress
     */
    simulateProgress() {
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        
        if (!progressFill || !progressText) return;

        let progress = 0;
        const interval = setInterval(() => {
            progress += Math.random() * 15;
            if (progress > 90) progress = 90;
            
            progressFill.style.width = progress + '%';
            progressText.textContent = `Analyzing... ${Math.round(progress)}%`;
            
            if (progress >= 90) {
                clearInterval(interval);
            }
        }, 200);
    }

    /**
     * Setup OTP inputs
     */
    setupOTPInputs() {
        const otpInputs = document.querySelectorAll('.otp-input');
        
        otpInputs.forEach((input, index) => {
            input.addEventListener('input', (e) => {
                const value = e.target.value;
                
                if (value.length === 1 && index < otpInputs.length - 1) {
                    otpInputs[index + 1].focus();
                }
                
                if (value.length === 0 && index > 0) {
                    otpInputs[index - 1].focus();
                }
            });

            input.addEventListener('keydown', (e) => {
                if (e.key === 'Backspace' && input.value === '' && index > 0) {
                    otpInputs[index - 1].focus();
                }
            });
        });
    }

    /**
     * Setup login form
     */
    setupLoginForm() {
        const sendOtpBtn = document.getElementById('sendOtpBtn');
        const verifyOtpBtn = document.getElementById('verifyOtpBtn');
        const resendOtpBtn = document.getElementById('resendOtpBtn');

        if (sendOtpBtn) {
            sendOtpBtn.addEventListener('click', () => this.sendOTP());
        }

        if (verifyOtpBtn) {
            verifyOtpBtn.addEventListener('click', () => this.verifyOTP());
        }

        if (resendOtpBtn) {
            resendOtpBtn.addEventListener('click', () => this.resendOTP());
        }
    }

    /**
     * Send OTP
     */
    async sendOTP() {
        const email = document.getElementById('email').value;
        if (!email || !Utils.isValidEmail(email)) {
            ui.showToast('Please enter a valid email address', 'error');
            return;
        }

        try {
            const response = await auth.sendOTP(email);
            
            ui.showToast(response.message || 'OTP sent successfully', 'success');
            
            // Show OTP form
            document.getElementById('emailForm').style.display = 'none';
            document.getElementById('otpForm').style.display = 'block';
            document.getElementById('emailDisplay').textContent = email;
            
            // For demo purposes, show the OTP
            if (response.otp) {
                ui.showToast(`Demo OTP: ${response.otp}`, 'info', 10000);
            }
            
        } catch (error) {
            console.error('Send OTP error:', error);
            ui.showToast(error.message || 'Failed to send OTP', 'error');
        }
    }

    /**
     * Verify OTP
     */
    async verifyOTP() {
        const email = document.getElementById('email').value;
        const otpInputs = document.querySelectorAll('.otp-input');
        const otp = Array.from(otpInputs).map(input => input.value).join('');

        if (otp.length !== 6) {
            ui.showToast('Please enter the complete 6-digit OTP', 'error');
            return;
        }

        try {
            const response = await auth.verifyOTP(email, otp);
            
            ui.showToast('Login successful!', 'success');
            
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1500);
            
        } catch (error) {
            console.error('Verify OTP error:', error);
            ui.showToast(error.message || 'Invalid OTP', 'error');
        }
    }

    /**
     * Resend OTP
     */
    resendOTP() {
        document.getElementById('otpForm').style.display = 'none';
        document.getElementById('emailForm').style.display = 'block';
        document.querySelectorAll('.otp-input').forEach(input => input.value = '');
        ui.showToast('You can now request a new OTP', 'info');
    }

    /**
     * Load dashboard data
     */
    async loadDashboardData() {
        try {
            ui.showLoading('dashboard-content', 'Loading your data...');
            
            const data = await api.getDashboard();
            
            this.updateDashboardStats(data.statistics);
            this.displayMediaUploads(data.media_uploads);
            this.displayComplaints(data.complaints);
            
        } catch (error) {
            console.error('Dashboard load error:', error);
            ui.showToast('Failed to load dashboard data', 'error');
        } finally {
            ui.hideLoading('dashboard-content');
        }
    }

    /**
     * Update dashboard statistics
     */
    updateDashboardStats(stats) {
        const elements = {
            totalUploads: document.getElementById('totalUploads'),
            deepfakeCount: document.getElementById('deepfakeCount'),
            complaintCount: document.getElementById('complaintCount'),
            protectionScore: document.getElementById('protectionScore')
        };

        Object.keys(elements).forEach(key => {
            if (elements[key] && stats[key] !== undefined) {
                ui.animateNumber(elements[key], 0, stats[key]);
            }
        });
    }

    /**
     * Display media uploads
     */
    displayMediaUploads(uploads) {
        const mediaGrid = document.getElementById('mediaGrid');
        const mediaLoading = document.getElementById('mediaLoading');
        const mediaEmpty = document.getElementById('mediaEmpty');

        if (mediaLoading) mediaLoading.style.display = 'none';

        if (uploads.length === 0) {
            if (mediaEmpty) mediaEmpty.style.display = 'block';
            return;
        }

        const mediaHTML = uploads.map(upload => `
            <div class="media-item" onclick="app.showMediaDetails(${upload.id})">
                <div class="media-thumbnail">
                    <i class="fas fa-${upload.filename.includes('.mp4') || upload.filename.includes('.webm') ? 'video' : 'image'}"></i>
                </div>
                <div class="media-info">
                    <h4>${Utils.sanitizeHTML(upload.filename)}</h4>
                    <div class="media-status">
                        <span class="status-badge ${upload.detection_result.toLowerCase()}">${upload.detection_result}</span>
                        <span class="confidence-score">${upload.confidence_score}%</span>
                    </div>
                    <div class="media-date">${Utils.formatRelativeTime(upload.created_at)}</div>
                </div>
            </div>
        `).join('');

        if (mediaGrid) {
            mediaGrid.innerHTML = mediaHTML;
        }
    }

    /**
     * Display complaints
     */
    displayComplaints(complaints) {
        const complaintsList = document.getElementById('complaintsList');
        const complaintsLoading = document.getElementById('complaintsLoading');
        const complaintsEmpty = document.getElementById('complaintsEmpty');

        if (complaintsLoading) complaintsLoading.style.display = 'none';

        if (complaints.length === 0) {
            if (complaintsEmpty) complaintsEmpty.style.display = 'block';
            return;
        }

        const complaintsHTML = complaints.map(complaint => `
            <div class="complaint-item" onclick="app.showComplaintDetails(${complaint.id})">
                <div class="complaint-header">
                    <span class="complaint-id">${complaint.case_number}</span>
                    <span class="complaint-date">${Utils.formatRelativeTime(complaint.created_at)}</span>
                </div>
                <div class="complaint-preview">${Utils.sanitizeHTML(complaint.complaint_text)}</div>
                <div class="complaint-footer">
                    <div class="complaint-classification">
                        <span class="classification-badge">${complaint.classification_category}</span>
                        <span>${complaint.classification_confidence}% confidence</span>
                    </div>
                    <div class="complaint-actions">
                        <button onclick="event.stopPropagation(); app.downloadComplaintReport(${complaint.id})" title="Download Report">
                            <i class="fas fa-download"></i>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');

        if (complaintsList) {
            complaintsList.innerHTML = complaintsHTML;
        }
    }

    /**
     * Setup global event listeners
     */
    setupGlobalEvents() {
        // Logout functionality
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('logout-btn') || e.target.closest('.logout-btn')) {
                this.logout();
            }
        });

        // Authentication state changes
        document.addEventListener('user-login', (e) => {
            console.log('User logged in:', e.detail);
            // Update UI for authenticated state
        });

        document.addEventListener('user-logout', () => {
            console.log('User logged out');
            // Update UI for unauthenticated state
        });

        // Handle API errors globally
        document.addEventListener('api-error', (e) => {
            const error = e.detail;
            if (error.isAuthError()) {
                auth.logout();
            }
        });
    }

    /**
     * Logout user
     */
    logout() {
        ui.showConfirmDialog(
            'Are you sure you want to log out?',
            () => {
                auth.logout();
                ui.showToast('Logged out successfully', 'success');
                window.location.href = 'index.html';
            }
        );
    }

    /**
     * Check API health
     */
    async checkAPIHealth() {
        try {
            await api.healthCheck();
            console.log('API health check passed');
        } catch (error) {
            console.warn('API health check failed:', error);
            ui.showToast('API connection issues detected', 'warning');
        }
    }

    /**
     * Store analysis results
     */
    storeResults(results) {
        localStorage.setItem('detection_result', JSON.stringify(results));
    }

    /**
     * Get stored analysis results
     */
    getStoredResults() {
        const stored = localStorage.getItem('detection_result');
        return stored ? JSON.parse(stored) : null;
    }

    /**
     * Display analysis results
     */
    displayResults(data) {
        // Implementation for results display
        console.log('Displaying results:', data);
    }

    /**
     * Setup hero animations
     */
    setupHeroAnimations() {
        // Animate statistics on scroll
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const statNumbers = entry.target.querySelectorAll('.stat-number');
                    statNumbers.forEach(stat => {
                        const value = parseInt(stat.textContent.replace(/\D/g, ''));
                        ui.animateNumber(stat, 0, value, 2000);
                    });
                    observer.unobserve(entry.target);
                }
            });
        });

        const heroStats = document.querySelector('.hero-stats');
        if (heroStats) {
            observer.observe(heroStats);
        }
    }

    /**
     * Show browser compatibility warning
     */
    showBrowserWarning(missing) {
        const warning = document.createElement('div');
        warning.className = 'browser-warning';
        warning.innerHTML = `
            <div class="warning-content">
                <h3>Browser Compatibility Issue</h3>
                <p>Your browser is missing some required features: ${missing.join(', ')}</p>
                <p>Please update your browser or use a modern browser like Chrome, Firefox, or Safari.</p>
            </div>
        `;
        document.body.insertBefore(warning, document.body.firstChild);
    }

    // Placeholder methods for features to be implemented
    setupDashboardFilters() { /* TODO */ }
    setupDashboardActions() { /* TODO */ }
    setupComplaintForm() { /* TODO */ }
    setupVoiceRecording() { /* TODO */ }
    setupResultsActions() { /* TODO */ }
    showMediaDetails(id) { console.log('Show media details:', id); }
    showComplaintDetails(id) { console.log('Show complaint details:', id); }
    downloadComplaintReport(id) { console.log('Download complaint report:', id); }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new DeepShieldApp();
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DeepShieldApp;
}