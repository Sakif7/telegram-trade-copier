import { useState, useRef } from 'react';

export default function TelegramConnection({ onConnect, isConnected }) {
    const [step, setStep] = useState('phone'); // 'phone', 'code', 'password'
    const [phoneNumber, setPhoneNumber] = useState('');
    const [code, setCode] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    
    const codeResolverRef = useRef(null);
    const passwordResolverRef = useRef(null);

    const handlePhoneSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await onConnect(
                phoneNumber,
                async () => {
                    setStep('code');
                    setLoading(false);
                    return new Promise((resolve) => {
                        codeResolverRef.current = resolve;
                    });
                },
                async () => {
                    setStep('password');
                    return new Promise((resolve) => {
                        passwordResolverRef.current = resolve;
                    });
                }
            );
        } catch (err) {
            setError(err.message || 'Failed to connect');
            setLoading(false);
        }
    };

    const handleCodeSubmit = () => {
        if (code.length === 5 && codeResolverRef.current) {
            setLoading(true);
            codeResolverRef.current(code);
            codeResolverRef.current = null;
        }
    };

    const handlePasswordSubmit = () => {
        if (password && passwordResolverRef.current) {
            setLoading(true);
            passwordResolverRef.current(password);
            passwordResolverRef.current = null;
        }
    };

    const handleDisconnect = async () => {
        if (window.confirm('Are you sure you want to disconnect? You will need to login again.')) {
            try {
                await fetch('http://localhost:3001/api/telegram/logout', {
                    method: 'POST',
                });
                window.location.reload();
            } catch (error) {
                console.error('Disconnect error:', error);
            }
        }
    };

    if (isConnected) {
        return (
            <div className="bg-green-500/10 border border-green-500 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <div className="h-3 w-3 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="text-green-500 font-medium">Connected to Telegram</span>
                    </div>
                </div>
                <button
                    onClick={handleDisconnect}
                    className="w-full bg-red-600 hover:bg-red-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition"
                >
                    Disconnect
                </button>
            </div>
        );
    }

    return (
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <h2 className="text-xl font-bold text-white mb-4">Connect Telegram Account</h2>
            
            {error && (
                <div className="bg-red-500/10 border border-red-500 rounded p-3 mb-4">
                    <p className="text-red-500 text-sm">{error}</p>
                </div>
            )}

            {step === 'phone' && (
                <form onSubmit={handlePhoneSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Phone Number
                        </label>
                        <input
                            type="tel"
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value)}
                            placeholder="+1234567890"
                            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                        />
                        <p className="text-xs text-slate-400 mt-1">Include country code (e.g., +1)</p>
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white font-medium py-2 px-4 rounded-lg transition"
                    >
                        {loading ? 'Connecting...' : 'Send Code'}
                    </button>
                </form>
            )}

            {step === 'code' && (
                <div className="space-y-4">
                    <p className="text-slate-300 text-sm">
                        Enter the 5-digit code sent to your Telegram app
                    </p>
                    <input
                        type="text"
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        placeholder="12345"
                        maxLength={5}
                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white text-center text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                        onClick={handleCodeSubmit}
                        disabled={code.length !== 5 || loading}
                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition"
                    >
                        {loading ? 'Verifying...' : code.length === 5 ? 'Submit Code' : `Enter Code (${code.length}/5)`}
                    </button>
                </div>
            )}

            {step === 'password' && (
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            2FA Password
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter your 2FA password"
                            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <button
                        onClick={handlePasswordSubmit}
                        disabled={!password || loading}
                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition"
                    >
                        {loading ? 'Verifying...' : 'Submit Password'}
                    </button>
                </div>
            )}
        </div>
    );
}
