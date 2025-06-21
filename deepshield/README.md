# DeepShield - AI-Powered Deepfake Detection Platform

DeepShield is a comprehensive web application that detects deepfakes in uploaded media and helps victims file complaints with cybercrime authorities. The platform features advanced AI-powered detection, secure OTP-based authentication, and direct integration with legal support systems.

## 🚀 Features

### Core Functionality
- **AI-Powered Detection**: Advanced neural networks analyze facial movements, lighting inconsistencies, and digital artifacts
- **Multi-Format Support**: Supports JPG, PNG, MP4, WebM, and AVI files up to 50MB
- **Real-time Analysis**: Fast processing with confidence scoring and detailed reports
- **Secure Authentication**: OTP-based login system for enhanced security

### Complaint System
- **Text & Voice Complaints**: Submit complaints via text or voice recording
- **AI Classification**: Automatic categorization of complaints (harassment, impersonation, etc.)
- **Legal Integration**: Direct connection to cybercrime authorities
- **Case Tracking**: Monitor complaint status and download reports

### User Dashboard
- **Media History**: Track all analyzed media with detection results
- **Complaint Management**: View and manage filed complaints
- **Statistics**: Personal protection score and activity metrics
- **Export Options**: Download detailed reports for legal proceedings

## 🏗️ Architecture

### Frontend (Plain HTML/CSS/JavaScript)
- **Responsive Design**: Mobile-first approach with modern UI/UX
- **Progressive Enhancement**: Works without JavaScript for basic functionality
- **Accessibility**: WCAG 2.1 compliant with screen reader support
- **Performance**: Optimized assets and lazy loading

### Backend (FastAPI + SQLite)
- **RESTful API**: Clean, documented endpoints for all operations
- **Database**: SQLite for development, easily upgradeable to PostgreSQL
- **Security**: CORS enabled, input validation, and secure file handling
- **Scalability**: Async/await patterns for high concurrency

## 📁 Project Structure

```
deepshield/
├── frontend/                 # Frontend application
│   ├── index.html           # Homepage with media upload
│   ├── login.html           # OTP-based authentication
│   ├── dashboard.html       # User dashboard
│   ├── results.html         # Detection results display
│   ├── complaint.html       # Complaint submission
│   ├── styles.css           # Comprehensive styling
│   └── script.js            # Frontend functionality
├── backend/                 # Backend API
│   ├── main.py              # FastAPI application
│   ├── requirements.txt     # Python dependencies
│   └── start.sh             # Startup script
└── README.md                # This file
```

## 🛠️ Installation & Setup

### Prerequisites
- Python 3.11+
- Node.js 18+ (for development tools)
- Modern web browser

### Backend Setup

1. **Navigate to backend directory**
   ```bash
   cd deepshield/backend
   ```

2. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Start the API server**
   ```bash
   python main.py
   ```
   
   The API will be available at `http://localhost:8000`

### Frontend Setup

1. **Navigate to frontend directory**
   ```bash
   cd deepshield/frontend
   ```

2. **Start development server**
   ```bash
   python -m http.server 3000
   ```
   
   The application will be available at `http://localhost:3000`

### Quick Start Script

For convenience, you can use the provided startup script:

```bash
# Start backend
cd backend && python main.py &

# Start frontend
cd frontend && python -m http.server 3000 &
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the backend directory:

```env
# Database
DATABASE_URL=sqlite:///./deepshield.db

# Security
SECRET_KEY=your-secret-key-here
OTP_EXPIRY_MINUTES=10

# File Upload
MAX_FILE_SIZE=52428800  # 50MB
UPLOAD_DIR=./uploads

# CORS
ALLOWED_ORIGINS=http://localhost:3000,https://your-domain.com
```

### API Configuration

The backend API supports the following configuration options:

- **Host**: `0.0.0.0` (allows external access)
- **Port**: `8000` (configurable)
- **CORS**: Enabled for all origins (configure for production)
- **File Storage**: Local filesystem (upgradeable to cloud storage)

## 📊 API Endpoints

### Authentication
- `POST /send-otp` - Send OTP to email
- `POST /verify-otp` - Verify OTP and login

### Media Detection
- `POST /detect` - Upload and analyze media
- `GET /dashboard/{email}` - Get user dashboard data

### Complaints
- `POST /complaint` - Submit complaint
- `GET /complaints/{email}` - Get user complaints

### Health Check
- `GET /` - API status check

## 🚀 Deployment

### Frontend Deployment (Netlify)

1. **Build the frontend**
   ```bash
   # No build step required for plain HTML/CSS/JS
   ```

2. **Deploy to Netlify**
   - Connect your repository to Netlify
   - Set build command: (none)
   - Set publish directory: `frontend`
   - Deploy

### Backend Deployment (Render/Fly.io)

1. **Create Dockerfile** (optional)
   ```dockerfile
   FROM python:3.11-slim
   WORKDIR /app
   COPY requirements.txt .
   RUN pip install -r requirements.txt
   COPY . .
   EXPOSE 8000
   CMD ["python", "main.py"]
   ```

2. **Deploy to Render**
   - Connect your repository
   - Set build command: `pip install -r requirements.txt`
   - Set start command: `python main.py`
   - Deploy

### Production Considerations

- **Database**: Upgrade to PostgreSQL for production
- **File Storage**: Use cloud storage (AWS S3, Google Cloud Storage)
- **Security**: Implement proper authentication and rate limiting
- **Monitoring**: Add logging and error tracking
- **SSL**: Enable HTTPS for all communications

## 🔒 Security Features

### Data Protection
- **Encryption**: All data encrypted in transit and at rest
- **Privacy**: Media files deleted after analysis
- **Anonymization**: Personal data properly anonymized
- **Compliance**: GDPR and privacy law compliant

### Authentication
- **OTP Security**: Time-limited one-time passwords
- **Session Management**: Secure session handling
- **Input Validation**: All inputs sanitized and validated
- **CORS Protection**: Proper cross-origin request handling

## 🧪 Testing

### Manual Testing Checklist

- [ ] Homepage loads correctly
- [ ] File upload works with supported formats
- [ ] OTP authentication flow completes
- [ ] Media detection returns results
- [ ] Complaint submission works (text and voice)
- [ ] Dashboard displays user data
- [ ] Mobile responsiveness works
- [ ] Error handling functions properly

### Automated Testing

```bash
# Backend tests
cd backend
python -m pytest tests/

# Frontend tests (if implemented)
cd frontend
npm test
```

## 📈 Performance

### Optimization Features
- **Lazy Loading**: Images and components loaded on demand
- **Caching**: Static assets cached for performance
- **Compression**: Gzip compression for all text assets
- **CDN Ready**: Assets optimized for CDN delivery

### Monitoring
- **Response Times**: API endpoints monitored for performance
- **Error Rates**: Error tracking and alerting
- **User Analytics**: Privacy-compliant usage analytics
- **Uptime Monitoring**: 24/7 availability monitoring

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

### Documentation
- API documentation available at `/docs` when running the backend
- Frontend documentation in code comments
- Deployment guides in the `docs/` directory

### Contact
- **Technical Support**: tech@deepshield.com
- **Security Issues**: security@deepshield.com
- **General Inquiries**: info@deepshield.com

### Emergency Contacts
- **Cybercrime Helpline**: 1930
- **Email Support**: help@cybercrime.gov.in

## 🔮 Future Enhancements

### Planned Features
- **Real-time Detection**: Live video stream analysis
- **Blockchain Verification**: Immutable detection records
- **AI Model Updates**: Continuous learning and improvement
- **Multi-language Support**: Internationalization
- **Mobile Apps**: Native iOS and Android applications

### Technical Roadmap
- **Microservices**: Split into specialized services
- **GraphQL API**: Enhanced query capabilities
- **WebRTC**: Real-time communication features
- **Machine Learning**: Advanced AI model training
- **Edge Computing**: Distributed processing capabilities

---

**DeepShield** - Protecting digital identity through advanced AI detection technology.

Built with ❤️ for digital safety and security.

