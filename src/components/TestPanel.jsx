import { useState } from 'react';
import { parseSignal, validateSignal } from '../utils/signalParser';

const SAMPLE_MESSAGES = [
    `#US30
BUY_NOW
SL_46083.96 (11 Pips)
TP_46150.10            1:5❇️
TP1_46204.10          1:10❇️`,
    `#EURUSD
BUY_NOW
SL_1.08450 (20 Pips)
TP_1.08650            1:5❇️
TP1_1.08850          1:10❇️
TP2_1.09050          1:15❇️`,
    `#GBPJPY
SELL_NOW
SL_189.75 (30 Pips)
TP_189.15            1:4❇️
TP1_188.85          1:6❇️`
];

export default function TestPanel({ onSignalParsed }) {
    const [input, setInput] = useState('');
    const [parsedResult, setParsedResult] = useState(null);

    const handleParse = () => {
        if (!input.trim()) return;
        
        const signal = parseSignal(input);
        const isValid = validateSignal(signal);
        
        const result = {
            ...signal,
            timestamp: new Date(),
            channelName: 'Test Panel',
            isValid
        };
        
        setParsedResult(result);
        
        if (isValid && onSignalParsed) {
            onSignalParsed(result);
        }
    };

    const loadSample = (sample) => {
        setInput(sample);
        setParsedResult(null);
    };

    return (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
            <h2 className="text-xl font-bold text-white mb-4">🧪 Test Signal Parser</h2>
            
            {/* Sample messages */}
            <div className="mb-4">
                <label className="block text-sm font-medium text-slate-300 mb-2">
                    Quick Load Samples:
                </label>
                <div className="flex gap-2 flex-wrap">
                    {SAMPLE_MESSAGES.map((sample, index) => (
                        <button
                            key={index}
                            onClick={() => loadSample(sample)}
                            className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded text-sm transition"
                        >
                            Sample #{index + 1}
                        </button>
                    ))}
                </div>
            </div>

            {/* Input area */}
            <div className="mb-4">
                <label className="block text-sm font-medium text-slate-300 mb-2">
                    Paste Signal Message:
                </label>
                <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Paste your signal message here..."
                    className="w-full h-32 bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>

            <button
                onClick={handleParse}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg transition mb-4"
            >
                Parse Signal
            </button>

            {/* Parsed result */}
            {parsedResult && (
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-white">Parsed Result:</h3>
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            parsedResult.isValid 
                                ? 'bg-green-500/20 text-green-400' 
                                : 'bg-red-500/20 text-red-400'
                        }`}>
                            {parsedResult.isValid ? '✓ Valid' : '✗ Invalid'}
                        </span>
                    </div>
                    
                    <pre className="bg-slate-900 border border-slate-700 rounded p-4 text-sm text-slate-300 overflow-x-auto">
                        {JSON.stringify(parsedResult, null, 2)}
                    </pre>

                    {!parsedResult.isValid && (
                        <div className="bg-yellow-500/10 border border-yellow-500 rounded p-3">
                            <p className="text-yellow-400 text-sm">
                                ⚠️ Signal is missing required fields. Check that it has: pair, action, stopLoss, and at least one takeProfit.
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
