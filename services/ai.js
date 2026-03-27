// services/ai.js - LLM-powered error classification with chain-of-thought
const log = require("../utils/logger");
const {
    analyzeWithChainOfThought,
    heuristicClassification
} = require("../utils/llm-reasoning");

async function classifyError(errorLogs, enrichmentData = {}) {
    log.info("Starting error classification");

    try {
        // Step 1: Try chain-of-thought reasoning with Featherless AI
        log.debug("Attempting chain-of-thought analysis");
        const llmAnalysis = await analyzeWithChainOfThought(errorLogs, enrichmentData);

        log.info("LLM analysis successful", {
            type: llmAnalysis.type,
            confidence: llmAnalysis.confidence,
            severity: llmAnalysis.severity
        });

        return llmAnalysis;
    } catch (err) {
        log.warn("LLM analysis failed, falling back to heuristics", {
            error: err.message
        });

        // Step 2: Fallback to heuristic classification
        const heuristicResult = heuristicClassification(errorLogs, enrichmentData);

        log.info("Heuristic classification used", {
            type: heuristicResult.type,
            confidence: heuristicResult.confidence
        });

        return heuristicResult;
    }
}

module.exports = { classifyError };