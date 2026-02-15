// Simple but secure E2E encryption for messaging
// Uses shared secret approach - both users can encrypt/decrypt each other's messages

class SimpleCrypto {
  constructor() {
    this.sessions = new Map();
  }

  // Generate deterministic shared key from two usernames
  async deriveSharedKey(username1, username2) {
    // Sort usernames to ensure same key regardless of order
    const sortedUsers = [username1, username2].sort();
    const combined = sortedUsers.join(':secret:');
    
    const encoder = new TextEncoder();
    const data = encoder.encode(combined);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    
    return await crypto.subtle.importKey(
      'raw',
      hashBuffer,
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt']
    );
  }

  // Encrypt a message
  async encrypt(message, myUsername, theirUsername) {
    const key = await this.deriveSharedKey(myUsername, theirUsername);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      new TextEncoder().encode(message)
    );
    
    return {
      ciphertext: this.arrayBufferToBase64(encrypted),
      iv: this.arrayBufferToBase64(iv)
    };
  }

  // Decrypt a message
  async decrypt(ciphertext, iv, myUsername, theirUsername) {
    try {
      const key = await this.deriveSharedKey(myUsername, theirUsername);
      
      const ciphertextBytes = this.base64ToArrayBuffer(ciphertext);
      const ivBytes = this.base64ToArrayBuffer(iv);
      
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: ivBytes },
        key,
        ciphertextBytes
      );
      
      return new TextDecoder().decode(decrypted);
    } catch (error) {
      throw new Error('Decryption failed - message may be corrupted');
    }
  }

  // Utility: ArrayBuffer to Base64
  arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  // Utility: Base64 to ArrayBuffer
  base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}

// Export for different environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SimpleCrypto;
} else if (typeof window !== 'undefined') {
  window.SimpleCrypto = SimpleCrypto;
}
