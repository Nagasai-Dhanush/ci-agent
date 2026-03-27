const axios = require("axios");
const log = require("../utils/logger");

// Known issue patterns from BrightData enrichment
const KNOWN_ISSUES = {
    "npm ERR!": "npm dependency resolution failure",
    "ECONNRESET": "network connection reset",
    "ModuleNotFoundError": "missing Python module",
    "Connection refused": "service not responding",
    "ETIMEDOUT": "connection timeout",
    "rate limited": "API rate limit exceeded",
    "403": "authentication/permission denied",
    "401": "authentication required"
};

async function enrichError(keyword) {
    log.debug("Enriching error with BrightData", { keyword });

    try {
        // Try to hit BrightData API with timeout
        const res = await axios.post(
            "https://api.brightdata.com/datasets/v1/query",
            { 
                query: keyword,
                limit: 5 
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.BRIGHTDATA_API_KEY}`,
                    "Content-Type": "application/json"
                },
                timeout: 3000
            }
        );

        log.info("BrightData enrichment successful", {
            resultsCount: res.data?.results?.length || 0
        });

        return {
            source: "brightdata",
            query: keyword,
            data: res.data,
            timestamp: new Date().toISOString()
        };
    } catch (err) {
        log.warn("BrightData API call failed", {
            error: err.message,
            keyword
        });

        // Fallback: Check against known issues locally
        return getLocalEnrichment(keyword);
    }
}

function getLocalEnrichment(keyword) {
    log.debug("Using local enrichment patterns");

    const enrichment = {
        source: "local_patterns",
        query: keyword,
        knownIssues: [],
        timestamp: new Date().toISOString()
    };

    Object.entries(KNOWN_ISSUES).forEach(([pattern, description]) => {
        if (keyword.toLowerCase().includes(pattern.toLowerCase())) {
            enrichment.knownIssues.push({
                pattern,
                description,
                matched: true
            });
        }
    });

    if (enrichment.knownIssues.length > 0) {
        log.info("Known issue pattern matched", {
            count: enrichment.knownIssues.length
        });
    }

    return enrichment;
}

function parseEnrichmentData(enrichment) {
    // Extract actionable signals from enrichment data
    const signals = {
        isKnownIssue: false,
        externalDataAvailable: false,
        suggestions: []
    };

    if (enrichment.source === "local_patterns" && enrichment.knownIssues.length > 0) {
        signals.isKnownIssue = true;
        signals.suggestions = enrichment.knownIssues.map(issue => issue.description);
    } else if (enrichment.source === "brightdata" && enrichment.data?.results) {
        signals.externalDataAvailable = true;
        signals.suggestions = enrichment.data.results.slice(0, 3);
    }

    return signals;
}

module.exports = {
    enrichError,
    getLocalEnrichment,
    parseEnrichmentData,
    KNOWN_ISSUES
};