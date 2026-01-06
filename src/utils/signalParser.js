// Signal parser utility for extracting trade signals from Telegram messages

export const parseSignal = (text) => {
    // Remove emojis and extra symbols
    const cleanText = text.replace(/[\u{1F300}-\u{1FAFF}❇️]/gu, "").trim();
    
    // Split into lines
    const lines = cleanText.split(/\n+/).map(l => l.trim());
    
    // Initialize structured object
    const result = {
        pair: null,          // Currency pair / instrument
        action: null,        // BUY or SELL
        entry: null,         // Entry price (null = market)
        stopLoss: null,      // SL price
        takeProfits: []      // Array of TPs with optional RR
    };
    
    // Parse each line
    lines.forEach(line => {
        // Pair detection: lines starting with #
        if (line.startsWith("#")) {
            result.pair = line.replace("#", "").trim();
        }
        // Action detection
        else if (/BUY|SELL/i.test(line)) {
            result.action = /BUY/i.test(line) ? "BUY" : "SELL";
        }
        // Stop Loss
        else if (/SL[_\s]/i.test(line)) {
            const match = line.match(/SL[_\s]*([\d.]+)/i);
            if (match) result.stopLoss = parseFloat(match[1]);
        }
        // Take Profits (TP, TP1, TP2...)
        else if (/TP\d*[_\s]/i.test(line)) {
            const priceMatch = line.match(/TP\d*[_\s]*([\d.]+)/i);
            const rrMatch = line.match(/(\d+:\d+)/);
            if (priceMatch) {
                result.takeProfits.push({
                    price: parseFloat(priceMatch[1]),
                    rr: rrMatch ? rrMatch[1] : null
                });
            }
        }
    });
    
    return result;
};

// Validate that a parsed signal has all required fields
export const validateSignal = (signal) => {
    return !!(
        signal.pair &&
        signal.action &&
        signal.stopLoss &&
        signal.takeProfits.length > 0
    );
};
