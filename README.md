# 🔒 WakyTalky - End-to-End Encrypted Messenger

A secure, real-time messaging app with **zero-knowledge encryption**. Messages are encrypted on your device - the server never sees your conversations.

[![Live Demo](https://img.shields.io/badge/Live-Demo-blue?style=for-the-badge)](https://wakytalky.vercel.app)
[![GitHub](https://img.shields.io/badge/GitHub-Repository-181717?style=for-the-badge&logo=github)](https://github.com/haaaddhiii/WakyTalky)
[![Security](https://img.shields.io/badge/Security-8%2F10-green?style=for-the-badge&logo=shield)](https://github.com/haaaddhiii/WakyTalky/blob/main/SECURITY.md)
[![Status](https://img.shields.io/badge/Status-Beta-yellow?style=for-the-badge)](https://wakytalky.vercel.app)

**🌐 Live App:** [wakytalky.vercel.app](https://wakytalky.vercel.app)  
**📱 Repository:** [github.com/haaaddhiii/WakyTalky](https://github.com/haaaddhiii/WakyTalky)

> A learning project demonstrating end-to-end encryption, zero-knowledge architecture, and modern full-stack development.

---

## ✨ Features

### Security
- 🔒 **End-to-End Encryption** - AES-256-GCM encryption
- 🔐 **Zero-Knowledge Server** - Server can't read your messages
- 🛡️ **Strong Password Policy** - 8+ characters with complexity requirements
- ⚡ **Rate Limiting** - Protection against brute force attacks
- 🔑 **Secure Authentication** - JWT tokens with bcrypt password hashing

### Messaging
- 💬 **Real-time Chat** - Instant message delivery via WebSocket
- 📱 **Recent Chats** - See your conversation history
- 🔍 **User Search** - Find and start conversations
- 🌙 **Dark Mode** - Automatically follows system theme
- 📲 **Mobile Responsive** - Works great on phones and tablets

### Platforms
- 🌐 **Web App** - React-based web interface
- 📱 **Android App** - WebView wrapper (APK available)
- 💻 **Desktop** - Works in any modern browser

---

## 🚀 Tech Stack

**Frontend:**
- React 18.2.0
- WebSocket for real-time communication
- Web Crypto API for encryption
- Vercel deployment

**Backend:**
- Node.js + Express
- WebSocket (ws)
- MongoDB (Atlas)
- JWT authentication
- bcrypt password hashing
- Railway deployment

**Security:**
- Helmet.js (security headers)
- express-rate-limit
- CORS whitelist
- Input validation & sanitization

---

## 🏗️ Architecture

```
┌─────────────┐
│   Client    │  ← Encryption happens here
│  (Browser)  │  ← Keys never leave device
└──────┬──────┘
       │ HTTPS/WSS (encrypted data only)
       ▼
┌─────────────┐
│   Server    │  ← Only routes encrypted messages
│  (Railway)  │  ← Zero-knowledge architecture
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  MongoDB    │  ← Stores encrypted messages
│   (Atlas)   │  ← Cannot decrypt content
└─────────────┘
```

---

## 🔐 How Encryption Works

1. **Key Derivation**: SHA-256 hash of both usernames creates a shared secret
2. **Message Encryption**: Each message encrypted with AES-256-GCM
3. **Unique IVs**: Random 96-bit IV per message ensures unique ciphertext
4. **Server Storage**: Only ciphertext + IV stored, never plaintext
5. **Decryption**: Recipient derives same key and decrypts locally

**Result:** End-to-end encryption without complex key exchange protocols.

---

## 📦 Project Structure

```
wakytalky/
├── backend/
│   ├── server.js           # Express + WebSocket server
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.js          # Main React component
│   │   └── App.css         # Styling
│   └── public/
│       ├── simpleCrypto.js # E2E encryption library
│       └── index.html
└── mobile/
    ├── App.js              # React Native WebView
    ├── app.json            # Expo config
    └── assets/
        └── icon.png        # App icon
```

---

## 🛠️ Local Development

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)
- Git

### Setup

1. **Clone the repository**
```bash
git clone https://github.com/haaaddhiii/WakyTalky.git
cd WakyTalky
```

2. **Backend Setup**
```bash
cd backend
npm install

# Create .env file
echo "MONGODB_URI=your_mongodb_uri
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex')")
PORT=3001" > .env

# Start server
npm start
```

3. **Frontend Setup**
```bash
cd frontend
npm install

# Create .env file
echo "REACT_APP_API_URL=http://localhost:3001
REACT_APP_WS_URL=ws://localhost:3001" > .env

# Start dev server
npm start
```

4. **Visit** http://localhost:3000

---

## ☁️ Deployment

### Backend (Railway)

1. Create new project on [Railway](https://railway.app)
2. Connect your GitHub repository
3. Set environment variables:
   ```
   MONGODB_URI=your_mongodb_atlas_uri
   JWT_SECRET=your_secure_random_secret (64+ chars)
   NODE_ENV=production
   PORT=3001
   ```
4. Deploy automatically on push

### Frontend (Vercel)

1. Import project on [Vercel](https://vercel.com)
2. Set environment variables:
   ```
   REACT_APP_API_URL=https://your-railway-url.up.railway.app
   REACT_APP_WS_URL=wss://your-railway-url.up.railway.app
   CI=false
   ```
3. Deploy automatically on push

### Mobile (Android APK)

1. Update `mobile/app.json` with your backend URL
2. Run:
   ```bash
   cd mobile
   npm install
   eas build --platform android --profile preview
   ```
3. Download and distribute APK

---

## 🔒 Security Features

### Implemented
- ✅ End-to-end encryption (AES-256-GCM)
- ✅ Rate limiting (5 login attempts / 15 min)
- ✅ Strong password policy (8+ chars, uppercase, lowercase, number)
- ✅ Input validation & sanitization
- ✅ CORS whitelist
- ✅ Security headers (Helmet.js)
- ✅ JWT authentication
- ✅ bcrypt password hashing
- ✅ Zero-knowledge architecture

### Password Requirements
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- Not a common password

### Username Requirements
- 3-20 characters
- Letters, numbers, and underscores only
- Case-insensitive (Alice = alice)

---

## 📱 Mobile App

The Android app is a WebView wrapper that loads the web app:

**Benefits:**
- ✅ One codebase for all platforms
- ✅ Instant updates (no app store approval)
- ✅ Same security as web version
- ✅ Native app experience

**Download:** Check Releases for APK

---

## ⚠️ Security Disclaimer

**Current Status:** Beta / Educational Project

**Good for:**
- ✅ Personal use
- ✅ Small friend/family groups
- ✅ Learning E2E encryption
- ✅ Portfolio projects

**Not recommended for:**
- ❌ Highly sensitive communications
- ❌ Activist/journalist use cases
- ❌ Large-scale deployment without security audit

**Known Limitations:**
- No forward secrecy (same key for all messages)
- No key rotation mechanism
- Username-based key derivation (simple but limited)

**For maximum security, use:** [Signal](https://signal.org) or [Wire](https://wire.com)

---

## 🤝 Contributing

Contributions welcome! Please:

1. Fork the repository: [github.com/haaaddhiii/WakyTalky](https://github.com/haaaddhiii/WakyTalky)
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

**Areas for improvement:**
- Add 2FA/MFA
- Implement forward secrecy
- Add group chats
- Voice/video calling
- Message deletion
- File sharing

**Before submitting:**
- [ ] Test your changes
- [ ] Update documentation
- [ ] Follow existing code style
- [ ] Add comments for complex logic

---

## 📄 License

MIT License - See LICENSE file for details

---

## 🙏 Acknowledgments

Built with:
- React
- Node.js/Express
- MongoDB
- Web Crypto API
- Railway & Vercel

Inspired by Signal Protocol for E2E encryption principles.

---

## 📞 Support

**Issues?** [Open an issue on GitHub](https://github.com/haaaddhiii/WakyTalky/issues)

**Questions?** Check out these docs:
- [SECURITY.md](https://github.com/haaaddhiii/WakyTalky/blob/main/SECURITY.md) - Detailed security architecture
- [DEPLOYMENT.md](https://github.com/haaaddhiii/WakyTalky/blob/main/DEPLOYMENT.md) - Step-by-step deployment guide

**Want to contribute?** See [Contributing](#-contributing) section above.

---

## 🎓 Learning Resources

Want to understand the crypto?
- [Web Crypto API Docs](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- [AES-GCM Explained](https://en.wikipedia.org/wiki/Galois/Counter_Mode)
- [OWASP Security Guide](https://owasp.org/www-project-top-ten/)

---

## 📊 Project Stats

- **Lines of Code:** ~2,500
- **Security Rating:** 8/10
- **Platform:** Web + Android
- **Status:** Beta

---

**Made with ❤️ for secure communications**

**GitHub:** [github.com/haaaddhiii/WakyTalky](https://github.com/haaaddhiii/WakyTalky)

**⭐ Star this repo if you found it useful!**
