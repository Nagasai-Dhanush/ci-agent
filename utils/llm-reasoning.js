const axios = require("axios");
const log = require("./logger");

// Chain-of-thought reasoning for better analysis
async function analyzeWithChainOfThought(errorLogs, enrichmentData) {
    const prompt = `
You are an expert DevOps engineer analyzing CI/CD failures.

TASK: Analyze this failing CI/CD build and determine root cause.

ANALYSIS STEPS:
1. Extract error pattern from logs
2. Check for known issues and patterns
3. Cross-reference with enrichment signals
4. Determine most likely root cause
5. Assign confidence score
6. Suggest remediation

ERROR LOGS:
\`\`\`
${errorLogs.slice(0, 2000)}
\`\`\`

ENRICHMENT DATA (external signals):
\`\`\`
${JSON.stringify(enrichmentData, null, 2).slice(0, 500)}
\`\`\`

RESPONSE FORMAT (strict JSON only):
{
  "error_pattern": "description of what failed",
  "root_cause": "most likely cause",
  "type": "flaky_test | dependency_issue | env_issue | code_error | timeout | rate_limit | permission_error",
  "confidence": 0.0-1.0,
  "reasoning": [
    "step 1 analysis",
    "step 2 analysis",
    "step 3 analysis"
  ],
  "suggested_action": "retry | reinstall | clear_cache | restart_service | update_env | notify",
  "severity": "low | medium | high",
  "is_actionable": true | false
}

Provide ONLY valid JSON, no markdown code blocks.
`;

    try {
        log.trace("Sending chain-of-thought request to Featherless AI", { 
            promptLength: prompt.length 
        });

        const response = await axios.post(
            "https://api.featherless.ai/v1/chat/completions",
            {
                model: "Qwen/Qwen2.5-7B-Instruct",
                messages: [
                    {
                        role: "system",
                        content: "You are a CI/CD failure analysis expert. Respond with strict JSON only."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: 0.3, // Lower temperature for more consistent analysis
                max_tokens: 1000
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.FEATHERLESS_API_KEY}`,
                    "Content-Type": "application/json"
                },
                timeout: 15000
            }
        );

        let content = response.data.choices[0].message.content;

// Try extracting JSON safely
let parsed;

try {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON found");

    parsed = JSON.parse(match[0]);
} catch (e) {
    console.warn("⚠️ Failed to parse AI JSON, raw output:", content);

    // fallback safe response
    return {
        type: "unknown",
        confidence: 0.5,
        severity: "medium",
        suggested_action: "notify"
    };
}

return parsed;
        log.trace("Raw LLM response received", { length: content.length });

        // Try to extract JSON (handle markdown code blocks)
        let jsonStr = content;
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
            jsonStr = jsonMatch[1];
        }

        const analysis = JSON.parse(jsonStr);

        log.info("Chain-of-thought analysis complete", {
            type: analysis.type,
            confidence: analysis.confidence,
            severity: analysis.severity
        });

        return {
            ...analysis,
            source: "featherless_ai",
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        log.warn("Chain-of-thought analysis failed", {
            error: error.message,
            status: error.response?.status
        });
        throw error;
    }
}

// Fallback heuristic-based classification
function heuristicClassification(logs, enrichment) {
    const patterns = [
        {
            type: "flaky_test",
            patterns: ["AssertionError", "Timeout waiting", "FAIL", "test failed", "expected"],
            keywords: ["random", "intermittent", "timing", "race"],
            confidence: 0.8,
            action: "retry",
            severity: "low"
        },
        {
            type: "dependency_issue",
            patterns: ["npm ERR!", "ENOENT", "Cannot find module", "ModuleNotFoundError", "pip install"],
            keywords: ["dependency", "package", "version", "conflict", "incompatible"],
            confidence: 0.85,
            action: "reinstall",
            severity: "medium"
        },
        {
            type: "env_issue",
            patterns: ["ECONNRESET", "ENOTFOUND", "getaddrinfo", "Connection refused", "ETIMEDOUT"],
            keywords: ["environment", "network", "dns", "connection", "port"],
            confidence: 0.8,
            action: "retry",
            severity: "low"
        },
        {
            type: "rate_limit",
            patterns: ["429", "Too Many Requests", "rate limit", "quota exceeded"],
            keywords: ["limit", "quota", "throttle", "exceeded"],
            confidence: 0.9,
            action: "retry",
            severity: "low"
        },
        {
            type: "timeout",
            patterns: ["timeout", "TIMEOUT", "timed out", "deadline exceeded"],
            keywords: ["timeout", "deadline", "slow", "hanging"],
            confidence: 0.85,
            action: "retry",
            severity: "medium"
        },
        {
            type: "permission_error",
            patterns: ["Permission denied", "EACCES", "EPERM", "unauthorized", "403", "401"],
            keywords: ["permission", "auth", "token", "credential", "forbidden"],
            confidence: 0.9,
            action: "notify",
            severity: "high"
        },
        {
            type: "code_error",
            patterns: ["SyntaxError", "TypeError", "ReferenceError", "undefined", "null is not"],
            keywords: ["error", "exception", "undefined", "null", "logic"],
            confidence: 0.8,
            action: "notify",
            severity: "high"
        }
    ];

    const combined = `${logs}${JSON.stringify(enrichment || {})}`.toLowerCase();

    let bestMatch = null;
    let bestScore = 0;

    patterns.forEach(pattern => {
        let score = 0;

        // Check patterns (strong signal)
        pattern.patterns.forEach(p => {
            if (combined.includes(p.toLowerCase())) {
                score += 0.3;
            }
        });

        // Check keywords (weaker signal)
        pattern.keywords.forEach(k => {
            if (combined.includes(k.toLowerCase())) {
                score += 0.1;
            }
        });

        if (score > bestScore) {
            bestScore = score;
            bestMatch = pattern;
        }
    });

    if (bestMatch && bestScore > 0) {
        log.debug("Heuristic match found", {
            type: bestMatch.type,
            score: bestScore
        });

        return {
            error_pattern: bestMatch.type,
            root_cause: `Likely ${bestMatch.type}`,
            type: bestMatch.type,
            confidence: Math.min(bestMatch.confidence * (bestScore / 0.5), 0.95), // Cap at 0.95
            reasoning: [`Pattern matched: ${bestMatch.type}`, `Signal strength: ${(bestScore * 100).toFixed(0)}%`],
            suggested_action: bestMatch.action,
            severity: bestMatch.severity,
            is_actionable: bestScore > 0.15,
            source: "heuristic"
        };
    }

    return {
        error_pattern: "unknown",
        root_cause: "Unable to classify error",
        type: "code_error",
        confidence: 0.4,
        reasoning: ["No clear patterns matched", "Requires manual review"],
        suggested_action: "notify",
        severity: "high",
        is_actionable: false,
        source: "heuristic_fallback"
    };
}

module.exports = {
    analyzeWithChainOfThought,
    heuristicClassification
};
