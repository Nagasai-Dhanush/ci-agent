const log = require("./logger");

// Extract relevant error from logs (last N lines + search for error markers)
function extractError(logs) {
    if (!logs) return "";

    const lines = logs.split("\n");

    // Look for error markers
    const errorStartIndex = lines.findIndex(line => 
        line.toLowerCase().match(/(error|failed|exception|fatal|emergency|critical)/)
    );

    // Get context: if error found, take 30 lines around it + last 50 lines
    if (errorStartIndex >= 0) {
        const contextStart = Math.max(0, errorStartIndex - 10);
        const contextEnd = Math.min(lines.length, errorStartIndex + 30);
        const errorContext = lines.slice(contextStart, contextEnd).join("\n");

        // Also append last 20 lines for full context
        const lastLines = lines.slice(-20).join("\n");

        return `${errorContext}\n\n--- FINAL OUTPUT ---\n${lastLines}`;
    }

    // Fallback: return last 100 lines
    return lines.slice(-100).join("\n");
}

// Extract keyword/pattern from logs for enrichment
function extractKeyword(logs) {
    const patterns = [
        /npm ERR!.*/,
        /(?:Error|error|ERROR):\s*(.+)/,
        /ModuleNotFoundError[:\s](.+)/,
        /ConnectionError[:\s](.+)/,
        /ECONNRESET|ENOTFOUND|ETIMEDOUT|EACCES|EPERM/,
        /AssertionError[:\s](.+)/,
        /SyntaxError[:\s](.+)/,
        /TypeError[:\s](.+)/,
        /ReferenceError[:\s](.+)/,
        /timeout|TIMEOUT/i,
        /rate limit|rate_limit|429/i,
        /permission denied|unauthorized|403|401/i
    ];

    for (const pattern of patterns) {
        const match = logs.match(pattern);
        if (match) {
            const keyword = match[1] || match[0];
            log.trace("Keyword extracted", { keyword });
            return keyword;
        }
    }

    // Last resort: extract a meaningful summary
    const lines = logs.split("\n");
    const errorLines = lines.filter(line => 
        line.toLowerCase().includes("error") || 
        line.toLowerCase().includes("failed")
    );

    if (errorLines.length > 0) {
        return errorLines[0].substring(0, 200);
    }

    return logs.slice(-200);
}

// Extract stack trace if available
function extractStackTrace(logs) {
    const lines = logs.split("\n");
    const traceStart = lines.findIndex(line => 
        line.trim().match(/^at\s|^stack trace|stacktrace/i)
    );

    if (traceStart >= 0) {
        const traceEnd = Math.min(traceStart + 15, lines.length);
        return lines.slice(traceStart, traceEnd).join("\n");
    }

    return null;
}

// Parse structured logs (JSON logs)
function parseStructuredLog(logLine) {
    try {
        return JSON.parse(logLine);
    } catch {
        return null;
    }
}

// Get summary statistics from logs
function getLogStats(logs) {
    const lines = logs.split("\n");
    
    return {
        total_lines: lines.length,
        error_count: lines.filter(l => l.toLowerCase().includes("error")).length,
        warning_count: lines.filter(l => l.toLowerCase().includes("warn")).length,
        has_stack_trace: logs.includes("at ") || logs.includes("Stack trace"),
        last_line: lines[lines.length - 1],
        has_timeout: logs.toLowerCase().includes("timeout"),
        has_connection_error: logs.match(/ECONNRESET|ENOTFOUND|ETIMEDOUT/)?.length || 0
    };
}

module.exports = {
    extractError,
    extractKeyword,
    extractStackTrace,
    parseStructuredLog,
    getLogStats
};