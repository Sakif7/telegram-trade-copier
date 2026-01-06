import express from 'express';
import cors from 'cors';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import input from 'input';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load environment variables from .env file
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Configuration
const API_ID = process.env.TELEGRAM_API_ID;
const API_HASH = process.env.TELEGRAM_API_HASH;
const SESSION_FILE = path.join(process.cwd(), 'telegram_session.txt');

let client = null;
let sessionString = '';
let connectedClients = new Set();
let authResolvers = {};

// Load saved session on startup
function loadSession() {
    try {
        if (fs.existsSync(SESSION_FILE)) {
            sessionString = fs.readFileSync(SESSION_FILE, 'utf8').trim();
            console.log('✅ Loaded saved session from file');
            return sessionString;
        }
    } catch (error) {
        console.error('Error loading session:', error);
    }
    return '';
}

// Save session to file
function saveSession(session) {
    try {
        fs.writeFileSync(SESSION_FILE, session, 'utf8');
        console.log('✅ Session saved to file');
    } catch (error) {
        console.error('Error saving session:', error);
    }
}

// Auto-connect on startup if session exists
async function autoConnect() {
    const savedSession = loadSession();
    if (savedSession && API_ID && API_HASH) {
        try {
            console.log('🔄 Attempting auto-connect with saved session...');
            const session = new StringSession(savedSession);
            client = new TelegramClient(session, parseInt(API_ID), API_HASH, {
                connectionRetries: 5,
            });

            await client.connect();
            
            // Test if the session is valid
            const me = await client.getMe();
            console.log(`✅ Auto-connected as: ${me.firstName} ${me.lastName || ''}`);
            sessionString = savedSession;
        } catch (error) {
            console.error('❌ Auto-connect failed:', error.message);
            console.log('   Session may be expired, will need fresh login');
            client = null;
            sessionString = '';
            // Delete invalid session file
            if (fs.existsSync(SESSION_FILE)) {
                fs.unlinkSync(SESSION_FILE);
            }
        }
    }
}

// WebSocket-like SSE for real-time updates
app.get('/api/messages/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    connectedClients.add(res);

    req.on('close', () => {
        connectedClients.delete(res);
    });
});

// Broadcast message to all connected clients
function broadcastMessage(data) {
    connectedClients.forEach(client => {
        client.write(`data: ${JSON.stringify(data)}\n\n`);
    });
}

// Connect to Telegram
app.post('/api/telegram/connect', async (req, res) => {
    const { phoneNumber } = req.body;

    if (!API_ID || !API_HASH) {
        return res.status(500).json({ 
            success: false, 
            error: 'TELEGRAM_API_ID and TELEGRAM_API_HASH must be set in .env file' 
        });
    }

    try {
        // Disconnect existing client if any
        if (client) {
            try {
                await client.disconnect();
            } catch (err) {
                console.log('Error disconnecting existing client:', err);
            }
            client = null;
        }

        // Clear session and auth resolvers for fresh login
        sessionString = '';
        authResolvers = {};

        const session = new StringSession(sessionString);
        client = new TelegramClient(session, parseInt(API_ID), API_HASH, {
            connectionRetries: 5,
        });

        // Start connection without waiting for completion
        client.start({
            phoneNumber: async () => phoneNumber,
            phoneCode: async () => {
                // Wait for code to be provided via /api/telegram/code endpoint
                return new Promise((resolve) => {
                    authResolvers.code = resolve;
                });
            },
            password: async () => {
                // Wait for password to be provided via /api/telegram/password endpoint
                return new Promise((resolve) => {
                    authResolvers.password = resolve;
                });
            },
            onError: (err) => console.error('Telegram error:', err),
        }).then(async () => {
            sessionString = client.session.save();
            saveSession(sessionString);
            console.log('Successfully connected to Telegram');
            console.log('Session saved - you won\'t need to login again on restart');
        }).catch(err => {
            console.error('Failed to start Telegram client:', err);
        });

        // Respond immediately, client will ask for code
        res.json({ 
            success: true,
            step: 'code',
            message: 'Enter the code sent to your Telegram'
        });
    } catch (error) {
        console.error('Connection error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Submit verification code
app.post('/api/telegram/code', async (req, res) => {
    const { code } = req.body;
    
    if (authResolvers.code) {
        authResolvers.code(code);
        delete authResolvers.code;
    }
    
    res.json({ success: true });
});

// Submit 2FA password
app.post('/api/telegram/password', async (req, res) => {
    const { password } = req.body;
    
    if (authResolvers.password) {
        authResolvers.password(password);
        delete authResolvers.password;
    }
    
    res.json({ success: true });
});

// Get channels/dialogs
app.get('/api/telegram/channels', async (req, res) => {
    if (!client) {
        return res.status(400).json({ error: 'Not connected to Telegram' });
    }

    try {
        // Wait a bit to ensure connection is established
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const dialogs = await client.getDialogs({ limit: 100 });
        const channels = dialogs.map(d => ({
            id: d.id?.toString(),
            name: d.name || d.title,
            isChannel: d.isChannel,
            isGroup: d.isGroup,
        }));

        res.json({ channels });
    } catch (error) {
        console.error('Error getting channels:', error);
        res.status(500).json({ error: error.message });
    }
});

// Start monitoring channels
app.post('/api/telegram/monitor', async (req, res) => {
    const { channelIds } = req.body;

    console.log('📡 Monitor request received for channels:', channelIds);

    if (!client) {
        console.error('❌ No client connected');
        return res.status(400).json({ error: 'Not connected to Telegram' });
    }

    try {
        // Import NewMessage event
        const { NewMessage } = await import('telegram/events/index.js');
        
        console.log('✅ Setting up event handler for channels:', channelIds);
        
        // Add event handler for new messages
        client.addEventHandler((event) => {
            try {
                console.log('📨 New message event received');
                const message = event.message;
                
                if (message && message.message) {
                    const chatId = message.peerId?.channelId?.toString() || 
                                  message.peerId?.chatId?.toString();
                    
                    console.log('Message from chat:', chatId);
                    console.log('Monitoring channels:', channelIds);
                    console.log('Message text:', message.message);
                    
                    // Telegram channel IDs can have different formats:
                    // In dialogs: -1003305143875
                    // In messages: 3305143875
                    // We need to check both formats
                    const fullChatId = `-100${chatId}`;
                    
                    console.log('🔍 Checking if monitored...');
                    console.log('   chatId:', chatId, typeof chatId);
                    console.log('   fullChatId:', fullChatId, typeof fullChatId);
                    console.log('   channelIds:', channelIds);
                    console.log('   includes chatId?', channelIds.includes(chatId));
                    console.log('   includes fullChatId?', channelIds.includes(fullChatId));
                    
                    const isMonitored = channelIds.includes(chatId) || 
                                       channelIds.includes(fullChatId) ||
                                       channelIds.some(id => {
                                           console.log(`   Comparing "${id}" with "${chatId}" and "${fullChatId}"`);
                                           return id === chatId || id === fullChatId || id.endsWith(chatId);
                                       });
                    
                    console.log('   isMonitored:', isMonitored);
                    
                    if (isMonitored) {
                        console.log('✅ Message matches monitored channel! Broadcasting...');
                        console.log('   Connected clients:', connectedClients.size);
                        broadcastMessage({
                            text: message.message,
                            channelId: chatId,
                            timestamp: new Date(message.date * 1000),
                        });
                    } else {
                        console.log('⚠️  Message not from monitored channel');
                    }
                } else {
                    console.log('⚠️  Message has no text content');
                }
            } catch (err) {
                console.error('❌ Error processing message:', err);
            }
        }, new NewMessage({}));

        console.log('✅ Monitoring started successfully');
        res.json({ success: true, message: 'Monitoring started' });
    } catch (error) {
        console.error('❌ Error starting monitor:', error);
        res.status(500).json({ error: error.message });
    }
});

// Disconnect and reset session
app.post('/api/telegram/disconnect', async (req, res) => {
    if (client) {
        await client.disconnect();
        client = null;
    }
    sessionString = '';
    authResolvers = {};
    res.json({ success: true });
});

// Force logout - clear session completely
app.post('/api/telegram/logout', async (req, res) => {
    try {
        if (client) {
            await client.disconnect();
            client = null;
        }
        sessionString = '';
        authResolvers = {};
        
        // Delete session file
        if (fs.existsSync(SESSION_FILE)) {
            fs.unlinkSync(SESSION_FILE);
            console.log('🗑️  Session file deleted');
        }
        
        console.log('Logged out and cleared session');
        res.json({ success: true, message: 'Logged out successfully' });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Check session status
app.get('/api/telegram/status', async (req, res) => {
    try {
        if (client) {
            const me = await client.getMe();
            res.json({ 
                connected: true, 
                user: {
                    firstName: me.firstName,
                    lastName: me.lastName || '',
                    phone: me.phone,
                }
            });
        } else {
            res.json({ connected: false });
        }
    } catch (error) {
        res.json({ connected: false });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, async () => {
    console.log(`Telegram backend server running on port ${PORT}`);
    
    if (!API_ID || !API_HASH) {
        console.error('⚠️  WARNING: TELEGRAM_API_ID and TELEGRAM_API_HASH are not set!');
        console.error('   Please create a .env file with these values.');
    } else {
        // Try to auto-connect with saved session
        await autoConnect();
    }
});
