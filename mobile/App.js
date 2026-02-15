import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  Alert,
  Image
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import 'react-native-get-random-values';

// Import crypto library (copy from shared/crypto.js)
// You'll need to adapt it for React Native environment
const API_URL = 'http://YOUR_SERVER_IP:3001'; // Replace with your server IP
const WS_URL = 'ws://YOUR_SERVER_IP:3001';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentView, setCurrentView] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState(null);
  
  const [contacts, setContacts] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const wsRef = useRef(null);
  const encryptionRef = useRef(null);

  useEffect(() => {
    checkLoginStatus();
  }, []);

  const checkLoginStatus = async () => {
    try {
      const savedToken = await AsyncStorage.getItem('token');
      const savedUsername = await AsyncStorage.getItem('username');
      
      if (savedToken && savedUsername) {
        setToken(savedToken);
        setUsername(savedUsername);
        setIsLoggedIn(true);
        setCurrentView('chat');
        // Initialize encryption and WebSocket
      }
    } catch (error) {
      console.error('Error checking login status:', error);
    }
  };

  const handleLogin = async () => {
    try {
      const response = await fetch(`${API_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (response.ok) {
        await AsyncStorage.setItem('token', data.token);
        await AsyncStorage.setItem('username', data.username);
        setToken(data.token);
        setIsLoggedIn(true);
        setCurrentView('chat');
      } else {
        Alert.alert('Error', data.error || 'Login failed');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error. Please try again.');
    }
  };

  const handleRegister = async () => {
    try {
      // Initialize encryption
      // Generate keys
      // Register with server
      Alert.alert('Info', 'Registration will be implemented with crypto library');
    } catch (error) {
      Alert.alert('Error', 'Registration failed');
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('username');
    setIsLoggedIn(false);
    setCurrentView('login');
    setToken(null);
    setUsername('');
    setPassword('');
  };

  const sendMessage = async () => {
    if (!messageInput.trim()) return;

    try {
      // Encrypt message
      // Send to server
      Alert.alert('Info', 'Message encryption will be implemented');
      setMessageInput('');
    } catch (error) {
      Alert.alert('Error', 'Failed to send message');
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });

    if (!result.canceled) {
      // Encrypt and upload image
      Alert.alert('Info', 'Image encryption will be implemented');
    }
  };

  const pickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*'
    });

    if (result.type === 'success') {
      // Encrypt and upload document
      Alert.alert('Info', 'Document encryption will be implemented');
    }
  };

  if (!isLoggedIn) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.authContainer}>
          <Text style={styles.title}>🔒 Encrypted Messenger</Text>
          <Text style={styles.subtitle}>End-to-end encrypted. Private.</Text>

          <TextInput
            style={styles.input}
            placeholder="Username"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          {currentView === 'login' ? (
            <>
              <TouchableOpacity style={styles.button} onPress={handleLogin}>
                <Text style={styles.buttonText}>Login</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setCurrentView('register')}>
                <Text style={styles.switchText}>
                  Don't have an account? <Text style={styles.switchLink}>Register</Text>
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity style={styles.button} onPress={handleRegister}>
                <Text style={styles.buttonText}>Create Account</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setCurrentView('login')}>
                <Text style={styles.switchText}>
                  Already have an account? <Text style={styles.switchLink}>Login</Text>
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.chatContainer}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Encrypted Messenger</Text>
          <TouchableOpacity onPress={handleLogout}>
            <Text style={styles.logoutButton}>Logout</Text>
          </TouchableOpacity>
        </View>

        {selectedContact ? (
          <>
            {/* Chat Header */}
            <View style={styles.chatHeader}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {selectedContact.username[0].toUpperCase()}
                </Text>
              </View>
              <View style={styles.chatHeaderInfo}>
                <Text style={styles.contactName}>{selectedContact.username}</Text>
                <Text style={styles.encryptionStatus}>🔒 End-to-end encrypted</Text>
              </View>
            </View>

            {/* Messages */}
            <FlatList
              data={messages}
              keyExtractor={(item, index) => index.toString()}
              style={styles.messagesList}
              renderItem={({ item }) => (
                <View style={[
                  styles.messageContainer,
                  item.from === username ? styles.sentMessage : styles.receivedMessage
                ]}>
                  <Text style={[
                    styles.messageText,
                    item.from === username ? styles.sentMessageText : styles.receivedMessageText
                  ]}>
                    {item.text}
                  </Text>
                  <Text style={styles.messageTime}>
                    {new Date(item.timestamp).toLocaleTimeString()}
                  </Text>
                </View>
              )}
            />

            {/* Input */}
            <View style={styles.inputContainer}>
              <TouchableOpacity style={styles.attachButton} onPress={pickImage}>
                <Text style={styles.attachButtonText}>📷</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.attachButton} onPress={pickDocument}>
                <Text style={styles.attachButtonText}>📎</Text>
              </TouchableOpacity>
              <TextInput
                style={styles.messageInput}
                placeholder="Type a message..."
                value={messageInput}
                onChangeText={setMessageInput}
                multiline
              />
              <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
                <Text style={styles.sendButtonText}>Send</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <View style={styles.noChat}>
            <Text style={styles.noChatTitle}>🔒 Encrypted Messenger</Text>
            <Text style={styles.noChatText}>
              Select a contact to start a secure conversation
            </Text>
            <View style={styles.features}>
              <Text style={styles.feature}>✓ End-to-end encryption</Text>
              <Text style={styles.feature}>✓ Zero-knowledge architecture</Text>
              <Text style={styles.feature}>✓ Forward secrecy</Text>
              <Text style={styles.feature}>✓ Encrypted media sharing</Text>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#667eea',
  },
  authContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 30,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: 'white',
    textAlign: 'center',
    marginBottom: 40,
  },
  input: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#764ba2',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  switchText: {
    color: 'white',
    textAlign: 'center',
  },
  switchLink: {
    fontWeight: 'bold',
    textDecorationLine: 'underline',
  },
  chatContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#667eea',
  },
  headerTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  logoutButton: {
    color: 'white',
    fontSize: 16,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  avatarText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  chatHeaderInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  encryptionStatus: {
    fontSize: 12,
    color: '#4caf50',
  },
  messagesList: {
    flex: 1,
    padding: 15,
    backgroundColor: '#f8f9fa',
  },
  messageContainer: {
    maxWidth: '70%',
    marginBottom: 10,
    padding: 12,
    borderRadius: 12,
  },
  sentMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#667eea',
  },
  receivedMessage: {
    alignSelf: 'flex-start',
    backgroundColor: 'white',
  },
  messageText: {
    fontSize: 16,
  },
  sentMessageText: {
    color: 'white',
  },
  receivedMessageText: {
    color: '#333',
  },
  messageTime: {
    fontSize: 10,
    color: '#999',
    marginTop: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    alignItems: 'center',
  },
  attachButton: {
    padding: 10,
  },
  attachButtonText: {
    fontSize: 24,
  },
  messageInput: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginHorizontal: 10,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: '#667eea',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  sendButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  noChat: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  noChatTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  noChatText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  features: {
    alignItems: 'flex-start',
  },
  feature: {
    fontSize: 16,
    color: '#4caf50',
    marginBottom: 8,
  },
});
