const E2EEncryption = require('./frontend/public/crypto.js');

async function testFix() {
    console.log('--- Starting Verification ---');

    // 1. Setup Alice and Bob
    const alice = new E2EEncryption();
    const bob = new E2EEncryption();

    console.log('Generating keys...');
    await alice.generateIdentityKeyPair();
    await alice.generateSignedPreKey();

    await bob.generateIdentityKeyPair();
    await bob.generateSignedPreKey();

    // 2. Alice starts chat with Bob (Sender side)
    // Alice fetches Bob's keys
    const bobKeys = await bob.exportIdentityBundle();

    // Import Bob's keys into Alice's instance
    const bobIdentityKey = await alice.importPublicKey(bobKeys.identityKey);
    const bobSignedPreKey = await alice.importPublicKey(bobKeys.signedPreKey);
    // OTPK is null as per our fix
    const bobOneTimePreKey = null;

    console.log('Alice creating session...');
    const ephemeralPublicKey = await alice.createSession(
        'bob',
        bobIdentityKey,
        bobSignedPreKey,
        bobOneTimePreKey
    );

    // 3. Alice sends a message
    console.log('Alice sending message...');
    const plaintext = "Hello Bob, this is a secret message!";
    const encryptedParams = await alice.sendMessage('bob', plaintext);

    // Simulate network transmission
    // Message payload contains: encryptedContent, iv, ephemeralKey (from sendMessage return)
    const messagePayload = {
        from: 'alice',
        encryptedContent: encryptedParams.ciphertext,
        iv: encryptedParams.iv,
        ephemeralKey: encryptedParams.ephemeralPublicKey, // Now returned by sendMessage
        messageNumber: encryptedParams.messageNumber
    };

    // 4. Bob receives message (Receiver side)
    // Bob has NO session with Alice initially.
    console.log('Bob receiving message...');

    try {
        // Attempt normal receive (should fail)
        await bob.receiveMessage('alice', {
            ciphertext: messagePayload.encryptedContent,
            iv: messagePayload.iv
        });
    } catch (err) {
        if (err.message.includes('No session')) {
            console.log('Caught expected "No session" error.');

            // 5. Bob establishes session using createReceiveSession
            console.log('Bob establishing session from message...');

            // Bob fetches Alice's identity key
            const aliceKeys = await alice.exportIdentityBundle();
            const aliceIdentityKey = await bob.importPublicKey(aliceKeys.identityKey);

            // Bob imports the ephemeral key from the message
            const receivedEphemeralKey = await bob.importPublicKey(messagePayload.ephemeralKey);

            await bob.createReceiveSession(
                'alice',
                aliceIdentityKey,
                receivedEphemeralKey
            );
            console.log('Session established.');

            // 6. Retry decryption
            console.log('Bob retrying decryption...');
            const decryptedText = await bob.receiveMessage('alice', {
                ciphertext: messagePayload.encryptedContent,
                iv: messagePayload.iv
            });

            console.log('Decrypted text:', decryptedText);

            if (decryptedText === plaintext) {
                console.log('✅ VERIFICATION SUCCESS: Message decrypted correctly!');
            } else {
                console.error('❌ VERIFICATION FAILED: Decrypted text does not match.');
            }
        } else {
            console.error('❌ VERIFICATION FAILED: Unexpected error:', err);
        }
    }
}

testFix().catch(console.error);
