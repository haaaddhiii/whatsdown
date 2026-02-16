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
  const [isTyping, setIsTyping] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [darkMode, setDarkMode] = useState(false);
  
  // Initialize dark mode after mount (client-side only)
  useEffect(() => {
    // Check localStorage first, otherwise use system preference
    const saved = localStorage.getItem('darkMode');
    if (saved !== null) {
      setDarkMode(saved === 'true');
    } else if (window.matchMedia) {
      setDarkMode(window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
  }, []);
  
  // Listen for system theme changes
  useEffect(() => {
    if (!window.matchMedia) return;
    
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => {
      // Only update if user hasn't manually set a preference
      if (localStorage.getItem('darkMode') === null) {
        setDarkMode(e.matches);
      }
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);
  
  // Encryption
  const cryptoRef = useRef(null);
  const wsRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

  // Auto-scroll to bottom when messages change (only if already near bottom)
  useEffect(() => {
    if (!messagesEndRef.current || !messagesContainerRef.current) return;

    const container = messagesContainerRef.current;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;

    // Only auto-scroll if user is near the bottom (within 150px)
    if (isNearBottom) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages]);

  // Always scroll when opening a chat
  useEffect(() => {
    if (selectedContact && messagesEndRef.current) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
      }, 100);
    }
  }, [selectedContact]);

  // Save contacts to localStorage when they change
  useEffect(() => {
    if (currentUser && contacts.length > 0) {
      localStorage.setItem(`contacts_${currentUser}`, JSON.stringify(contacts));
    }
  }, [contacts, currentUser]);

  // Load contacts from localStorage on mount
  useEffect(() => {
    if (currentUser) {
      const saved = localStorage.getItem(`contacts_${currentUser}`);
      if (saved) {
        try {
          setContacts(JSON.parse(saved));
        } catch (e) {
          console.error('Failed to load contacts');
        }
      }
    }
  }, [currentUser]);

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
        to: encryptedMessage.to,
        text: plaintext,
        timestamp: new Date(encryptedMessage.timestamp),
        mediaType: encryptedMessage.mediaType,
        mediaUrl: encryptedMessage.mediaUrl
      };

      // Only add to messages if this chat is currently open
      setMessages(prev => {
        // Check if this message belongs to the current conversation
        const isCurrentChat = 
          (newMessage.from === selectedContact?.username) || 
          (newMessage.to === selectedContact?.username);
        
        if (isCurrentChat) {
          return [...prev, newMessage];
        }
        return prev;
      });
    } catch (error) {
      console.error('Failed to decrypt message:', error);
    }
  }, [currentUser, selectedContact]);

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
        // Show typing indicator
        if (data.from === selectedContact?.username) {
          setOtherUserTyping(data.isTyping);
          if (data.isTyping) {
            // Auto-hide after 3 seconds
            setTimeout(() => setOtherUserTyping(false), 3000);
          }
        }
        break;
        
      case 'user_status':
        // Update online/offline status
        updateContactStatus(data.username, data.status);
        setOnlineUsers(prev => {
          const newSet = new Set(prev);
          if (data.status === 'online') {
            newSet.add(data.username);
          } else {
            newSet.delete(data.username);
          }
          return newSet;
        });
        break;
        
      case 'messages_read':
        // Update read receipts
        setMessages(prev => prev.map(msg => 
          data.messageIds.includes(msg.id) 
            ? { ...msg, read: true }
            : msg
        ));
        break;
        
      default:
        console.log('Unknown message type:', data.type);
    }
  }, [handleNewMessage, updateContactStatus, selectedContact]);

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

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem('darkMode', newMode);
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
      
      // Add to contacts list if not already there
      setContacts(prev => {
        const exists = prev.find(c => c.username === contact.username);
        if (exists) {
          // Move to top
          return [contact, ...prev.filter(c => c.username !== contact.username)];
        }
        return [contact, ...prev];
      });
      
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
          // Skip messages that can't be decrypted (old encryption)
          console.log('Skipping old message that cannot be decrypted');
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
      
      // Stop typing indicator
      sendTypingIndicator(false);
      
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
        const data = await response.json();
        // Add to local messages with delivery status
        setMessages(prev => [...prev, {
          id: data.messageId,
          from: currentUser,
          text: messageInput,
          timestamp: new Date(),
          delivered: data.delivered,
          read: false
        }]);
        setMessageInput('');
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Failed to send message');
    }
  };

  const sendTypingIndicator = (isTyping) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && selectedContact) {
      wsRef.current.send(JSON.stringify({
        type: 'typing',
        to: selectedContact.username,
        isTyping: isTyping
      }));
    }
  };

  const handleTyping = (e) => {
    setMessageInput(e.target.value);
    
    // Send typing indicator
    if (!isTyping && e.target.value.length > 0) {
      setIsTyping(true);
      sendTypingIndicator(true);
    }
    
    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Set timeout to stop typing indicator
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      sendTypingIndicator(false);
    }, 1000);
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
            <h1>🔒 WakyTalky</h1>
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
    <div className={`app ${darkMode ? 'dark-mode' : ''}`}>
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
          
          {contacts.length > 0 && (
            <div className="section-header">
              <h3>Recent Chats</h3>
            </div>
          )}
          
          <div className="contacts-list">
            {contacts.length === 0 && !searchQuery && (
              <div className="empty-state">
                <p>No recent chats</p>
                <p className="hint">Search for users to start chatting</p>
              </div>
            )}
            {contacts.map(contact => (
              <div
                key={contact.username}
                className={`contact-item ${selectedContact?.username === contact.username ? 'active' : ''}`}
                onClick={() => startChat(contact)}
              >
                <div className="contact-avatar">
                  {contact.username[0].toUpperCase()}
                </div>
                <div className="contact-info">
                  <div className="contact-name">{contact.username}</div>
                  <div className="contact-status">Tap to chat</div>
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
                <div className="contact-avatar">
                  {selectedContact.username[0].toUpperCase()}
                </div>
                <div>
                  <div className="contact-name">{selectedContact.username}</div>
                  <div className="encryption-status">🔒 End-to-end encrypted</div>
                </div>
              </div>

              <div className="messages-container" ref={messagesContainerRef}>
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
                      {msg.from === currentUser && (
                        <span className="message-status">
                          {msg.read ? ' ✓✓' : msg.delivered ? ' ✓✓' : ' ✓'}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {otherUserTyping && (
                  <div className="typing-indicator">
                    <span>{selectedContact.username} is typing</span>
                    <span className="typing-dots">
                      <span>.</span><span>.</span><span>.</span>
                    </span>
                  </div>
                )}
                <div ref={messagesEndRef} />
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
                  onChange={handleTyping}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                />
                <button onClick={sendMessage}>Send</button>
              </div>
            </>
          ) : (
            <div className="no-chat-selected">
              <h2>🔒 WakyTalky</h2>
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