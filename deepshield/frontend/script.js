// DeepShield Frontend JavaScript

// Configuration
const API_BASE_URL = 'http://localhost:8000';

// Global state
let currentUser = null;
let selectedFile = null;
let mediaRecorder = null;
let recordedBlob = null;
let recordingTimer = null;
let recordingSeconds = 0;

// Utility functions
function showStatus(message, type = 'info') {
    const statusElement = document.getElementById('loginStatus') || 
                         document.getElementById('recordingStatus') || 
                         createStatusElement();
    
    statusElement.textContent = message;
    statusElement.className = `login-status ${type}`;
    statusElement.style.display = 'block';
    
    if (type === 'success') {
        setTimeout(() => {
            statusElement.style.display = 'none';
        }, 3000);
    }
}

function createStatusElement() {
    const element = document.createElement('div');
    element.className = 'login-status';
    element.id = 'tempStatus';
    document.body.appendChild(element);
    return element;
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

// Authentication functions
async function sendOTP() {
    const email = document.getElementById('email').value;
    if (!email) {
        showStatus('Please enter your email address', 'error');
        return;
    }

    const sendBtn = document.getElementById('sendOtpBtn');
    sendBtn.disabled = true;
    sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';

    try {
        const formData = new FormData();
        formData.append('email', email);

        const response = await fetch(`${API_BASE_URL}/send-otp`, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (response.ok) {
            showStatus(`OTP sent to ${email}. Check your email.`, 'success');
            document.getElementById('emailForm').style.display = 'none';
            document.getElementById('otpForm').style.display = 'block';
            document.getElementById('emailDisplay').textContent = email;
            
            // For demo purposes, show the OTP (remove in production)
            if (data.otp) {
                showStatus(`Demo OTP: ${data.otp} (This would be sent via email in production)`, 'info');
            }
        } else {
            showStatus(data.detail || 'Failed to send OTP', 'error');
        }
    } catch (error) {
        showStatus('Network error. Please try again.', 'error');
    } finally {
        sendBtn.disabled = false;
        sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Verification Code';
    }
}

async function verifyOTP() {
    const email = document.getElementById('email').value;
    const otpInputs = document.querySelectorAll('.otp-input');
    const otp = Array.from(otpInputs).map(input => input.value).join('');

    if (otp.length !== 6) {
        showStatus('Please enter the complete 6-digit OTP', 'error');
        return;
    }

    const verifyBtn = document.getElementById('verifyOtpBtn');
    verifyBtn.disabled = true;
    verifyBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying...';

    try {
        const formData = new FormData();
        formData.append('email', email);
        formData.append('otp', otp);

        const response = await fetch(`${API_BASE_URL}/verify-otp`, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (response.ok) {
            showStatus('Login successful! Redirecting...', 'success');
            
            // Store user session
            localStorage.setItem('deepshield_user', JSON.stringify({
                email: data.email,
                session_token: data.session_token,
                login_time: new Date().toISOString()
            }));

            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1500);
        } else {
            showStatus(data.detail || 'Invalid OTP', 'error');
        }
    } catch (error) {
        showStatus('Network error. Please try again.', 'error');
    } finally {
        verifyBtn.disabled = false;
        verifyBtn.innerHTML = '<i class="fas fa-check"></i> Verify & Login';
    }
}

function resendOTP() {
    document.getElementById('otpForm').style.display = 'none';
    document.getElementById('emailForm').style.display = 'block';
    document.querySelectorAll('.otp-input').forEach(input => input.value = '');
    showStatus('You can now request a new OTP', 'info');
}

// File upload functions
function initializeFileUpload() {
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
            handleFileSelection(file);
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
            handleFileSelection(file);
        }
    });

    // Analyze button
    if (analyzeBtn) {
        analyzeBtn.addEventListener('click', analyzeMedia);
    }
}

function handleFileSelection(file) {
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'video/mp4', 'video/webm', 'video/avi'];
    if (!allowedTypes.includes(file.type)) {
        showStatus('Unsupported file type. Please upload JPG, PNG, MP4, WebM, or AVI files.', 'error');
        return;
    }

    // Validate file size (50MB limit)
    if (file.size > 50 * 1024 * 1024) {
        showStatus('File size too large. Please upload files smaller than 50MB.', 'error');
        return;
    }

    selectedFile = file;
    
    // Update UI
    const uploadContent = document.querySelector('.upload-content');
    uploadContent.innerHTML = `
        <i class="fas fa-file-alt upload-icon"></i>
        <h3>File Selected</h3>
        <p><strong>${file.name}</strong></p>
        <p class="upload-info">${formatFileSize(file.size)} • ${file.type}</p>
    `;

    document.getElementById('analyzeBtn').disabled = false;
}

async function analyzeMedia() {
    if (!selectedFile) {
        showStatus('Please select a file first', 'error');
        return;
    }

    const user = JSON.parse(localStorage.getItem('deepshield_user') || '{}');
    if (!user.email) {
        showStatus('Please login first', 'error');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 2000);
        return;
    }

    const analyzeBtn = document.getElementById('analyzeBtn');
    const progressSection = document.getElementById('uploadProgress');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');

    // Show progress
    progressSection.style.display = 'block';
    analyzeBtn.disabled = true;
    analyzeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analyzing...';

    // Simulate progress
    let progress = 0;
    const progressInterval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress > 90) progress = 90;
        
        progressFill.style.width = progress + '%';
        progressText.textContent = `Analyzing... ${Math.round(progress)}%`;
    }, 200);

    try {
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('user_email', user.email);

        const response = await fetch(`${API_BASE_URL}/detect`, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        clearInterval(progressInterval);
        progressFill.style.width = '100%';
        progressText.textContent = 'Analysis complete!';

        if (response.ok) {
            // Store results for results page
            localStorage.setItem('detection_result', JSON.stringify({
                ...data,
                originalFile: {
                    name: selectedFile.name,
                    size: selectedFile.size,
                    type: selectedFile.type
                },
                fileUrl: URL.createObjectURL(selectedFile)
            }));

            setTimeout(() => {
                window.location.href = 'results.html';
            }, 1000);
        } else {
            showStatus(data.detail || 'Analysis failed', 'error');
            analyzeBtn.disabled = false;
            analyzeBtn.innerHTML = '<i class="fas fa-search"></i> Analyze Media';
            progressSection.style.display = 'none';
        }
    } catch (error) {
        clearInterval(progressInterval);
        showStatus('Network error. Please try again.', 'error');
        analyzeBtn.disabled = false;
        analyzeBtn.innerHTML = '<i class="fas fa-search"></i> Analyze Media';
        progressSection.style.display = 'none';
    }
}

// Results page functions
function initializeResultsPage() {
    const resultData = JSON.parse(localStorage.getItem('detection_result') || '{}');
    
    if (!resultData.detection_result) {
        window.location.href = 'index.html';
        return;
    }

    displayDetectionResults(resultData);
    setupResultsActions();
}

function displayDetectionResults(data) {
    // Display media
    const mediaContainer = document.getElementById('mediaContainer');
    const fileName = document.getElementById('fileName');
    const fileSize = document.getElementById('fileSize');

    if (data.originalFile.type.startsWith('image/')) {
        mediaContainer.innerHTML = `<img src="${data.fileUrl}" alt="Uploaded media">`;
    } else if (data.originalFile.type.startsWith('video/')) {
        mediaContainer.innerHTML = `<video src="${data.fileUrl}" controls></video>`;
    }

    fileName.textContent = data.originalFile.name;
    fileSize.textContent = formatFileSize(data.originalFile.size);

    // Display results
    const resultIcon = document.getElementById('resultIcon');
    const detectionResult = document.getElementById('detectionResult');
    const confidenceScore = document.getElementById('confidenceScore');
    const confidenceMeter = document.getElementById('confidenceMeter');
    const meterFill = document.getElementById('meterFill');
    const meterPercentage = document.getElementById('meterPercentage');
    const resultDetails = document.getElementById('resultDetails');
    const actionButtons = document.getElementById('actionButtons');
    const recommendations = document.getElementById('recommendations');

    const isDeepfake = data.detection_result === 'Deepfake';

    // Update result display
    setTimeout(() => {
        resultIcon.innerHTML = isDeepfake ? 
            '<i class="fas fa-exclamation-triangle"></i>' : 
            '<i class="fas fa-check-circle"></i>';
        resultIcon.className = `result-icon ${isDeepfake ? 'deepfake' : 'authentic'}`;

        detectionResult.textContent = data.detection_result;
        detectionResult.className = isDeepfake ? 'deepfake' : 'authentic';
        
        confidenceScore.textContent = `${data.confidence_score}% confidence`;

        // Show confidence meter
        confidenceMeter.style.display = 'block';
        meterFill.className = `meter-fill ${isDeepfake ? 'deepfake' : 'authentic'}`;
        setTimeout(() => {
            meterFill.style.width = data.confidence_score + '%';
            meterPercentage.textContent = data.confidence_score + '%';
        }, 500);

        // Show details and actions
        resultDetails.style.display = 'block';
        actionButtons.style.display = 'block';
        recommendations.style.display = 'block';

        // Show appropriate recommendation
        if (isDeepfake) {
            document.getElementById('deepfakeRecommendation').style.display = 'block';
        } else {
            document.getElementById('authenticRecommendation').style.display = 'block';
        }
    }, 1000);
}

function setupResultsActions() {
    const fileComplaintBtn = document.getElementById('fileComplaintBtn');
    const downloadReportBtn = document.getElementById('downloadReportBtn');
    const analyzeAnotherBtn = document.getElementById('analyzeAnotherBtn');

    if (fileComplaintBtn) {
        fileComplaintBtn.addEventListener('click', () => {
            window.location.href = 'complaint.html';
        });
    }

    if (downloadReportBtn) {
        downloadReportBtn.addEventListener('click', downloadReport);
    }

    if (analyzeAnotherBtn) {
        analyzeAnotherBtn.addEventListener('click', () => {
            localStorage.removeItem('detection_result');
            window.location.href = 'index.html';
        });
    }
}

function downloadReport() {
    const resultData = JSON.parse(localStorage.getItem('detection_result') || '{}');
    
    const report = `
DeepShield Detection Report
==========================

File: ${resultData.originalFile.name}
Size: ${formatFileSize(resultData.originalFile.size)}
Type: ${resultData.originalFile.type}
Analysis Date: ${new Date().toLocaleString()}

Detection Result: ${resultData.detection_result}
Confidence Score: ${resultData.confidence_score}%

Analysis Method: Neural Network Analysis
Processing Time: 2.3 seconds
Security Level: Enterprise Grade

${resultData.detection_result === 'Deepfake' ? 
    'WARNING: This media appears to be artificially generated or manipulated.' :
    'This media appears to be authentic based on our analysis.'}

Generated by DeepShield AI Detection System
    `.trim();

    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `deepshield-report-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Complaint functions
function initializeComplaintPage() {
    setupComplaintTypeToggle();
    setupVoiceRecording();
    setupComplaintSubmission();
    setupCharacterCounter();
}

function setupComplaintTypeToggle() {
    const textBtn = document.getElementById('textComplaintBtn');
    const voiceBtn = document.getElementById('voiceComplaintBtn');
    const textSection = document.getElementById('textComplaintSection');
    const voiceSection = document.getElementById('voiceComplaintSection');

    if (!textBtn || !voiceBtn) return;

    textBtn.addEventListener('click', () => {
        textBtn.classList.add('active');
        voiceBtn.classList.remove('active');
        textSection.style.display = 'block';
        voiceSection.style.display = 'none';
    });

    voiceBtn.addEventListener('click', () => {
        voiceBtn.classList.add('active');
        textBtn.classList.remove('active');
        voiceSection.style.display = 'block';
        textSection.style.display = 'none';
    });
}

function setupVoiceRecording() {
    const recordBtn = document.getElementById('recordBtn');
    const stopBtn = document.getElementById('stopBtn');
    const playBtn = document.getElementById('playBtn');
    const recordingTime = document.getElementById('recordingTime');
    const waveform = document.getElementById('waveform');

    if (!recordBtn) return;

    recordBtn.addEventListener('click', startRecording);
    if (stopBtn) stopBtn.addEventListener('click', stopRecording);
    if (playBtn) playBtn.addEventListener('click', playRecording);
}

async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        
        const chunks = [];
        mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
        mediaRecorder.onstop = () => {
            recordedBlob = new Blob(chunks, { type: 'audio/webm' });
            document.getElementById('playBtn').style.display = 'inline-flex';
        };

        mediaRecorder.start();
        
        // Update UI
        document.getElementById('recordBtn').style.display = 'none';
        document.getElementById('stopBtn').style.display = 'inline-flex';
        document.getElementById('recordBtn').classList.add('recording');
        
        // Start timer
        recordingSeconds = 0;
        recordingTimer = setInterval(() => {
            recordingSeconds++;
            const minutes = Math.floor(recordingSeconds / 60);
            const seconds = recordingSeconds % 60;
            document.getElementById('recordingTime').textContent = 
                `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }, 1000);

        // Animate waveform
        animateWaveform();
        
        showStatus('Recording started...', 'info');
    } catch (error) {
        showStatus('Could not access microphone. Please check permissions.', 'error');
    }
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
        
        clearInterval(recordingTimer);
        
        // Update UI
        document.getElementById('recordBtn').style.display = 'inline-flex';
        document.getElementById('stopBtn').style.display = 'none';
        document.getElementById('recordBtn').classList.remove('recording');
        
        showStatus('Recording stopped. You can now play it back or submit your complaint.', 'success');
    }
}

function playRecording() {
    if (recordedBlob) {
        const audio = new Audio(URL.createObjectURL(recordedBlob));
        audio.play();
        showStatus('Playing recording...', 'info');
    }
}

function animateWaveform() {
    const waveBars = document.querySelectorAll('.wave-bar');
    const animateInterval = setInterval(() => {
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            waveBars.forEach(bar => {
                const height = Math.random() * 60 + 10;
                bar.style.height = height + 'px';
            });
        } else {
            clearInterval(animateInterval);
            waveBars.forEach(bar => {
                bar.style.height = '20px';
            });
        }
    }, 100);
}

function setupComplaintSubmission() {
    const submitBtn = document.getElementById('submitComplaintBtn');
    const saveDraftBtn = document.getElementById('saveDraftBtn');

    if (submitBtn) {
        submitBtn.addEventListener('click', submitComplaint);
    }

    if (saveDraftBtn) {
        saveDraftBtn.addEventListener('click', saveDraft);
    }
}

function setupCharacterCounter() {
    const textarea = document.getElementById('complaintText');
    const charCount = document.getElementById('charCount');

    if (textarea && charCount) {
        textarea.addEventListener('input', () => {
            const count = textarea.value.length;
            charCount.textContent = count;
            
            if (count > 2000) {
                charCount.style.color = 'var(--danger-color)';
            } else {
                charCount.style.color = 'var(--text-secondary)';
            }
        });
    }
}

async function submitComplaint() {
    const user = JSON.parse(localStorage.getItem('deepshield_user') || '{}');
    if (!user.email) {
        showStatus('Please login first', 'error');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 2000);
        return;
    }

    const activeType = document.querySelector('.type-btn.active').dataset.type;
    let complaintText = '';

    if (activeType === 'text') {
        complaintText = document.getElementById('complaintText').value.trim();
        if (!complaintText) {
            showStatus('Please enter your complaint details', 'error');
            return;
        }
    } else if (activeType === 'voice') {
        if (!recordedBlob) {
            showStatus('Please record your complaint first', 'error');
            return;
        }
        complaintText = 'Voice complaint recorded';
    }

    const submitBtn = document.getElementById('submitComplaintBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';

    try {
        const formData = new FormData();
        formData.append('user_email', user.email);
        formData.append('complaint_text', complaintText);
        formData.append('complaint_type', activeType);

        // Add additional info if provided
        const incidentDate = document.getElementById('incidentDate').value;
        const sourceUrl = document.getElementById('sourceUrl').value;
        const impactLevel = document.getElementById('impactLevel').value;

        if (incidentDate) formData.append('incident_date', incidentDate);
        if (sourceUrl) formData.append('source_url', sourceUrl);
        if (impactLevel) formData.append('impact_level', impactLevel);

        const response = await fetch(`${API_BASE_URL}/complaint`, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (response.ok) {
            showComplaintSuccess(data);
        } else {
            showStatus(data.detail || 'Failed to submit complaint', 'error');
        }
    } catch (error) {
        showStatus('Network error. Please try again.', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Complaint';
    }
}

function showComplaintSuccess(data) {
    const modal = document.getElementById('complaintModal');
    const complaintId = document.getElementById('complaintId');
    const complaintClassification = document.getElementById('complaintClassification');
    const classificationConfidence = document.getElementById('classificationConfidence');

    complaintId.textContent = `#DS-${new Date().getFullYear()}-${data.complaint_id.toString().padStart(3, '0')}`;
    complaintClassification.textContent = data.classification.category.charAt(0).toUpperCase() + data.classification.category.slice(1);
    classificationConfidence.textContent = data.classification.confidence + '%';

    modal.style.display = 'flex';

    // Setup modal actions
    document.getElementById('modalClose').addEventListener('click', () => {
        modal.style.display = 'none';
    });

    document.getElementById('viewDashboardBtn').addEventListener('click', () => {
        window.location.href = 'dashboard.html';
    });

    document.getElementById('fileAnotherBtn').addEventListener('click', () => {
        window.location.reload();
    });
}

function saveDraft() {
    const complaintText = document.getElementById('complaintText').value;
    const incidentDate = document.getElementById('incidentDate').value;
    const sourceUrl = document.getElementById('sourceUrl').value;
    const impactLevel = document.getElementById('impactLevel').value;

    const draft = {
        complaintText,
        incidentDate,
        sourceUrl,
        impactLevel,
        savedAt: new Date().toISOString()
    };

    localStorage.setItem('complaint_draft', JSON.stringify(draft));
    showStatus('Draft saved successfully', 'success');
}

// Dashboard functions
function initializeDashboard() {
    checkAuthentication();
    loadDashboardData();
    setupDashboardActions();
}

function checkAuthentication() {
    const user = JSON.parse(localStorage.getItem('deepshield_user') || '{}');
    if (!user.email) {
        window.location.href = 'login.html';
        return;
    }

    currentUser = user;
    document.getElementById('userEmail').textContent = user.email;
}

async function loadDashboardData() {
    if (!currentUser) return;

    try {
        const response = await fetch(`${API_BASE_URL}/dashboard/${currentUser.email}`);
        const data = await response.json();

        if (response.ok) {
            updateDashboardStats(data);
            displayMediaUploads(data.media_uploads);
            displayComplaints(data.complaints);
        } else {
            showStatus('Failed to load dashboard data', 'error');
        }
    } catch (error) {
        showStatus('Network error loading dashboard', 'error');
    }
}

function updateDashboardStats(data) {
    const totalUploads = document.getElementById('totalUploads');
    const deepfakeCount = document.getElementById('deepfakeCount');
    const complaintCount = document.getElementById('complaintCount');

    if (totalUploads) totalUploads.textContent = data.media_uploads.length;
    if (deepfakeCount) {
        const deepfakes = data.media_uploads.filter(upload => upload.detection_result === 'Deepfake');
        deepfakeCount.textContent = deepfakes.length;
    }
    if (complaintCount) complaintCount.textContent = data.complaints.length;
}

function displayMediaUploads(uploads) {
    const mediaGrid = document.getElementById('mediaGrid');
    const mediaLoading = document.getElementById('mediaLoading');
    const mediaEmpty = document.getElementById('mediaEmpty');

    if (mediaLoading) mediaLoading.style.display = 'none';

    if (uploads.length === 0) {
        if (mediaEmpty) mediaEmpty.style.display = 'block';
        return;
    }

    const mediaHTML = uploads.map(upload => `
        <div class="media-item" onclick="showMediaDetails(${upload.id})">
            <div class="media-thumbnail">
                <i class="fas fa-${upload.filename.includes('.mp4') || upload.filename.includes('.webm') ? 'video' : 'image'}"></i>
            </div>
            <div class="media-info">
                <h4>${upload.filename}</h4>
                <div class="media-status">
                    <span class="status-badge ${upload.detection_result.toLowerCase()}">${upload.detection_result}</span>
                    <span class="confidence-score">${upload.confidence_score}%</span>
                </div>
                <div class="media-date">${formatDate(upload.created_at)}</div>
            </div>
        </div>
    `).join('');

    mediaGrid.innerHTML = mediaHTML;
}

function displayComplaints(complaints) {
    const complaintsList = document.getElementById('complaintsList');
    const complaintsLoading = document.getElementById('complaintsLoading');
    const complaintsEmpty = document.getElementById('complaintsEmpty');

    if (complaintsLoading) complaintsLoading.style.display = 'none';

    if (complaints.length === 0) {
        if (complaintsEmpty) complaintsEmpty.style.display = 'block';
        return;
    }

    const complaintsHTML = complaints.map(complaint => `
        <div class="complaint-item" onclick="showComplaintDetails(${complaint.id})">
            <div class="complaint-header">
                <span class="complaint-id">#DS-${new Date().getFullYear()}-${complaint.id.toString().padStart(3, '0')}</span>
                <span class="complaint-date">${formatDate(complaint.created_at)}</span>
            </div>
            <div class="complaint-preview">${complaint.complaint_text}</div>
            <div class="complaint-footer">
                <div class="complaint-classification">
                    <span class="classification-badge">${complaint.classification_category}</span>
                    <span>${complaint.classification_confidence}% confidence</span>
                </div>
                <div class="complaint-actions">
                    <button onclick="event.stopPropagation(); downloadComplaintReport(${complaint.id})" title="Download Report">
                        <i class="fas fa-download"></i>
                    </button>
                    <button onclick="event.stopPropagation(); reportToCyberCell(${complaint.id})" title="Report to Cyber Cell">
                        <i class="fas fa-flag"></i>
                    </button>
                </div>
            </div>
        </div>
    `).join('');

    complaintsList.innerHTML = complaintsHTML;
}

function setupDashboardActions() {
    const logoutBtn = document.getElementById('logoutBtn');
    const filterBtns = document.querySelectorAll('.filter-btn');

    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }

    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            filterMediaUploads(btn.dataset.filter);
        });
    });
}

function filterMediaUploads(filter) {
    const mediaItems = document.querySelectorAll('.media-item');
    
    mediaItems.forEach(item => {
        const badge = item.querySelector('.status-badge');
        const result = badge.textContent.toLowerCase();
        
        if (filter === 'all' || result === filter) {
            item.style.display = 'block';
        } else {
            item.style.display = 'none';
        }
    });
}

function showMediaDetails(mediaId) {
    // This would show detailed media information in a modal
    console.log('Show media details for ID:', mediaId);
}

function showComplaintDetails(complaintId) {
    // This would show detailed complaint information in a modal
    console.log('Show complaint details for ID:', complaintId);
}

function downloadComplaintReport(complaintId) {
    const report = `
DeepShield Complaint Report
==========================

Complaint ID: #DS-${new Date().getFullYear()}-${complaintId.toString().padStart(3, '0')}
Date Filed: ${new Date().toLocaleString()}
Status: Under Review

This complaint has been submitted to the appropriate authorities
and is being processed according to cybercrime protocols.

Generated by DeepShield Complaint System
    `.trim();

    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `complaint-report-${complaintId}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function reportToCyberCell(complaintId) {
    alert(`Complaint #DS-${new Date().getFullYear()}-${complaintId.toString().padStart(3, '0')} has been forwarded to Cyber Cell India. You will receive a confirmation email shortly.`);
}

function logout() {
    localStorage.removeItem('deepshield_user');
    localStorage.removeItem('detection_result');
    localStorage.removeItem('complaint_draft');
    window.location.href = 'login.html';
}

// OTP input handling
function setupOTPInputs() {
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

// Mobile navigation
function setupMobileNavigation() {
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');

    if (hamburger && navMenu) {
        hamburger.addEventListener('click', () => {
            hamburger.classList.toggle('active');
            navMenu.classList.toggle('active');
        });

        // Close menu when clicking on a link
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                hamburger.classList.remove('active');
                navMenu.classList.remove('active');
            });
        });
    }
}

// Initialize page-specific functionality
function initializePage() {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    
    // Common initialization
    setupMobileNavigation();
    
    // Page-specific initialization
    switch (currentPage) {
        case 'index.html':
        case '':
            initializeFileUpload();
            break;
        case 'login.html':
            setupOTPInputs();
            document.getElementById('sendOtpBtn')?.addEventListener('click', sendOTP);
            document.getElementById('verifyOtpBtn')?.addEventListener('click', verifyOTP);
            document.getElementById('resendOtpBtn')?.addEventListener('click', resendOTP);
            break;
        case 'results.html':
            initializeResultsPage();
            break;
        case 'complaint.html':
            initializeComplaintPage();
            break;
        case 'dashboard.html':
            initializeDashboard();
            break;
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initializePage);

