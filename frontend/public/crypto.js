/**
 * E2E Encryption Library
 * Implements Signal Protocol-like encryption with X3DH key exchange
 * Zero-knowledge architecture - server never sees plaintext or keys
 */

// Using SubtleCrypto API (available in browsers and Node.js 15+)
const crypto = typeof window !== 'undefined' ? window.crypto : require('crypto').webcrypto;

class E2EEncryption {
  constructor() {
    this.identityKeyPair = null;
    this.signedPreKey = null;
    this.oneTimePreKeys = [];
    this.sessions = new Map(); // Store session keys per contact
  }

  /**
   * Generate random bytes
   */
  async generateRandomBytes(length) {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return array;
  }

  /**
   * Generate identity key pair (long-term)
   */
  async generateIdentityKeyPair() {
    const keyPair = await crypto.subtle.generateKey(
      {
        name: 'ECDH',
        namedCurve: 'P-256'
      },
      true,
      ['deriveKey', 'deriveBits']
    );

    this.identityKeyPair = keyPair;
    return keyPair;
  }

  /**
   * Generate signed pre-key (medium-term, rotated periodically)
   */
  async generateSignedPreKey() {
    const keyPair = await crypto.subtle.generateKey(
      {
        name: 'ECDH',
        namedCurve: 'P-256'
      },
      true,
      ['deriveKey', 'deriveBits']
    );

    this.signedPreKey = keyPair;
    return keyPair;
  }

  /**
   * Generate one-time pre-keys (single use)
   */
  async generateOneTimePreKeys(count = 100) {
    const keys = [];
    for (let i = 0; i < count; i++) {
      const keyPair = await crypto.subtle.generateKey(
        {
          name: 'ECDH',
          namedCurve: 'P-256'
        },
        true,
        ['deriveKey', 'deriveBits']
      );
      keys.push(keyPair);
    }
    this.oneTimePreKeys = keys;
    return keys;
  }

  /**
   * Export public key to share with server/contacts
   */
  async exportPublicKey(publicKey) {
    const exported = await crypto.subtle.exportKey('raw', publicKey);
    return this.arrayBufferToBase64(exported);
  }

  /**
   * Import public key from base64
   */
  async importPublicKey(base64Key) {
    const keyData = this.base64ToArrayBuffer(base64Key);
    return await crypto.subtle.importKey(
      'raw',
      keyData,
      {
        name: 'ECDH',
        namedCurve: 'P-256'
      },
      true,
      []
    );
  }

  /**
   * X3DH Key Agreement - Establish shared secret
   */
  async performKeyAgreement(theirIdentityKey, theirSignedPreKey, theirOneTimePreKey = null) {
    // DH1 = DH(IK_A, SPK_B)
    const dh1 = await crypto.subtle.deriveBits(
      {
        name: 'ECDH',
        public: theirSignedPreKey
      },
      this.identityKeyPair.privateKey,
      256
    );

    // DH2 = DH(EK_A, IK_B)
    const ephemeralKeyPair = await this.generateSignedPreKey();
    const dh2 = await crypto.subtle.deriveBits(
      {
        name: 'ECDH',
        public: theirIdentityKey
      },
      ephemeralKeyPair.privateKey,
      256
    );

    // DH3 = DH(EK_A, SPK_B)
    const dh3 = await crypto.subtle.deriveBits(
      {
        name: 'ECDH',
        public: theirSignedPreKey
      },
      ephemeralKeyPair.privateKey,
      256
    );

    // Combine DH outputs
    let combinedDH = new Uint8Array(dh1.byteLength + dh2.byteLength + dh3.byteLength);
    combinedDH.set(new Uint8Array(dh1), 0);
    combinedDH.set(new Uint8Array(dh2), dh1.byteLength);
    combinedDH.set(new Uint8Array(dh3), dh1.byteLength + dh2.byteLength);

    // If one-time pre-key exists, add DH4
    if (theirOneTimePreKey) {
      const dh4 = await crypto.subtle.deriveBits(
        {
          name: 'ECDH',
          public: theirOneTimePreKey
        },
        ephemeralKeyPair.privateKey,
        256
      );
      const newCombined = new Uint8Array(combinedDH.length + dh4.byteLength);
      newCombined.set(combinedDH, 0);
      newCombined.set(new Uint8Array(dh4), combinedDH.length);
      combinedDH = newCombined;
    }

    // Derive root key using HKDF
    const rootKey = await this.hkdf(combinedDH, new Uint8Array(32), 'RootKey', 32);

    return {
      rootKey,
      ephemeralPublicKey: await this.exportPublicKey(ephemeralKeyPair.publicKey)
    };
  }

  /**
   * HKDF (HMAC-based Key Derivation Function)
   */
  async hkdf(inputKeyMaterial, salt, info, length) {
    // Import input key material
    const ikm = await crypto.subtle.importKey(
      'raw',
      inputKeyMaterial,
      { name: 'HKDF' },
      false,
      ['deriveBits']
    );

    // Derive bits
    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt: salt,
        info: new TextEncoder().encode(info)
      },
      ikm,
      length * 8
    );

    return new Uint8Array(derivedBits);
  }

  /**
   * Derive message keys from chain key (Double Ratchet)
   */
  async deriveMessageKeys(chainKey) {
    const messageKey = await this.hkdf(chainKey, new Uint8Array(32), 'MessageKey', 32);
    const nextChainKey = await this.hkdf(chainKey, new Uint8Array(32), 'ChainKey', 32);

    return { messageKey, nextChainKey };
  }

  /**
   * Encrypt message with AES-GCM
   */
  async encryptMessage(plaintext, messageKey) {
    // Generate IV
    const iv = await this.generateRandomBytes(12);

    // Import message key
    const key = await crypto.subtle.importKey(
      'raw',
      messageKey,
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );

    // Encrypt
    const ciphertext = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
        tagLength: 128
      },
      key,
      new TextEncoder().encode(plaintext)
    );

    return {
      ciphertext: this.arrayBufferToBase64(ciphertext),
      iv: this.arrayBufferToBase64(iv)
    };
  }

  /**
   * Decrypt message with AES-GCM
   */
  async decryptMessage(encryptedData, messageKey) {
    const key = await crypto.subtle.importKey(
      'raw',
      messageKey,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    const ciphertext = this.base64ToArrayBuffer(encryptedData.ciphertext);
    const iv = this.base64ToArrayBuffer(encryptedData.iv);

    try {
      const plaintext = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv,
          tagLength: 128
        },
        key,
        ciphertext
      );

      return new TextDecoder().decode(plaintext);
    } catch (error) {
      throw new Error('Decryption failed - message may be corrupted or tampered with');
    }
  }

  /**
   * Encrypt file/media with AES-GCM
   */
  async encryptFile(fileData, messageKey) {
    const iv = await this.generateRandomBytes(12);

    const key = await crypto.subtle.importKey(
      'raw',
      messageKey,
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );

    const ciphertext = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
        tagLength: 128
      },
      key,
      fileData
    );

    return {
      ciphertext: new Uint8Array(ciphertext),
      iv: this.arrayBufferToBase64(iv)
    };
  }

  /**
   * Decrypt file/media
   */
  async decryptFile(encryptedFileData, iv, messageKey) {
    const key = await crypto.subtle.importKey(
      'raw',
      messageKey,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    const ivBytes = this.base64ToArrayBuffer(iv);

    try {
      const plaintext = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: ivBytes,
          tagLength: 128
        },
        key,
        encryptedFileData
      );

      return new Uint8Array(plaintext);
    } catch (error) {
      throw new Error('File decryption failed');
    }
  }

  /**
   * Create session with contact
   */
  async createSession(contactId, theirIdentityKey, theirSignedPreKey, theirOneTimePreKey) {
    const { rootKey, ephemeralPublicKey } = await this.performKeyAgreement(
      theirIdentityKey,
      theirSignedPreKey,
      theirOneTimePreKey
    );

    this.sessions.set(contactId, {
      rootKey,
      sendingChainKey: rootKey,
      receivingChainKey: rootKey,
      messageNumber: 0,
      ephemeralPublicKey
    });

    return ephemeralPublicKey;
  }

  /**
   * Create session from received message (Receiver side)
   */
  async createReceiveSession(contactId, senderIdentityKey, sendingEphemeralKey) {
    // DH1 = DH(SPK_B, IK_A)
    const dh1 = await crypto.subtle.deriveBits(
      {
        name: 'ECDH',
        public: senderIdentityKey
      },
      this.signedPreKey.privateKey,
      256
    );

    // DH2 = DH(IK_B, EK_A)
    const dh2 = await crypto.subtle.deriveBits(
      {
        name: 'ECDH',
        public: sendingEphemeralKey
      },
      this.identityKeyPair.privateKey,
      256
    );

    // DH3 = DH(SPK_B, EK_A)
    const dh3 = await crypto.subtle.deriveBits(
      {
        name: 'ECDH',
        public: sendingEphemeralKey
      },
      this.signedPreKey.privateKey,
      256
    );

    // Combine DH outputs
    const combinedDH = new Uint8Array(dh1.byteLength + dh2.byteLength + dh3.byteLength);
    combinedDH.set(new Uint8Array(dh1), 0);
    combinedDH.set(new Uint8Array(dh2), dh1.byteLength);
    combinedDH.set(new Uint8Array(dh3), dh1.byteLength + dh2.byteLength);

    // Derive root key
    const rootKey = await this.hkdf(combinedDH, new Uint8Array(32), 'RootKey', 32);

    this.sessions.set(contactId, {
      rootKey,
      sendingChainKey: rootKey, // Initial state
      receivingChainKey: rootKey, // Initial state
      messageNumber: 0
    });
  }

  /**
   * Send encrypted message
   */
  async sendMessage(contactId, plaintext) {
    const session = this.sessions.get(contactId);
    if (!session) {
      throw new Error('No session exists with this contact. Establish session first.');
    }

    // Derive message key and update chain key
    const { messageKey, nextChainKey } = await this.deriveMessageKeys(session.sendingChainKey);
    session.sendingChainKey = nextChainKey;
    session.messageNumber++;

    // Encrypt message
    const encrypted = await this.encryptMessage(plaintext, messageKey);

    return {
      ...encrypted,
      messageNumber: session.messageNumber
    };
  }

  /**
   * Receive encrypted message
   */
  async receiveMessage(contactId, encryptedData) {
    const session = this.sessions.get(contactId);
    if (!session) {
      throw new Error('No session exists with this contact');
    }

    // Derive message key
    const { messageKey, nextChainKey } = await this.deriveMessageKeys(session.receivingChainKey);
    session.receivingChainKey = nextChainKey;

    // Decrypt message
    return await this.decryptMessage(encryptedData, messageKey);
  }

  /**
   * Generate fingerprint for key verification
   */
  async generateFingerprint(publicKey) {
    const keyData = this.base64ToArrayBuffer(publicKey);
    const hash = await crypto.subtle.digest('SHA-256', keyData);
    const hashArray = Array.from(new Uint8Array(hash));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  }

  /**
   * Utility: ArrayBuffer to Base64
   */
  arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Utility: Base64 to ArrayBuffer
   */
  base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Export identity bundle (to share with server)
   */
  async exportIdentityBundle() {
    if (!this.identityKeyPair || !this.signedPreKey) {
      throw new Error('Generate keys first');
    }

    const identityKey = await this.exportPublicKey(this.identityKeyPair.publicKey);
    const signedPreKey = await this.exportPublicKey(this.signedPreKey.publicKey);
    const oneTimePreKeys = await Promise.all(
      this.oneTimePreKeys.slice(0, 10).map(k => this.exportPublicKey(k.publicKey))
    );

    return {
      identityKey,
      signedPreKey,
      oneTimePreKeys
    };
  }
}

// Export for different environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = E2EEncryption;
} else if (typeof window !== 'undefined') {
  window.E2EEncryption = E2EEncryption;
}
