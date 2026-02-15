const E2EEncryption = require('./frontend/public/crypto.js');

async function testFix() {
    console.log('--- Starting Verification (Session Recovery & History) ---');

    // 1. Setup Alice and Bob
    const alice = new E2EEncryption();
    const bob = new E2EEncryption();

    console.log('Generating keys...');
    await alice.generateIdentityKeyPair();
    await alice.generateSignedPreKey();

    await bob.generateIdentityKeyPair();
    await bob.generateSignedPreKey();

    // 2. Alice starts chat with Bob
    const bobKeys = await bob.exportIdentityBundle();
    const bobIdentityKey = await alice.importPublicKey(bobKeys.identityKey);
    const bobSignedPreKey = await alice.importPublicKey(bobKeys.signedPreKey);

    console.log('Alice creating session...');
    const ephemeralPublicKey = await alice.createSession(
        'bob',
        bobIdentityKey,
        bobSignedPreKey,
        null // No OTPK
    );

    // 3. Alice sends 2 messages
    console.log('Alice sending messages...');
    const msg1Text = "Message 1: Hello Bob!";
    const msg1Params = await alice.sendMessage('bob', msg1Text);

    const msg2Text = "Message 2: How are you?";
    const msg2Params = await alice.sendMessage('bob', msg2Text);

    // 4. Bob receives messages (Simulation of Load History)
    // Bob has NO session initially
    console.log('Bob receiving messages (History Load)...');

    // Message payloads as they would appear in history API response
    // Important: History is usually returned Newest -> Oldest by server
    const history = [
        {
            from: 'alice',
            encryptedContent: msg2Params.ciphertext,
            iv: msg2Params.iv,
            ephemeralKey: msg2Params.ephemeralPublicKey,
            messageNumber: msg2Params.messageNumber
        },
        {
            from: 'alice',
            encryptedContent: msg1Params.ciphertext,
            iv: msg1Params.iv,
            ephemeralKey: msg1Params.ephemeralPublicKey,
            messageNumber: msg1Params.messageNumber
        }
    ];

    // In App.js we reverse this execution order: Oldest -> Newest
    const chronologicalHistory = [...history].reverse();

    for (const msg of chronologicalHistory) {
        try {
            await bob.receiveMessage('alice', {
                ciphertext: msg.encryptedContent,
                iv: msg.iv
            });
            console.log(`Decrypted message ${msg.messageNumber} (Unexpected success without session)`);
        } catch (err) {
            if (err.message.includes('No session') && msg.ephemeralKey) {
                console.log(`Msg ${msg.messageNumber}: Missing session, attempting recovery...`);
                // Bob fetches Alice's identity key
                const aliceKeys = await alice.exportIdentityBundle();
                const aliceIdentityKey = await bob.importPublicKey(aliceKeys.identityKey);
                const receivedEphemeralKey = await bob.importPublicKey(msg.ephemeralKey);

                await bob.createReceiveSession(
                    'alice',
                    aliceIdentityKey,
                    receivedEphemeralKey
                );
                console.log(`Msg ${msg.messageNumber}: Session recovered.`);

                // Retry
                const decrypted = await bob.receiveMessage('alice', {
                    ciphertext: msg.encryptedContent,
                    iv: msg.iv
                });
                console.log(`Msg ${msg.messageNumber} Decrypted: "${decrypted}"`);
            } else {
                // Normal decryption if session exists (for Msg 2)
                const decrypted = await bob.receiveMessage('alice', {
                    ciphertext: msg.encryptedContent,
                    iv: msg.iv
                });
                console.log(`Msg ${msg.messageNumber} Decrypted: "${decrypted}"`);
            }
        }
    }
}

testFix().catch((err) => console.error("Test Failed:", err));
