#!/bin/bash

# DeepShield Deployment Script
# This script sets up and runs the DeepShield application

set -e

echo "🛡️  DeepShield Deployment Script"
echo "================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Python is installed
check_python() {
    if command -v python3 &> /dev/null; then
        PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
        print_success "Python $PYTHON_VERSION found"
    else
        print_error "Python 3 is required but not installed"
        exit 1
    fi
}

# Check if pip is installed
check_pip() {
    if command -v pip3 &> /dev/null; then
        print_success "pip3 found"
    else
        print_error "pip3 is required but not installed"
        exit 1
    fi
}

# Install backend dependencies
install_backend_deps() {
    print_status "Installing backend dependencies..."
    cd backend
    
    if [ -f "requirements.txt" ]; then
        pip3 install -r requirements.txt
        print_success "Backend dependencies installed"
    else
        print_error "requirements.txt not found in backend directory"
        exit 1
    fi
    
    cd ..
}

# Create necessary directories
create_directories() {
    print_status "Creating necessary directories..."
    
    mkdir -p backend/uploads
    mkdir -p logs
    
    print_success "Directories created"
}

# Start backend server
start_backend() {
    print_status "Starting backend server..."
    cd backend
    
    # Kill any existing process on port 8000
    if lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null ; then
        print_warning "Port 8000 is in use. Killing existing process..."
        kill -9 $(lsof -t -i:8000) 2>/dev/null || true
    fi
    
    # Start the backend server in background
    nohup python3 main.py > ../logs/backend.log 2>&1 &
    BACKEND_PID=$!
    echo $BACKEND_PID > ../logs/backend.pid
    
    # Wait a moment for server to start
    sleep 3
    
    # Check if server is running
    if curl -s http://localhost:8000/ > /dev/null; then
        print_success "Backend server started (PID: $BACKEND_PID)"
    else
        print_error "Failed to start backend server"
        exit 1
    fi
    
    cd ..
}

# Start frontend server
start_frontend() {
    print_status "Starting frontend server..."
    cd frontend
    
    # Kill any existing process on port 3000
    if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null ; then
        print_warning "Port 3000 is in use. Killing existing process..."
        kill -9 $(lsof -t -i:3000) 2>/dev/null || true
    fi
    
    # Start the frontend server in background
    nohup python3 -m http.server 3000 > ../logs/frontend.log 2>&1 &
    FRONTEND_PID=$!
    echo $FRONTEND_PID > ../logs/frontend.pid
    
    # Wait a moment for server to start
    sleep 2
    
    # Check if server is running
    if curl -s http://localhost:3000/ > /dev/null; then
        print_success "Frontend server started (PID: $FRONTEND_PID)"
    else
        print_error "Failed to start frontend server"
        exit 1
    fi
    
    cd ..
}

# Stop servers
stop_servers() {
    print_status "Stopping servers..."
    
    if [ -f "logs/backend.pid" ]; then
        BACKEND_PID=$(cat logs/backend.pid)
        if kill -0 $BACKEND_PID 2>/dev/null; then
            kill $BACKEND_PID
            print_success "Backend server stopped"
        fi
        rm -f logs/backend.pid
    fi
    
    if [ -f "logs/frontend.pid" ]; then
        FRONTEND_PID=$(cat logs/frontend.pid)
        if kill -0 $FRONTEND_PID 2>/dev/null; then
            kill $FRONTEND_PID
            print_success "Frontend server stopped"
        fi
        rm -f logs/frontend.pid
    fi
}

# Show status
show_status() {
    echo ""
    echo "🛡️  DeepShield Status"
    echo "===================="
    
    # Check backend
    if curl -s http://localhost:8000/ > /dev/null; then
        print_success "Backend: Running (http://localhost:8000)"
    else
        print_error "Backend: Not running"
    fi
    
    # Check frontend
    if curl -s http://localhost:3000/ > /dev/null; then
        print_success "Frontend: Running (http://localhost:3000)"
    else
        print_error "Frontend: Not running"
    fi
    
    echo ""
    echo "📊 Logs:"
    echo "  Backend: logs/backend.log"
    echo "  Frontend: logs/frontend.log"
    echo ""
    echo "🌐 Access the application:"
    echo "  Frontend: http://localhost:3000"
    echo "  Backend API: http://localhost:8000"
    echo "  API Docs: http://localhost:8000/docs"
}

# Show help
show_help() {
    echo "DeepShield Deployment Script"
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  start     Start both frontend and backend servers"
    echo "  stop      Stop both servers"
    echo "  restart   Restart both servers"
    echo "  status    Show server status"
    echo "  install   Install dependencies only"
    echo "  help      Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 start    # Start the application"
    echo "  $0 status   # Check if servers are running"
    echo "  $0 stop     # Stop all servers"
}

# Main script logic
case "${1:-start}" in
    "start")
        print_status "Starting DeepShield application..."
        check_python
        check_pip
        install_backend_deps
        create_directories
        start_backend
        start_frontend
        show_status
        ;;
    "stop")
        stop_servers
        ;;
    "restart")
        print_status "Restarting DeepShield application..."
        stop_servers
        sleep 2
        start_backend
        start_frontend
        show_status
        ;;
    "status")
        show_status
        ;;
    "install")
        print_status "Installing dependencies..."
        check_python
        check_pip
        install_backend_deps
        create_directories
        print_success "Installation complete"
        ;;
    "help"|"-h"|"--help")
        show_help
        ;;
    *)
        print_error "Unknown command: $1"
        show_help
        exit 1
        ;;
esac

