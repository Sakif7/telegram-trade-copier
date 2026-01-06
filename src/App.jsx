import { useState, useEffect } from 'react';
import TelegramConnection from './components/TelegramConnection';
import SignalCard from './components/SignalCard';
import TestPanel from './components/TestPanel';
import { telegramService } from './services/telegram.service';
import { parseSignal, validateSignal } from './utils/signalParser';

function App() {
    const [isConnected, setIsConnected] = useState(false);
    const [channels, setChannels] = useState([]);
    const [selectedChannels, setSelectedChannels] = useState([]);
    const [isMonitoring, setIsMonitoring] = useState(false);
    const [signals, setSignals] = useState([]);
    const [tradeHistory, setTradeHistory] = useState([]);
    const [checkingStatus, setCheckingStatus] = useState(true);

    // Check if backend is already connected on mount
    useEffect(() => {
        const checkBackendStatus = async () => {
            try {
                const response = await fetch('http://localhost:3001/api/telegram/status');
                const data = await response.json();
                
                if (data.connected) {
                    console.log('✅ Backend already connected as:', data.user.firstName);
                    setIsConnected(true);
                    
                    // Load channels
                    const channelsResponse = await fetch('http://localhost:3001/api/telegram/channels');
                    const channelsData = await channelsResponse.json();
                    const allChannels = channelsData.channels.filter(d => d.isChannel || d.isGroup);
                    setChannels(allChannels);
                    
                    // IMPORTANT: Update telegramService state
                    telegramService.isConnected = true;
                    telegramService.dialogs = channelsData.channels;
                } else {
                    console.log('❌ Backend not connected');
                }
            } catch (error) {
                console.error('Error checking backend status:', error);
            } finally {
                setCheckingStatus(false);
            }
        };

        checkBackendStatus();
    }, []);

    // Handle Telegram connection
    const handleConnect = async (phoneNumber, phoneCodeCallback, passwordCallback) => {
        const result = await telegramService.connect(
            phoneNumber,
            phoneCodeCallback,
            passwordCallback
        );

        if (result.success) {
            setIsConnected(true);
            const dialogs = telegramService.getDialogs();
            setChannels(dialogs.filter(d => d.isChannel || d.isGroup));
            
            // Save session to localStorage
            localStorage.setItem('telegram_session', result.session);
        }

        return result;
    };

    // Handle channel selection
    const toggleChannel = (channelId) => {
        setSelectedChannels(prev => {
            if (prev.includes(channelId)) {
                return prev.filter(id => id !== channelId);
            } else {
                return [...prev, channelId];
            }
        });
    };

    // Start monitoring function
    const startMonitoring = async () => {
        if (selectedChannels.length === 0) {
            alert('Please select at least one channel to monitor');
            return;
        }

        try {
            await telegramService.startMonitoring(selectedChannels, handleNewMessage);
            setIsMonitoring(true);
            console.log('Started monitoring channels:', selectedChannels);
        } catch (error) {
            console.error('Failed to start monitoring:', error);
            alert('Failed to start monitoring: ' + error.message);
        }
    };

    // Stop monitoring function
    const stopMonitoring = () => {
        setIsMonitoring(false);
        console.log('Stopped monitoring');
    };

    // Handle new messages from Telegram
    const handleNewMessage = (message) => {
        const parsed = parseSignal(message.text);
        
        if (validateSignal(parsed)) {
            const signal = {
                ...parsed,
                channelId: message.channelId,
                channelName: message.channelName,
                timestamp: message.timestamp,
                id: Date.now() + Math.random(), // Simple unique ID
            };
            
            setSignals(prev => [signal, ...prev]);
        }
    };

    // Handle signal from test panel
    const handleTestSignal = (signal) => {
        setSignals(prev => [{ ...signal, id: Date.now() + Math.random() }, ...prev]);
    };

    // Execute trade
    const executeTrade = async (signal) => {
        console.log('Executing trade:', signal);
        
        // Placeholder for CRM API integration
        const trade = {
            ...signal,
            executedAt: new Date(),
            status: 'executed',
        };
        
        setTradeHistory(prev => [trade, ...prev]);
        setSignals(prev => prev.filter(s => s.id !== signal.id));
        
        // CRM trading API
        // const response = await fetch('CRM_API/trade', {
        //     method: 'POST',
        //     body: JSON.stringify(trade)
        // });
    };

    // Ignore signal
    const ignoreSignal = (signal) => {
        setSignals(prev => prev.filter(s => s.id !== signal.id));
    };

    return (
        <div className="min-h-screen bg-slate-950 text-white">
            <div className="container mx-auto px-4 py-8 max-w-7xl">
                {/* Header */}
                {/* <header className="mb-8">
                    <h1 className="text-4xl font-bold mb-2">Telegram Trading Bot</h1>
                    <p className="text-slate-400">Monitor trading signals from Telegram channels</p>
                </header> */}

                {/* Main Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column - Connection & Channels */}
                    <div className="space-y-6">
                        {/* Connection Status */}
                        <TelegramConnection 
                            onConnect={handleConnect}
                            isConnected={isConnected}
                        />

                        {/* Channel Selection */}
                        {isConnected && channels.length > 0 && (
                            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
                                <h2 className="text-xl font-bold mb-4">Monitor Channels</h2>
                                <div className="space-y-2 max-h-96 overflow-y-auto">
                                    {channels.map(channel => (
                                        <label
                                            key={channel.id}
                                            className="flex items-center gap-3 p-3 bg-slate-900 rounded hover:bg-slate-800 cursor-pointer transition"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedChannels.includes(channel.id.toString())}
                                                onChange={() => toggleChannel(channel.id.toString())}
                                                className="w-4 h-4 accent-blue-600"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-white truncate">{channel.name}</div>
                                                <div className="text-xs text-slate-400">
                                                    {channel.isChannel ? 'Channel' : '👥 Group'}
                                                </div>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                                <div className="mt-4 space-y-3">
                                    <div className="text-sm text-slate-400">
                                        {selectedChannels.length} channel(s) selected
                                    </div>
                                    
                                    {!isMonitoring ? (
                                        <button
                                            onClick={startMonitoring}
                                            disabled={selectedChannels.length === 0}
                                            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition"
                                        >
                                            Start Monitoring
                                        </button>
                                    ) : (
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500 rounded-lg">
                                                <div className="h-3 w-3 bg-green-500 rounded-full animate-pulse"></div>
                                                <span className="text-green-400 font-medium text-sm">Monitoring Active</span>
                                            </div>
                                            <button
                                                onClick={stopMonitoring}
                                                className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition"
                                            >
                                                Stop Monitoring
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Test Panel */}
                        {/* <TestPanel onSignalParsed={handleTestSignal} /> */}
                    </div>

                    {/* Middle & Right Columns - Signals & History */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Active Signals */}
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-2xl font-bold">Active Signals</h2>
                                <span className="px-3 py-1 bg-blue-600 rounded-full text-sm">
                                    {signals.length} signals
                                </span>
                            </div>
                            
                            {signals.length === 0 ? (
                                <div className="bg-slate-800 border border-slate-700 rounded-lg p-8 text-center">
                                    <p className="text-slate-400">No active signals</p>
                                    <p className="text-sm text-slate-500 mt-1">
                                        Signals will appear here when detected
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {signals.map(signal => (
                                        <SignalCard
                                            key={signal.id}
                                            signal={signal}
                                            onExecute={executeTrade}
                                            onIgnore={ignoreSignal}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Trade History */}
                        {tradeHistory.length > 0 && (
                            <div>
                                <h2 className="text-2xl font-bold mb-4">Trade History</h2>
                                <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead className="bg-slate-900">
                                                <tr>
                                                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Time</th>
                                                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Pair</th>
                                                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Action</th>
                                                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">SL</th>
                                                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">TPs</th>
                                                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {tradeHistory.map((trade, index) => (
                                                    <tr key={index} className="border-t border-slate-700">
                                                        <td className="px-4 py-3 text-sm text-slate-400">
                                                            {new Date(trade.executedAt).toLocaleTimeString()}
                                                        </td>
                                                        <td className="px-4 py-3 text-sm font-medium text-white">
                                                            {trade.pair}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <span className={`text-sm font-semibold ${
                                                                trade.action === 'BUY' ? 'text-green-400' : 'text-red-400'
                                                            }`}>
                                                                {trade.action}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-slate-300">
                                                            {trade.stopLoss}
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-slate-300">
                                                            {trade.takeProfits.length} TPs
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs">
                                                                {trade.status}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default App;
