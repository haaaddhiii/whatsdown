/**
 * Zero-Knowledge Encrypted Messaging Backend - SECURITY HARDENED
 * Server NEVER has access to:
 * - Message plaintext
 * - User encryption keys
 * - Decrypted media files
 * 
 * Security Features:
 * - Rate limiting on auth endpoints
 * - Helmet.js security headers
 * - CORS whitelist
 * - Strong password policy
 * - Input sanitization
 */

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const validator = require('validator');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// ============================================
// CRITICAL FIX #1: Security Headers (Helmet)
// ============================================
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:", "https:"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true
  }
}));

// ============================================
// CRITICAL FIX #2: CORS Whitelist
// ============================================
const allowedOrigins = [
  'https://wakytalky.vercel.app',
  'http://localhost:3000',  // Development
  'http://localhost:3001'   // Development
];

// Add production domain from environment variable
if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`🚫 Blocked CORS request from: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// ============================================
// CRITICAL FIX #3: Rate Limiting
// ============================================

// General API rate limit (100 requests per 15 minutes)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict rate limit for login (5 attempts per 15 minutes)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts, please try again in 15 minutes',
  skipSuccessfulRequests: true, // Don't count successful logins
});

// Strict rate limit for registration (3 accounts per hour per IP)
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: 'Too many accounts created, please try again later',
});

// Apply general rate limiting to all API routes
app.use('/api/', apiLimiter);

// Body parsing with reasonable limits
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use('/uploads', express.static('uploads'));

// MongoDB Models
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  identityKey: { type: String, required: true }, // Public only
  signedPreKey: { type: String, required: true }, // Public only
  oneTimePreKeys: [{ type: String }], // Public only
  createdAt: { type: Date, default: Date.now },
  lastSeen: { type: Date, default: Date.now }
});

const messageSchema = new mongoose.Schema({
  from: { type: String, required: true },
  to: { type: String, required: true },
  encryptedContent: { type: String, required: true }, // Base64 ciphertext
  iv: { type: String, required: true },
  messageNumber: { type: Number, required: true },
  ephemeralKey: { type: String }, // For initial messages
  timestamp: { type: Date, default: Date.now },
  delivered: { type: Boolean, default: false },
  read: { type: Boolean, default: false },
  mediaType: { type: String }, // 'image', 'file', etc.
  mediaUrl: { type: String }, // Encrypted media location
  mediaIv: { type: String }, // IV for media encryption
  mediaSize: { type: Number }
});

const User = mongoose.model('User', userSchema);
const Message = mongoose.model('Message', messageSchema);

// Configure multer for encrypted file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = 'uploads/encrypted';
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    // Random filename - no connection to original
    cb(null, `${uuidv4()}.enc`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// WebSocket connections
const clients = new Map(); // username -> WebSocket

// ============================================
// JWT Secret Validation
// ============================================
const JWT_SECRET = process.env.JWT_SECRET;

// Enforce strong JWT secret in production
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error('❌ CRITICAL: JWT_SECRET must be set in environment variables and be at least 32 characters long');
  console.error('💡 Generate one with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
  
  // Use fallback only in development
  if (process.env.NODE_ENV === 'production') {
    console.error('🚨 Cannot start in production without secure JWT_SECRET');
    process.exit(1);
  } else {
    console.warn('⚠️  Using default JWT_SECRET for development only');
  }
}

const EFFECTIVE_JWT_SECRET = JWT_SECRET || 'dev-secret-DO-NOT-USE-IN-PRODUCTION';

// Middleware to verify JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, EFFECTIVE_JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// ============================================
// CRITICAL FIX #4: Input Validation & Sanitization
// ============================================

/**
 * Validate and sanitize username
 */
const validateUsername = (username) => {
  if (!username || typeof username !== 'string') {
    return { valid: false, error: 'Username is required' };
  }

  // Trim and escape
  const cleaned = validator.trim(username);
  
  // Length check
  if (cleaned.length < 3 || cleaned.length > 20) {
    return { valid: false, error: 'Username must be 3-20 characters' };
  }

  // Format check (alphanumeric and underscore only)
  if (!/^[a-zA-Z0-9_]+$/.test(cleaned)) {
    return { valid: false, error: 'Username can only contain letters, numbers, and underscores' };
  }

  // Reserved names
  const reserved = ['admin', 'root', 'system', 'wakytalky', 'support', 'help'];
  if (reserved.includes(cleaned.toLowerCase())) {
    return { valid: false, error: 'Username not available' };
  }

  return { valid: true, value: cleaned };
};

/**
 * Validate password strength
 */
const validatePassword = (password) => {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Password is required' };
  }

  // Minimum length
  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters' };
  }

  // Maximum length (prevent DoS)
  if (password.length > 128) {
    return { valid: false, error: 'Password too long (max 128 characters)' };
  }

  // Require uppercase
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one uppercase letter' };
  }

  // Require lowercase
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one lowercase letter' };
  }

  // Require number
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one number' };
  }

  // Check against common passwords
  const commonPasswords = [
    'password', '12345678', 'qwerty123', 'password123', 
    'admin123', 'letmein1', 'welcome1', 'monkey123'
  ];
  if (commonPasswords.includes(password.toLowerCase())) {
    return { valid: false, error: 'Password is too common, please choose a stronger one' };
  }

  return { valid: true };
};

/**
 * Sanitize message content to prevent XSS
 */
const sanitizeMessage = (text) => {
  if (!text || typeof text !== 'string') {
    return '';
  }
  // Escape HTML but allow the encrypted content to pass through
  return validator.escape(text.substring(0, 10000)); // Limit length
};

// ============================================
// API ENDPOINTS
// ============================================

/**
 * Register new user - WITH SECURITY VALIDATIONS
 * Server stores: username, password hash, PUBLIC keys only
 */
app.post('/api/register', registerLimiter, async (req, res) => {
  try {
    const { username, password, identityKey, signedPreKey, oneTimePreKeys } = req.body;

    // Validate username
    const usernameValidation = validateUsername(username);
    if (!usernameValidation.valid) {
      return res.status(400).json({ error: usernameValidation.error });
    }
    const cleanUsername = usernameValidation.value;

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({ error: passwordValidation.error });
    }

    // Validate required encryption keys
    if (!identityKey || !signedPreKey || !oneTimePreKeys) {
      return res.status(400).json({ error: 'Missing encryption keys' });
    }

    // Check if user exists (case-insensitive)
    const existingUser = await User.findOne({ 
      username: { $regex: new RegExp(`^${cleanUsername}$`, 'i') }
    });
    if (existingUser) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    // Hash password with bcrypt (cost factor 10)
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user with sanitized username
    const user = new User({
      username: cleanUsername,
      passwordHash,
      identityKey,
      signedPreKey,
      oneTimePreKeys
    });

    await user.save();

    // Generate JWT
    const token = jwt.sign({ username: cleanUsername }, EFFECTIVE_JWT_SECRET, { expiresIn: '7d' });

    console.log(`✅ New user registered: ${cleanUsername}`);

    res.status(201).json({
      message: 'User registered successfully',
      token,
      username: cleanUsername
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

/**
 * Login - WITH RATE LIMITING & VALIDATION
 */
app.post('/api/login', loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validate inputs
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    // Sanitize username
    const cleanUsername = validator.trim(username);

    // Find user (case-insensitive)
    const user = await User.findOne({ 
      username: { $regex: new RegExp(`^${cleanUsername}$`, 'i') }
    });

    // Always hash password even if user doesn't exist (prevent timing attacks)
    const hash = user ? user.passwordHash : await bcrypt.hash('dummy-password', 10);
    const validPassword = await bcrypt.compare(password, hash);

    // Check both user existence and password validity
    if (!user || !validPassword) {
      // Same error message for security (don't reveal if username exists)
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last seen
    user.lastSeen = new Date();
    await user.save();

    // Generate JWT
    const token = jwt.sign({ username: user.username }, EFFECTIVE_JWT_SECRET, { expiresIn: '7d' });

    console.log(`✅ User logged in: ${user.username}`);

    res.json({
      message: 'Login successful',
      token,
      username: user.username
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * Get user's public key bundle
 * Required for initiating encrypted conversation
 */
app.get('/api/users/:username/keys', authenticateToken, async (req, res) => {
  try {
    const { username } = req.params;

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Pop one one-time pre-key (single use)
    const oneTimePreKey = user.oneTimePreKeys.length > 0 
      ? user.oneTimePreKeys.shift() 
      : null;

    if (oneTimePreKey) {
      await user.save();
    }

    res.json({
      identityKey: user.identityKey,
      signedPreKey: user.signedPreKey,
      oneTimePreKey
    });
  } catch (error) {
    console.error('Error fetching keys:', error);
    res.status(500).json({ error: 'Failed to fetch keys' });
  }
});

/**
 * Refresh one-time pre-keys
 */
app.post('/api/users/refresh-keys', authenticateToken, async (req, res) => {
  try {
    const { oneTimePreKeys } = req.body;
    const username = req.user.username;

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.oneTimePreKeys.push(...oneTimePreKeys);
    await user.save();

    res.json({ message: 'Keys refreshed', count: user.oneTimePreKeys.length });
  } catch (error) {
    console.error('Error refreshing keys:', error);
    res.status(500).json({ error: 'Failed to refresh keys' });
  }
});

/**
 * Send encrypted message
 * Server only routes encrypted data, never decrypts
 */
app.post('/api/messages/send', authenticateToken, async (req, res) => {
  try {
    const { 
      to, 
      encryptedContent, 
      iv, 
      messageNumber, 
      ephemeralKey,
      mediaType,
      mediaUrl,
      mediaIv,
      mediaSize
    } = req.body;

    const from = req.user.username;

    // Verify recipient exists
    const recipient = await User.findOne({ username: to });
    if (!recipient) {
      return res.status(404).json({ error: 'Recipient not found' });
    }

    // Store encrypted message
    const message = new Message({
      from,
      to,
      encryptedContent,
      iv,
      messageNumber,
      ephemeralKey,
      mediaType,
      mediaUrl,
      mediaIv,
      mediaSize
    });

    await message.save();

    // Send via WebSocket if recipient is online
    const recipientWs = clients.get(to);
    if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
      recipientWs.send(JSON.stringify({
        type: 'new_message',
        message: {
          id: message._id,
          from,
          encryptedContent,
          iv,
          messageNumber,
          ephemeralKey,
          timestamp: message.timestamp,
          mediaType,
          mediaUrl,
          mediaIv,
          mediaSize
        }
      }));

      message.delivered = true;
      await message.save();
    }

    res.status(201).json({
      messageId: message._id,
      delivered: message.delivered,
      timestamp: message.timestamp
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

/**
 * Get message history (encrypted)
 */
app.get('/api/messages/:contactUsername', authenticateToken, async (req, res) => {
  try {
    const currentUser = req.user.username;
    const { contactUsername } = req.params;
    const { limit = 50, skip = 0 } = req.query;

    const messages = await Message.find({
      $or: [
        { from: currentUser, to: contactUsername },
        { from: contactUsername, to: currentUser }
      ]
    })
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip));

    res.json({
      messages: messages.map(m => ({
        id: m._id,
        from: m.from,
        to: m.to,
        encryptedContent: m.encryptedContent,
        iv: m.iv,
        messageNumber: m.messageNumber,
        ephemeralKey: m.ephemeralKey,
        timestamp: m.timestamp,
        delivered: m.delivered,
        read: m.read,
        mediaType: m.mediaType,
        mediaUrl: m.mediaUrl,
        mediaIv: m.mediaIv,
        mediaSize: m.mediaSize
      }))
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

/**
 * Upload encrypted media
 */
app.post('/api/media/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // File is already encrypted on client before upload
    const fileUrl = `/uploads/encrypted/${req.file.filename}`;

    res.json({
      url: fileUrl,
      size: req.file.size
    });
  } catch (error) {
    console.error('Error uploading media:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

/**
 * Search users
 */
app.get('/api/users/search', authenticateToken, async (req, res) => {
  try {
    const { query } = req.query;
    
    const users = await User.find({
      username: { $regex: query, $options: 'i' },
      username: { $ne: req.user.username } // Exclude self
    })
      .limit(20)
      .select('username lastSeen');

    res.json({
      users: users.map(u => ({
        username: u.username,
        lastSeen: u.lastSeen
      }))
    });
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// ============================================
// WEBSOCKET HANDLING
// ============================================

wss.on('connection', (ws) => {
  let username = null;

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data);

      switch (message.type) {
        case 'authenticate':
          // Verify JWT
          jwt.verify(message.token, EFFECTIVE_JWT_SECRET, (err, user) => {
            if (err) {
              ws.send(JSON.stringify({ type: 'error', message: 'Authentication failed' }));
              ws.close();
              return;
            }

            username = user.username;
            clients.set(username, ws);

            // Update user status
            User.findOneAndUpdate(
              { username },
              { lastSeen: new Date() }
            ).exec();

            ws.send(JSON.stringify({ 
              type: 'authenticated', 
              username 
            }));

            // Notify contacts that user is online
            broadcastUserStatus(username, 'online');
          });
          break;

        case 'typing':
          // Forward typing indicator
          const recipientWs = clients.get(message.to);
          if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
            recipientWs.send(JSON.stringify({
              type: 'typing',
              from: username,
              isTyping: message.isTyping
            }));
          }
          break;

        case 'mark_read':
          // Mark messages as read
          await Message.updateMany(
            { _id: { $in: message.messageIds } },
            { read: true }
          );
          
          // Notify sender
          const senderWs = clients.get(message.from);
          if (senderWs && senderWs.readyState === WebSocket.OPEN) {
            senderWs.send(JSON.stringify({
              type: 'messages_read',
              messageIds: message.messageIds,
              by: username
            }));
          }
          break;
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
    }
  });

  ws.on('close', () => {
    if (username) {
      clients.delete(username);
      broadcastUserStatus(username, 'offline');
      
      // Update last seen
      User.findOneAndUpdate(
        { username },
        { lastSeen: new Date() }
      ).exec();
    }
  });
});

function broadcastUserStatus(username, status) {
  const statusMessage = JSON.stringify({
    type: 'user_status',
    username,
    status,
    timestamp: new Date()
  });

  clients.forEach((client, clientUsername) => {
    if (clientUsername !== username && client.readyState === WebSocket.OPEN) {
      client.send(statusMessage);
    }
  });
}

// ============================================
// START SERVER
// ============================================

const PORT = process.env.PORT || 3001;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/encrypted-messenger';

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB');
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📡 WebSocket server ready`);
      console.log(`🔒 Zero-knowledge E2E encryption enabled`);
    });
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    mongoose.connection.close(false, () => {
      console.log('MongoDB connection closed');
      process.exit(0);
    });
  });
});
