/**
 * Zero-Knowledge Encrypted Messaging Backend
 * Server NEVER has access to:
 * - Message plaintext
 * - User encryption keys
 * - Decrypted media files
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
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
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

// JWT Secret (use environment variable in production)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware to verify JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// ============================================
// API ENDPOINTS
// ============================================

/**
 * Register new user
 * Server stores: username, password hash, PUBLIC keys only
 */
app.post('/api/register', async (req, res) => {
  try {
    const { username, password, identityKey, signedPreKey, oneTimePreKeys } = req.body;

    // Validate input
    if (!username || !password || !identityKey || !signedPreKey || !oneTimePreKeys) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if user exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const user = new User({
      username,
      passwordHash,
      identityKey,
      signedPreKey,
      oneTimePreKeys
    });

    await user.save();

    // Generate JWT
    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      message: 'User registered successfully',
      token,
      username
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

/**
 * Login
 */
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last seen
    user.lastSeen = new Date();
    await user.save();

    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      message: 'Login successful',
      token,
      username
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
          jwt.verify(message.token, JWT_SECRET, (err, user) => {
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
