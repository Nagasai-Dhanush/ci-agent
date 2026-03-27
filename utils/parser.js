function extractError(logs) {
    const lines = logs.split("\n");
    return lines.slice(-50).join("\n");
}

function extractKeyword(logs) {
    const match = logs.match(
        /(npm ERR!.*|ModuleNotFoundError.*|ECONNRESET.*|AssertionError.*)/
    );
    return match ? match[0] : logs.slice(-200);
}

module.exports = { extractError, extractKeyword };