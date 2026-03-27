// services/ai.js
const axios = require("axios");

function fallbackClassifier(logs) {
    if (logs.includes("ECONNRESET")) {
        return {
            type: "env_issue",
            reason: "Network connection reset",
            confidence: 0.9
        };
    }

    if (logs.includes("npm ERR")) {
        return {
            type: "dependency_issue",
            reason: "NPM dependency failure",
            confidence: 0.85
        };
    }

    if (logs.includes("AssertionError")) {
        return {
            type: "flaky_test",
            reason: "Assertion failure (likely flaky)",
            confidence: 0.8
        };
    }

    return null;
}

async function classifyError(input) {
    // 🔴 STEP 1: Try fallback first
    const fallback = fallbackClassifier(input);

    if (fallback) {
        console.log("⚡ Fallback rule triggered");
        return fallback;
    }

    // 🔴 STEP 2: Use Featherless AI only if needed
    const response = await axios.post(
        "https://api.featherless.ai/v1/chat/completions",
        {
            model: "featherless-gpt",
            messages: [
                {
                    role: "user",
                    content: `
Classify CI/CD failure.

Types:
- flaky_test
- dependency_issue
- env_issue
- code_error

Return STRICT JSON:
{
 "type": "...",
 "reason": "...",
 "confidence": 0-1
}

${input}
`
                }
            ]
        },
        {
            headers: {
                Authorization: `Bearer ${process.env.FEATHERLESS_API_KEY}`
            }
        }
    );

    let result;

    try {
        result = JSON.parse(response.data.choices[0].message.content);
    } catch {
        result = {
            type: "code_error",
            reason: "Parsing failure",
            confidence: 0.5
        };
    }

    return result;
}

module.exports = { classifyError };