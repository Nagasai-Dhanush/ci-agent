// Safety guards and limits for autonomous actions
const { z } = require("zod");

const SafeActionSchema = z.enum([
    "retry",
    "reinstall",
    "clear_cache",
    "restart_service",
    "update_env",
    "notify"
]);

const PowerfulActionSchema = z.enum([
    "modify_code",
    "delete_branches",
    "alter_permissions",
    "modify_production"
]);

const SAFETY_LIMITS = {
    max_retries_per_pipeline: 2,
    max_retries_per_day: 10,
    min_confidence_for_action: 0.75,
    timeout_per_action: 30000, // 30 seconds
    cooldown_between_actions: 5000 // 5 seconds
};

const ACTION_COOLDOWNS = {
    retry: 10000, // 10 seconds between retries
    reinstall: 15000, // 15 seconds
    clear_cache: 5000,
    restart_service: 20000,
    update_env: 5000
};

const ERROR_TYPE_SEVERITY = {
    flaky_test: "low",
    env_issue: "low",
    dependency_issue: "medium",
    code_error: "high",
    rate_limit: "low",
    timeout: "medium",
    permission_error: "high"
};

function isSafeAction(action) {
    try {
        SafeActionSchema.parse(action);
        return true;
    } catch {
        return false;
    }
}

function isPowerfulAction(action) {
    try {
        PowerfulActionSchema.parse(action);
        return true;
    } catch {
        return false;
    }
}

function getActionCooldown(action) {
    return ACTION_COOLDOWNS[action] || 5000;
}

function shouldExecuteAction(confidence, errorType, retryCount) {
    // Returns true if action should be executed, false if manual review needed
    
    if (retryCount >= SAFETY_LIMITS.max_retries_per_pipeline) {
        return { allowed: false, reason: "Max retries reached" };
    }

    if (confidence < SAFETY_LIMITS.min_confidence_for_action) {
        return { allowed: false, reason: "Low confidence" };
    }

    const severity = ERROR_TYPE_SEVERITY[errorType] || "medium";
    
    if (severity === "high" && confidence < 0.85) {
        return { allowed: false, reason: "High severity requires >0.85 confidence" };
    }

    return { allowed: true };
}

function validateAction(action, errorType) {
    // Validate action is appropriate for error type
    if (!isSafeAction(action)) {
        return { valid: false, reason: "Action is not in safe list" };
    }

    // Map error types to allowed actions
    const allowedActions = {
        flaky_test: ["retry"],
        env_issue: ["retry", "update_env"],
        dependency_issue: ["reinstall", "clear_cache"],
        timeout: ["retry", "restart_service"],
        rate_limit: ["retry", "update_env"],
        permission_error: ["notify"],
        code_error: ["notify"]
    };

    const allowed = allowedActions[errorType] || ["notify"];
    
    if (!allowed.includes(action)) {
        return { 
            valid: false, 
            reason: `Action '${action}' not allowed for '${errorType}' errors. Allowed: ${allowed.join(", ")}` 
        };
    }

    return { valid: true };
}

function getExplanationTemplate(errorType, action, confidence) {
    const templates = {
        retry: {
            flaky_test: "This appears to be a transient test failure. Retrying isolated execution.",
            env_issue: "Detected temporary environment issue. This commonly resolves with retry.",
            timeout: "API timeout detected. Retrying with backoff."
        },
        reinstall: {
            dependency_issue: "Dependency installation failed. Clearing cache and reinstalling."
        },
        clear_cache: {
            dependency_issue: "Cache corruption suspected. Clearing build cache."
        },
        update_env: {
            env_issue: "Environment variable issue detected. Updating configuration.",
            rate_limit: "Rate limit detected. Updating backoff configuration."
        },
        notify: {
            code_error: "Code logic error detected requiring developer review.",
            permission_error: "Permission denied. Manual intervention required."
        }
    };

    const template = templates[action]?.[errorType];
    return template || `Executing ${action} for ${errorType}`;
}

module.exports = {
    SAFETY_LIMITS,
    ACTION_COOLDOWNS,
    ERROR_TYPE_SEVERITY,
    isSafeAction,
    isPowerfulAction,
    shouldExecuteAction,
    validateAction,
    getActionCooldown,
    getExplanationTemplate
};
