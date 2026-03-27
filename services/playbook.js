const log = require("../utils/logger");
const { validateAction, getExplanationTemplate } = require("../config/playbook-guard");

// Safe playbook mapping: determine best remediation action per error type
const PLAYBOOK = {
    flaky_test: {
        primary: "retry",
        fallback: ["notify"],
        description: "Transient test failure - safe to retry",
        max_attempts: 2
    },
    dependency_issue: {
        primary: "reinstall",
        fallback: ["clear_cache", "retry"],
        description: "Package installation or compatibility issue",
        max_attempts: 2
    },
    env_issue: {
        primary: "retry",
        fallback: ["update_env", "notify"],
        description: "Environment or temporary connectivity issue",
        max_attempts: 2
    },
    timeout: {
        primary: "retry",
        fallback: ["restart_service", "notify"],
        description: "Operation exceeded time limit",
        max_attempts: 3
    },
    rate_limit: {
        primary: "retry",
        fallback: ["update_env"],
        description: "External service rate limit hit",
        max_attempts: 2
    },
    permission_error: {
        primary: "notify",
        fallback: ["update_env"],
        description: "Authentication or authorization failure",
        max_attempts: 1
    },
    code_error: {
        primary: "notify",
        fallback: [],
        description: "Application logic error - requires developer review",
        max_attempts: 1
    }
};

function getAction(errorType, options = {}) {
    const { confidence = 0.8, retryCount = 0, dryRun = false } = options;

    log.debug("Getting playbook action", {
        errorType,
        confidence,
        retryCount
    });

    const entry = PLAYBOOK[errorType];

    if (!entry) {
        log.warn("Unknown error type in playbook", { errorType });
        return "notify";
    }

    // Check if max attempts exceeded
    if (retryCount >= entry.max_attempts) {
        log.info("Max attempts reached, escalating to manual", {
            errorType,
            retryCount,
            maxAttempts: entry.max_attempts
        });
        return "notify";
    }

    // Validate primary action
    const validation = validateAction(entry.primary, errorType);

    if (!validation.valid) {
        log.warn("Primary action validation failed", {
            action: entry.primary,
            errorType,
            reason: validation.reason
        });

        // Try fallback actions
        for (const fallbackAction of entry.fallback) {
            const fallbackValidation = validateAction(fallbackAction, errorType);
            if (fallbackValidation.valid) {
                log.info("Using fallback action", {
                    original: entry.primary,
                    fallback: fallbackAction
                });
                return fallbackAction;
            }
        }

        // All actions failed validation, escalate
        log.warn("All actions failed validation, escalating", { errorType });
        return "notify";
    }

    log.info("Playbook action selected", {
        errorType,
        action: entry.primary
    });

    return entry.primary;
}

function getPlaybookEntry(errorType) {
    return PLAYBOOK[errorType] || null;
}

function getExplanation(errorType, selectedAction, confidence) {
    const entry = PLAYBOOK[errorType];
    const template = getExplanationTemplate(errorType, selectedAction, confidence);

    return {
        errorType,
        selectedAction,
        playbookEntry: entry,
        explanation: template,
        confidence
    };
}

module.exports = {
    getAction,
    getPlaybookEntry,
    getExplanation,
    PLAYBOOK
};