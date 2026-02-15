#!/bin/bash

# Encrypted Messenger - Quick Setup Script
# This script sets up the development environment

set -e

echo "🔒 Encrypted Messenger - Setup Script"
echo "======================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check Node.js
echo "Checking prerequisites..."
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed${NC}"
    echo "Please install Node.js 18+ from https://nodejs.org/"
    exit 1
fi
echo -e "${GREEN}✓ Node.js found: $(node --version)${NC}"

# Check npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm is not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✓ npm found: $(npm --version)${NC}"

# Check MongoDB
if ! command -v mongod &> /dev/null; then
    echo -e "${YELLOW}⚠ MongoDB not found in PATH${NC}"
    echo "You'll need MongoDB to run the backend."
    echo "Install from: https://www.mongodb.com/try/download/community"
    echo "Or use Docker: docker run -d -p 27017:27017 mongo:7"
fi

echo ""
echo "======================================"
echo "Setting up Backend..."
echo "======================================"
cd backend

# Install backend dependencies
echo "Installing backend dependencies..."
npm install

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "Creating .env file..."
    cp .env.example .env
    
    # Generate random JWT secret
    JWT_SECRET=$(openssl rand -base64 32 2>/dev/null || cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 32 | head -n 1)
    
    # Update .env file
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s/your-super-secret-jwt-key-change-this-in-production-use-random-string/$JWT_SECRET/g" .env
    else
        sed -i "s/your-super-secret-jwt-key-change-this-in-production-use-random-string/$JWT_SECRET/g" .env
    fi
    
    echo -e "${GREEN}✓ Created .env file with random JWT secret${NC}"
fi

# Create uploads directory
mkdir -p uploads/encrypted
echo -e "${GREEN}✓ Backend setup complete${NC}"

cd ..

echo ""
echo "======================================"
echo "Setting up Frontend (Web)..."
echo "======================================"
cd frontend

# Install frontend dependencies
echo "Installing frontend dependencies..."
npm install

# Copy crypto library to public folder
echo "Copying crypto library..."
cp ../shared/crypto.js public/

echo -e "${GREEN}✓ Frontend setup complete${NC}"

cd ..

echo ""
echo "======================================"
echo "Setting up Mobile App..."
echo "======================================"
cd mobile

echo "Installing mobile dependencies..."
npm install

echo -e "${GREEN}✓ Mobile setup complete${NC}"

cd ..

echo ""
echo "======================================"
echo "Setting up Desktop App..."
echo "======================================"
cd desktop

echo "Installing desktop dependencies..."
npm install

echo -e "${GREEN}✓ Desktop setup complete${NC}"

cd ..

echo ""
echo "======================================"
echo -e "${GREEN}✅ Setup Complete!${NC}"
echo "======================================"
echo ""
echo "Next steps:"
echo ""
echo "1. Start MongoDB:"
echo "   mongod"
echo "   (or use Docker: docker run -d -p 27017:27017 mongo:7)"
echo ""
echo "2. Start Backend:"
echo "   cd backend && npm start"
echo ""
echo "3. Start Frontend (Web):"
echo "   cd frontend && npm start"
echo ""
echo "4. Start Mobile:"
echo "   cd mobile && npm start"
echo ""
echo "5. Start Desktop:"
echo "   cd desktop && npm start"
echo ""
echo "Or use Docker Compose:"
echo "   docker-compose up -d"
echo ""
echo "======================================"
echo "Access the apps:"
echo "  Web:     http://localhost:3000"
echo "  Backend: http://localhost:3001"
echo "  Mobile:  Scan QR code with Expo Go"
echo "======================================"
echo ""
echo -e "${YELLOW}Security Note:${NC}"
echo "This is a development setup. For production:"
echo "  - Use HTTPS/TLS"
echo "  - Change JWT_SECRET in .env"
echo "  - Enable MongoDB authentication"
echo "  - Review SECURITY.md"
echo ""
echo "Happy secure messaging! 🔒"
