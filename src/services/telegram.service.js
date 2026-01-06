// Frontend service that communicates with the backend API

const API_URL = 'http://localhost:3001/api';

class TelegramService {
    constructor() {
        this.isConnected = false;
        this.dialogs = [];
        this.eventSource = null;
    }

    async connect(phoneNumber, phoneCodeCallback, passwordCallback) {
        try {
            // Start connection process
            const response = await fetch(`${API_URL}/telegram/connect`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phoneNumber }),
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Failed to connect');
            }

            if (data.step === 'code') {
                // Get code from callback
                const code = await phoneCodeCallback();
                
                // Submit code to backend
                await fetch(`${API_URL}/telegram/code`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code }),
                });

                // Wait for authentication to complete
                await new Promise(resolve => setTimeout(resolve, 3000));
            }

            // Try to get channels with retries
            let channels = [];
            let retries = 5;
            while (retries > 0) {
                try {
                    const channelsResponse = await fetch(`${API_URL}/telegram/channels`);
                    
                    if (channelsResponse.ok) {
                        const channelsData = await channelsResponse.json();
                        channels = channelsData.channels || [];
                        break;
                    } else {
                        // Wait and retry
                        await new Promise(resolve => setTimeout(resolve, 2000));
                        retries--;
                    }
                } catch (err) {
                    console.error('Error fetching channels:', err);
                    retries--;
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }

            if (channels.length === 0 && retries === 0) {
                throw new Error('Failed to fetch channels. Connection may not be complete.');
            }

            this.dialogs = channels;
            this.isConnected = true;

            return { 
                success: true, 
                session: data.session 
            };
        } catch (error) {
            console.error('Failed to connect to Telegram:', error);
            return { success: false, error: error.message };
        }
    }

    async loadDialogs() {
        if (!this.isConnected) return [];
        
        try {
            const response = await fetch(`${API_URL}/telegram/channels`);
            const data = await response.json();
            this.dialogs = data.channels || [];
            return this.dialogs;
        } catch (error) {
            console.error('Failed to load dialogs:', error);
            return [];
        }
    }

    async startMonitoring(channelIds, onMessage) {
        if (!this.isConnected) {
            throw new Error('Client not connected');
        }

        try {
            // Tell backend to start monitoring
            await fetch(`${API_URL}/telegram/monitor`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ channelIds }),
            });

            // Setup SSE for real-time messages
            this.eventSource = new EventSource(`${API_URL}/messages/stream`);
            
            this.eventSource.onmessage = (event) => {
                const message = JSON.parse(event.data);
                
                // Get channel name from dialogs
                const dialog = this.dialogs.find(d => d.id === message.channelId);
                
                onMessage({
                    text: message.text,
                    channelId: message.channelId,
                    channelName: dialog?.name || 'Unknown',
                    timestamp: new Date(message.timestamp),
                });
            };

            this.eventSource.onerror = (error) => {
                console.error('SSE error:', error);
            };

            return { success: true };
        } catch (error) {
            console.error('Failed to start monitoring:', error);
            throw error;
        }
    }

    async disconnect() {
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
        }

        try {
            await fetch(`${API_URL}/telegram/disconnect`, {
                method: 'POST',
            });
            this.isConnected = false;
        } catch (error) {
            console.error('Failed to disconnect:', error);
        }
    }

    getDialogs() {
        return this.dialogs;
    }

    isClientConnected() {
        return this.isConnected;
    }
}

export const telegramService = new TelegramService();
