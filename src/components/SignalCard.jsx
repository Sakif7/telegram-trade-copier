import { useState } from 'react';

export default function SignalCard({ signal, onExecute, onIgnore }) {
    const [executing, setExecuting] = useState(false);

    const handleExecute = async () => {
        setExecuting(true);
        await onExecute(signal);
        setExecuting(false);
    };

    const actionColor = signal.action === 'BUY' 
        ? 'text-green-400 bg-green-500/10 border-green-500' 
        : 'text-red-400 bg-red-500/10 border-red-500';

    return (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <h3 className="text-xl font-bold text-white">{signal.pair}</h3>
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold border ${actionColor}`}>
                        {signal.action}
                    </span>
                </div>
                <span className="text-xs text-slate-400">
                    {new Date(signal.timestamp).toLocaleTimeString()}
                </span>
            </div>

            {/* Source */}
            <div className="text-sm text-slate-400">
                📢 {signal.channelName}
            </div>

            {/* Trade Details */}
            <div className="grid grid-cols-2 gap-3">
                {/* Entry Price */}
                <div className="bg-slate-900 rounded p-3">
                    <div className="text-xs text-slate-400 mb-1">Entry</div>
                    <div className="text-white font-medium">
                        {signal.entry || 'Market Order'}
                    </div>
                </div>

                {/* Stop Loss */}
                <div className="bg-slate-900 rounded p-3">
                    <div className="text-xs text-slate-400 mb-1">Stop Loss</div>
                    <div className="text-red-400 font-medium">
                        {signal.stopLoss}
                    </div>
                </div>
            </div>

            {/* Take Profits */}
            <div className="bg-slate-900 rounded p-3">
                <div className="text-xs text-slate-400 mb-2">Take Profits</div>
                <div className="space-y-2">
                    {signal.takeProfits.map((tp, index) => (
                        <div key={index} className="flex justify-between items-center">
                            <span className="text-white">TP{index + 1}: {tp.price}</span>
                            {tp.rr && (
                                <span className="text-green-400 text-sm">
                                    {tp.rr} ✨
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
                <button
                    onClick={handleExecute}
                    disabled={executing}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white font-medium py-2 rounded-lg transition"
                >
                    {executing ? 'Executing...' : '⚡ Execute Trade'}
                </button>
                <button
                    onClick={() => onIgnore(signal)}
                    className="px-4 bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium py-2 rounded-lg transition"
                >
                    Ignore
                </button>
            </div>
        </div>
    );
}
