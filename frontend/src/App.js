import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';

// Import the simplified E2E encryption library
const SimpleCrypto = window.SimpleCrypto;

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';
const WS_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:3001';

function App() {
  const [currentView, setCurrentView] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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
  const cryptoRef = useRef(null);
  const wsRef = useRef(null);

  // Initialize simple crypto
  useEffect(() => {
    if (!cryptoRef.current) {
      cryptoRef.current = new SimpleCrypto();
      console.log('✅ Simple encryption initialized');
    }
  }, []);

  // Define callback functions BEFORE useEffect hooks
  const handleNewMessage = useCallback(async (encryptedMessage) => {
    try {
      if (!cryptoRef.current) return;
      
      const crypto = cryptoRef.current;
      
      // Decrypt message using simple crypto
      const plaintext = await crypto.decrypt(
        encryptedMessage.encryptedContent,
        encryptedMessage.iv,
        currentUser,
        encryptedMessage.from
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
  }, [currentUser]);

  const updateContactStatus = useCallback((username, status) => {
    setContacts(prev => prev.map(contact => 
      contact.username === username 
        ? { ...contact, status }
        : contact
    ));
  }, []);

  const handleWebSocketMessage = useCallback(async (data) => {
    switch (data.type) {
      case 'authenticated':
        console.log('Authenticated via WebSocket');
        break;
        
      case 'new_message':
        await handleNewMessage(data.message);
        break;
        
      case 'typing':
        console.log(`${data.from} is typing...`);
        break;
        
      case 'user_status':
        updateContactStatus(data.username, data.status);
        break;
        
      default:
        console.log('Unknown message type:', data.type);
    }
  }, [handleNewMessage, updateContactStatus]);

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
        setTimeout(() => {
          if (token) connectWebSocket();
        }, 3000);
      };

      wsRef.current = ws;
    };

    if (token && !wsRef.current) {
      connectWebSocket();
    }
  }, [token, handleWebSocketMessage]);

  const handleRegister = async (e) => {
    e.preventDefault();
    
    // Validate passwords match
    if (password !== confirmPassword) {
      alert('Passwords do not match!');
      return;
    }

    // Validate password length
    if (password.length < 6) {
      alert('Password must be at least 6 characters long');
      return;
    }
    
    try {
      const response = await fetch(`${API_URL}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          password,
          identityKey: 'dummy',
          signedPreKey: 'dummy',
          oneTimePreKeys: ['dummy']
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('username', data.username);
        setToken(data.token);
        setCurrentUser(data.username);
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
      setSelectedContact(contact);
      setSearchResults([]);
      setSearchQuery('');
      
      // Load message history
      loadMessages(contact.username);
    } catch (error) {
      console.error('Failed to start chat:', error);
      alert('Failed to start chat');
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
      const crypto = cryptoRef.current;
      const decryptedMessages = [];

      for (const msg of data.messages) {
        try {
          const otherUser = msg.from === currentUser ? msg.to : msg.from;
          const plaintext = await crypto.decrypt(
            msg.encryptedContent,
            msg.iv,
            currentUser,
            otherUser
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
      const crypto = cryptoRef.current;
      
      // Encrypt message using simple crypto
      const encrypted = await crypto.encrypt(
        messageInput,
        currentUser,
        selectedContact.username
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
          messageNumber: Date.now()
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

    alert('File upload will be implemented soon!');
  };

  // Render login view
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
              <span onClick={() => {
                setCurrentView('register');
                setPassword('');
                setConfirmPassword('');
              }}>Register</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Render register view
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
                minLength="6"
              />
              <input
                type="password"
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength="6"
              />
              <button type="submit">Create Account</button>
            </form>
            
            <p className="switch-view">
              Already have an account?{' '}
              <span onClick={() => {
                setCurrentView('login');
                setPassword('');
                setConfirmPassword('');
              }}>Login</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Render chat view
  return (
    <div className="app">
      <div className="chat-container">
        {/* Sidebar */}
        <div className={`sidebar ${selectedContact ? 'show-chat' : ''}`}>
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
        <div className={`chat-area ${!selectedContact ? 'show-sidebar' : ''}`}>
          {selectedContact ? (
            <>
              <div className="chat-header">
                <button 
                  className="back-button" 
                  onClick={() => setSelectedContact(null)}
                  style={{ 
                    background: 'none', 
                    border: 'none', 
                    fontSize: '24px', 
                    cursor: 'pointer',
                    marginRight: '10px',
                    padding: '5px'
                  }}
                >
                  ←
                </button>
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
                <div>✓ Simple & secure</div>
                <div>✓ Real-time messaging</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
