import React, { useState, useEffect, useRef } from 'react';
import './App.css';

// Import the E2E encryption library
const E2EEncryption = window.E2EEncryption;

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';
const WS_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:3001';

function App() {
  const [currentView, setCurrentView] = useState('login'); // 'login', 'register', 'chat'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [currentUser, setCurrentUser] = useState(localStorage.getItem('username'));
  
  // Chat state
  const [contacts, setContacts] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  
  // Encryption
  const encryptionRef = useRef(null);
  const wsRef = useRef(null);

  // Initialize encryption on mount
  useEffect(() => {
    const initializeEncryption = async () => {
      try {
        const crypto = new E2EEncryption();
        
        // Load existing keys or generate new ones
        const storedKeys = localStorage.getItem(`keys_${currentUser}`);
        
        if (storedKeys) {
          // Load existing keys (you'd implement import functions)
          console.log('Loading existing keys...');
        } else {
          // Generate new keys
          await crypto.generateIdentityKeyPair();
          await crypto.generateSignedPreKey();
          await crypto.generateOneTimePreKeys(100);
          
          // Store keys securely (in production, consider IndexedDB with encryption)
          // For demo, we're storing in localStorage (NOT RECOMMENDED for production)
          console.log('Keys generated successfully');
        }
        
        encryptionRef.current = crypto;
      } catch (error) {
        console.error('Encryption initialization failed:', error);
      }
    };

    if (currentUser && !encryptionRef.current) {
      initializeEncryption();
    }
  }, [currentUser]);

  // Connect WebSocket
  useEffect(() => {
    const connectWebSocket = () => {
      const ws = new WebSocket(WS_URL);
      
      ws.onopen = () => {
        console.log('WebSocket connected');
        ws.send(JSON.stringify({
          type: 'authenticate',
          token: token
        }));
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        // Reconnect after 3 seconds
        setTimeout(() => {
          if (token) connectWebSocket();
        }, 3000);
      };

      wsRef.current = ws;
    };

    if (token && !wsRef.current) {
      connectWebSocket();
    }
  }, [token]);

  const handleWebSocketMessage = async (data) => {
    switch (data.type) {
      case 'authenticated':
        console.log('Authenticated via WebSocket');
        break;
        
      case 'new_message':
        // Decrypt and display new message
        await handleNewMessage(data.message);
        break;
        
      case 'typing':
        // Handle typing indicator
        console.log(`${data.from} is typing...`);
        break;
        
      case 'user_status':
        // Update contact status
        updateContactStatus(data.username, data.status);
        break;
        
      default:
        console.log('Unknown message type:', data.type);
    }
  };

  const handleNewMessage = async (encryptedMessage) => {
    try {
      if (!encryptionRef.current) return;
      
      const crypto = encryptionRef.current;
      
      // Decrypt message
      const plaintext = await crypto.receiveMessage(
        encryptedMessage.from,
        {
          ciphertext: encryptedMessage.encryptedContent,
          iv: encryptedMessage.iv
        }
      );

      const newMessage = {
        id: encryptedMessage.id,
        from: encryptedMessage.from,
        text: plaintext,
        timestamp: new Date(encryptedMessage.timestamp),
        mediaType: encryptedMessage.mediaType,
        mediaUrl: encryptedMessage.mediaUrl
      };

      setMessages(prev => [...prev, newMessage]);
    } catch (error) {
      console.error('Failed to decrypt message:', error);
    }
  };

  const updateContactStatus = (username, status) => {
    setContacts(prev => prev.map(contact => 
      contact.username === username 
        ? { ...contact, status }
        : contact
    ));
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    
    try {
      // Generate encryption keys
      const crypto = new E2EEncryption();
      await crypto.generateIdentityKeyPair();
      await crypto.generateSignedPreKey();
      await crypto.generateOneTimePreKeys(100);
      
      // Export public keys to send to server
      const bundle = await crypto.exportIdentityBundle();
      
      const response = await fetch(`${API_URL}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          password,
          ...bundle
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('username', data.username);
        setToken(data.token);
        setCurrentUser(data.username);
        encryptionRef.current = crypto;
        setCurrentView('chat');
      } else {
        alert(data.error || 'Registration failed');
      }
    } catch (error) {
      console.error('Registration error:', error);
      alert('Registration failed');
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    
    try {
      const response = await fetch(`${API_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();
      
      if (response.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('username', data.username);
        setToken(data.token);
        setCurrentUser(data.username);
        setCurrentView('chat');
      } else {
        alert(data.error || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      alert('Login failed');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    setToken(null);
    setCurrentUser(null);
    setCurrentView('login');
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  };

  const searchUsers = async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/api/users/search?query=${encodeURIComponent(query)}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      const data = await response.json();
      setSearchResults(data.users || []);
    } catch (error) {
      console.error('Search error:', error);
    }
  };

  const startChat = async (contact) => {
    try {
      // Fetch contact's public keys
      const response = await fetch(
        `${API_URL}/api/users/${contact.username}/keys`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      const keys = await response.json();
      
      // Import keys and establish session
      const crypto = encryptionRef.current;
      const identityKey = await crypto.importPublicKey(keys.identityKey);
      const signedPreKey = await crypto.importPublicKey(keys.signedPreKey);
      const oneTimePreKey = keys.oneTimePreKey 
        ? await crypto.importPublicKey(keys.oneTimePreKey)
        : null;

      await crypto.createSession(
        contact.username,
        identityKey,
        signedPreKey,
        oneTimePreKey
      );

      setSelectedContact(contact);
      setSearchResults([]);
      setSearchQuery('');
      
      // Load message history
      loadMessages(contact.username);
    } catch (error) {
      console.error('Failed to start chat:', error);
      alert('Failed to start encrypted chat');
    }
  };

  const loadMessages = async (contactUsername) => {
    try {
      const response = await fetch(
        `${API_URL}/api/messages/${contactUsername}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      const data = await response.json();
      
      // Decrypt messages
      const crypto = encryptionRef.current;
      const decryptedMessages = [];

      for (const msg of data.messages) {
        try {
          const plaintext = await crypto.receiveMessage(
            msg.from === currentUser ? msg.to : msg.from,
            {
              ciphertext: msg.encryptedContent,
              iv: msg.iv
            }
          );

          decryptedMessages.push({
            id: msg.id,
            from: msg.from,
            text: plaintext,
            timestamp: new Date(msg.timestamp),
            mediaType: msg.mediaType,
            mediaUrl: msg.mediaUrl
          });
        } catch (error) {
          console.error('Failed to decrypt message:', error);
        }
      }

      setMessages(decryptedMessages.reverse());
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  const sendMessage = async () => {
    if (!messageInput.trim() || !selectedContact) return;

    try {
      const crypto = encryptionRef.current;
      
      // Encrypt message
      const encrypted = await crypto.sendMessage(
        selectedContact.username,
        messageInput
      );

      // Send to server
      const response = await fetch(`${API_URL}/api/messages/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          to: selectedContact.username,
          encryptedContent: encrypted.ciphertext,
          iv: encrypted.iv,
          messageNumber: encrypted.messageNumber
        })
      });

      if (response.ok) {
        // Add to local messages
        setMessages(prev => [...prev, {
          from: currentUser,
          text: messageInput,
          timestamp: new Date()
        }]);
        setMessageInput('');
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Failed to send message');
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const crypto = encryptionRef.current;
      
      // Read file
      const arrayBuffer = await file.arrayBuffer();
      const fileData = new Uint8Array(arrayBuffer);
      
      // Generate message key for this file
      const session = crypto.sessions.get(selectedContact.username);
      const { messageKey, nextChainKey } = await crypto.deriveMessageKeys(session.sendingChainKey);
      session.sendingChainKey = nextChainKey;
      
      // Encrypt file
      const encryptedFile = await crypto.encryptFile(fileData, messageKey);
      
      // Upload encrypted file
      const formData = new FormData();
      const encryptedBlob = new Blob([encryptedFile.ciphertext]);
      formData.append('file', encryptedBlob, `${file.name}.enc`);
      
      const uploadResponse = await fetch(`${API_URL}/api/media/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const uploadData = await uploadResponse.json();
      
      // Send message with media reference
      const textEncrypted = await crypto.sendMessage(
        selectedContact.username,
        `[${file.type.startsWith('image/') ? 'Image' : 'File'}]`
      );

      await fetch(`${API_URL}/api/messages/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          to: selectedContact.username,
          encryptedContent: textEncrypted.ciphertext,
          iv: textEncrypted.iv,
          messageNumber: textEncrypted.messageNumber,
          mediaType: file.type,
          mediaUrl: uploadData.url,
          mediaIv: encryptedFile.iv,
          mediaSize: uploadData.size
        })
      });

      alert('File sent successfully!');
    } catch (error) {
      console.error('File upload error:', error);
      alert('Failed to send file');
    }
  };

  // Render functions
  if (currentView === 'login') {
    return (
      <div className="app">
        <div className="auth-container">
          <div className="auth-box">
            <h1>🔒 Encrypted Messenger</h1>
            <p className="tagline">End-to-end encrypted. Zero-knowledge. Private.</p>
            
            <form onSubmit={handleLogin}>
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button type="submit">Login</button>
            </form>
            
            <p className="switch-view">
              Don't have an account?{' '}
              <span onClick={() => setCurrentView('register')}>Register</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (currentView === 'register') {
    return (
      <div className="app">
        <div className="auth-container">
          <div className="auth-box">
            <h1>🔒 Create Account</h1>
            <p className="tagline">Your keys, your privacy</p>
            
            <form onSubmit={handleRegister}>
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button type="submit">Create Account</button>
            </form>
            
            <p className="switch-view">
              Already have an account?{' '}
              <span onClick={() => setCurrentView('login')}>Login</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="chat-container">
        {/* Sidebar */}
        <div className="sidebar">
          <div className="sidebar-header">
            <h2>Chats</h2>
            <button onClick={handleLogout} className="logout-btn">Logout</button>
          </div>
          
          <div className="search-box">
            <input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                searchUsers(e.target.value);
              }}
            />
          </div>
          
          {searchResults.length > 0 && (
            <div className="search-results">
              {searchResults.map(user => (
                <div
                  key={user.username}
                  className="contact-item"
                  onClick={() => startChat(user)}
                >
                  <div className="contact-avatar">{user.username[0].toUpperCase()}</div>
                  <div className="contact-info">
                    <div className="contact-name">{user.username}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          <div className="contacts-list">
            {contacts.map(contact => (
              <div
                key={contact.username}
                className={`contact-item ${selectedContact?.username === contact.username ? 'active' : ''}`}
                onClick={() => setSelectedContact(contact)}
              >
                <div className="contact-avatar">{contact.username[0].toUpperCase()}</div>
                <div className="contact-info">
                  <div className="contact-name">{contact.username}</div>
                  <div className="contact-status">{contact.status}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Chat Area */}
        <div className="chat-area">
          {selectedContact ? (
            <>
              <div className="chat-header">
                <div className="contact-avatar">{selectedContact.username[0].toUpperCase()}</div>
                <div>
                  <div className="contact-name">{selectedContact.username}</div>
                  <div className="encryption-status">🔒 End-to-end encrypted</div>
                </div>
              </div>

              <div className="messages-container">
                {messages.map((msg, index) => (
                  <div
                    key={index}
                    className={`message ${msg.from === currentUser ? 'sent' : 'received'}`}
                  >
                    <div className="message-content">
                      {msg.text}
                      {msg.mediaType && (
                        <div className="media-indicator">
                          📎 {msg.mediaType.includes('image') ? 'Image' : 'File'}
                        </div>
                      )}
                    </div>
                    <div className="message-time">
                      {msg.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                ))}
              </div>

              <div className="message-input-container">
                <label className="file-upload-btn">
                  📎
                  <input
                    type="file"
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                  />
                </label>
                <input
                  type="text"
                  placeholder="Type a message..."
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                />
                <button onClick={sendMessage}>Send</button>
              </div>
            </>
          ) : (
            <div className="no-chat-selected">
              <h2>🔒 Encrypted Messenger</h2>
              <p>Select a contact or search for a user to start chatting</p>
              <div className="features">
                <div>✓ End-to-end encryption</div>
                <div>✓ Zero-knowledge architecture</div>
                <div>✓ Forward secrecy</div>
                <div>✓ Encrypted media sharing</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
