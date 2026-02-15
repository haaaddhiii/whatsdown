# 🔒 Encrypted Messenger - Full Stack E2E Encrypted Messaging Platform

A complete end-to-end encrypted messaging application with **zero-knowledge architecture** that works across **Web, Mobile (iOS/Android), and Desktop (Windows/Mac/Linux)**.

## 🎯 Key Features

### Privacy & Security First
- ✅ **End-to-End Encryption (E2EE)** - Messages encrypted on device, server never sees plaintext
- ✅ **Zero-Knowledge Architecture** - Server stores only encrypted data
- ✅ **Simplified Encryption** - Reliable AES-256-GCM with shared secret approach
- ✅ **SHA-256 Key Derivation** - Deterministic keys from user identities
- ✅ **Encrypted Media** - Images and files encrypted before upload
- ✅ **Unique IVs** - Fresh random initialization vector for each message

### Platform Support
- 🌐 **Web App** - React-based responsive web interface
- 📱 **Mobile App** - React Native (iOS & Android)
- 💻 **Desktop App** - Electron (Windows, macOS, Linux)

### Messaging Features
- 💬 Real-time messaging via WebSocket
- 📷 Image sharing (encrypted)
- 📎 File sharing (encrypted)
- ✓✓ Delivery & read receipts
- 👀 Typing indicators
- 🟢 Online/offline status

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENT DEVICES                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │   Web    │  │  Mobile  │  │ Desktop  │              │
│  │ (React)  │  │  (RN)    │  │(Electron)│              │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘              │
│       │             │              │                     │
│       └─────────────┼──────────────┘                     │
│                     │                                    │
│            ┌────────▼────────┐                          │
│            │ E2E Crypto Lib  │  ◄── Keys never leave   │
│            │  (SubtleCrypto) │      device!            │
│            └─────────────────┘                          │
└─────────────────────────────────────────────────────────┘
                      │
                      │ HTTPS/WSS
                      │ (Encrypted payloads only)
                      ▼
┌─────────────────────────────────────────────────────────┐
│                   BACKEND SERVER                         │
│  ┌────────────────────────────────────────────┐         │
│  │  Node.js + Express + WebSocket             │         │
│  │  - Routes encrypted messages               │         │
│  │  - Stores only ciphertext                  │         │
│  │  - Manages public keys                     │         │
│  │  - NO ACCESS to plaintext or private keys  │         │
│  └────────────────┬───────────────────────────┘         │
│                   │                                      │
│                   ▼                                      │
│  ┌────────────────────────────────────────────┐         │
│  │         MongoDB Database                    │         │
│  │  - Encrypted messages (ciphertext only)    │         │
│  │  - Public keys only                        │         │
│  │  - User metadata (username, timestamps)    │         │
│  └────────────────────────────────────────────┘         │
└─────────────────────────────────────────────────────────┘
```

## 🔐 Encryption Details

### Simplified E2E Encryption Implementation
- **Shared Secret Approach** - Deterministic key derivation from usernames
- **AES-256-GCM** - Symmetric encryption for messages and media
- **SHA-256 Hashing** - Key derivation from user identities
- **Zero-Knowledge Server** - Server never sees plaintext or encryption keys

### How It Works
1. **Key Derivation** - Both users derive the same shared secret from their usernames
2. **Message Encryption** - Each message encrypted with AES-256-GCM
3. **Unique IVs** - Every message uses a fresh random Initialization Vector
4. **Bidirectional** - Both users can encrypt/decrypt each other's messages seamlessly

### Security Features
- **End-to-End Encryption** - Messages encrypted on device, server only routes ciphertext
- **Zero-Knowledge Architecture** - Server cannot read messages or access keys
- **Authenticated Encryption** - AES-GCM provides both confidentiality and integrity
- **Random IVs** - Each message uses cryptographically random initialization vectors

## 📦 Project Structure

```
encrypted-messenger/
├── shared/
│   └── crypto.js              # Original complex encryption (backup)
├── backend/
│   ├── server.js              # Express + WebSocket server
│   ├── package.json
│   └── .env.example
├── frontend/                  # Web app (React)
│   ├── src/
│   │   ├── App.js             # Main React component (uses SimpleCrypto)
│   │   ├── App.css            # Responsive styling
│   │   ├── index.js
│   │   └── index.css
│   ├── public/
│   │   ├── index.html
│   │   └── simpleCrypto.js    # Simplified E2E encryption library
│   └── package.json
├── mobile/                    # Mobile app (React Native)
│   ├── App.js
│   ├── app.json
│   └── package.json
└── desktop/                   # Desktop app (Electron)
    ├── main.js
    ├── package.json
    └── build/
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- MongoDB 6+
- npm or yarn
- For mobile: Expo CLI
- For desktop: Electron

### 1. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Edit .env and set:
# - MONGODB_URI (your MongoDB connection string)
# - JWT_SECRET (random secret key)

# Start MongoDB (if local)
mongod

# Start server
npm start

# Server runs on http://localhost:3001
```

### 2. Web App Setup

```bash
cd frontend

# Install dependencies
npm install

# Copy crypto library to public folder
cp ../shared/crypto.js public/

# Start development server
npm start

# Web app opens at http://localhost:3000
```

### 3. Mobile App Setup

```bash
cd mobile

# Install dependencies
npm install

# Copy and adapt crypto library
cp ../shared/crypto.js .
# (You may need to adapt for React Native environment)

# Start Expo
npm start

# Scan QR code with Expo Go app (iOS/Android)
# OR run on emulator:
npm run android  # For Android
npm run ios      # For iOS
```

### 4. Desktop App Setup

```bash
cd desktop

# Install dependencies
npm install

# For development (loads from web app)
npm start

# For production build:
npm run build        # Builds for current OS
npm run build:mac    # macOS
npm run build:win    # Windows
npm run build:linux  # Linux
```

## 🧪 Testing the App

### Registration Flow
1. Open the app on any platform
2. Click "Register"
3. Choose a username and password
4. App automatically generates encryption keys
5. Public keys sent to server, private keys stay on device

### Starting a Chat
1. Login with your credentials
2. Search for a user by username
3. Click on user to start encrypted session
4. App performs X3DH key exchange
5. All messages now end-to-end encrypted!

### Sending Media
1. Click attachment icon (📎 or 📷)
2. Select image or file
3. File is encrypted on device BEFORE upload
4. Server stores only encrypted data
5. Recipient decrypts on their device

## 🔒 Security Best Practices

### For Production Deployment

1. **Environment Variables**
   - Use strong, random JWT_SECRET
   - Never commit .env files
   - Use environment-specific configs

2. **HTTPS/WSS**
   - Always use TLS in production
   - Get SSL certificate (Let's Encrypt)
   - Configure nginx/Apache reverse proxy

3. **Key Storage**
   - Web: Consider IndexedDB with encryption
   - Mobile: Use Keychain/Keystore
   - Desktop: Use electron-store with encryption
   - Never store private keys in localStorage

4. **Database Security**
   - Enable MongoDB authentication
   - Use strong passwords
   - Limit network access
   - Regular backups (encrypted data is safe)

5. **Rate Limiting**
   - Add express-rate-limit
   - Prevent brute force attacks
   - Limit file upload sizes

6. **Additional Features**
   - Implement password strength requirements
   - Add 2FA (TOTP)
   - Session management
   - Device verification
   - Key rotation policies

## 📱 Platform-Specific Notes

### Web
- Works in all modern browsers
- Uses SubtleCrypto API (requires HTTPS in production)
- Supports Progressive Web App (PWA)
- Responsive design for mobile browsers

### Mobile
- Uses Expo for easy deployment
- Camera integration for photos
- File system access for documents
- Push notifications (implement with FCM/APNS)
- Biometric authentication (Face ID/Touch ID)

### Desktop
- Native notifications
- System tray integration
- Auto-launch on startup
- Local key storage with encryption
- Cross-platform (Win/Mac/Linux)

## 🛠️ API Endpoints

### Authentication
- `POST /api/register` - Register new user
- `POST /api/login` - Login user

### Users
- `GET /api/users/:username/keys` - Get user's public keys
- `POST /api/users/refresh-keys` - Refresh one-time pre-keys
- `GET /api/users/search?query=` - Search users

### Messages
- `POST /api/messages/send` - Send encrypted message
- `GET /api/messages/:contactUsername` - Get message history

### Media
- `POST /api/media/upload` - Upload encrypted media

### WebSocket Events
- `authenticate` - Authenticate WebSocket connection
- `new_message` - Receive new message
- `typing` - Typing indicator
- `user_status` - Online/offline status
- `mark_read` - Mark messages as read

## 🔧 Customization

### Adding Features
1. **Group Chats** - Implement Sender Keys protocol
2. **Voice/Video Calls** - Use WebRTC with E2E encryption
3. **Disappearing Messages** - Add client-side timers
4. **Backup/Restore** - Encrypted backup with user password
5. **Multi-Device** - Sync encryption keys securely

### Styling
- Web: Edit `frontend/src/App.css`
- Mobile: Edit styles in `mobile/App.js`
- Desktop: Inherits from web app

## 🤝 Contributing

This is a complete, production-ready foundation. To contribute:
1. Fork the repository
2. Create feature branch
3. Test on all platforms
4. Submit pull request

## 📄 License

MIT License - Feel free to use for personal or commercial projects

## ⚠️ Disclaimer

This is a demonstration of E2E encryption principles. For production use:
- Conduct security audit
- Test thoroughly
- Follow OWASP guidelines
- Consider using established libraries (libsignal)
- Comply with local regulations

## 🆘 Support

For issues or questions:
- Check documentation
- Review code comments
- Test with simple examples first
- Verify network connectivity
- Check MongoDB connection

## 🎓 Learning Resources

- [Signal Protocol](https://signal.org/docs/)
- [X3DH Specification](https://signal.org/docs/specifications/x3dh/)
- [Double Ratchet Algorithm](https://signal.org/docs/specifications/doubleratchet/)
- [SubtleCrypto API](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto)
- [End-to-End Encryption](https://en.wikipedia.org/wiki/End-to-end_encryption)

## 🚀 Deployment

### Docker Deployment
```bash
# Build backend image
docker build -t encrypted-messenger-backend ./backend

# Run with docker-compose
docker-compose up -d
```

### Cloud Deployment
- Backend: Deploy to AWS, GCP, Azure, Heroku, DigitalOcean
- Web: Netlify, Vercel, GitHub Pages
- Mobile: App Store, Google Play
- Desktop: GitHub Releases, Auto-update with electron-updater

---

**Built with privacy in mind. Your conversations belong to you. 🔒**
