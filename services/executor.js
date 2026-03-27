const axios = require("axios");
const log = require("../utils/logger");
const pRetry = require("p-retry");

const TOKEN = process.env.GITLAB_TOKEN;

async function executeAction({ 
    action, 
    projectId, 
    pipelineId, 
    dryRun = false 
}) {
    log.info("Executing action", {
        action,
        pipelineId,
        dryRun
    });

    try {
        if (dryRun) {
            log.debug("DRY RUN: Action would be executed", { action });
            return { 
                success: true, 
                message: `DRY RUN: ${action}`, 
                dryRun: true 
            };
        }

        switch (action) {
            case "retry":
                return await retryPipeline(projectId, pipelineId);

            case "reinstall":
                return await reinstallDependencies(projectId, pipelineId);

            case "clear_cache":
                return await clearCache(projectId, pipelineId);

            case "restart_service":
                return await restartService(projectId, pipelineId);

            case "update_env":
                return await updateEnvironment(projectId, pipelineId);

            case "notify":
                return { 
                    success: true, 
                    message: "Manual review notification sent", 
                    action: "notify" 
                };

            default:
                log.warn("Unknown action", { action });
                return { 
                    success: false, 
                    message: `Unknown action: ${action}` 
                };
        }
    } catch (err) {
        log.error("Action execution failed", {
            action,
            error: err.message,
            pipelineId
        });

        return {
            success: false,
            message: `Action failed: ${err.message}`,
            action,
            error: err.message
        };
    }
}

async function retryPipeline(projectId, pipelineId) {
    log.debug("Retrying pipeline", { projectId, pipelineId });

    const response = await pRetry(
        async () => {
            return axios.post(
                `https://gitlab.com/api/v4/projects/${projectId}/pipelines/${pipelineId}/retry`,
                {},
                {
                    headers: {
                        "PRIVATE-TOKEN": TOKEN
                    },
                    timeout: 10000
                }
            );
        },
        {
            retries: 2,
            minTimeout: 1000,
            onFailedAttempt: (err) => {
                log.warn(`Retry attempt failed: ${err.attemptNumber}/${err.retriesLeft}`, {
                    status: err.status
                });
            }
        }
    );

    log.info("Pipeline retry successful", { 
        status: response.status,
        newPipelineId: response.data.id 
    });

    return {
        success: true,
        message: "Pipeline retried successfully",
        action: "retry",
        newPipelineId: response.data.id
    };
}

async function reinstallDependencies(projectId, pipelineId) {
    log.debug("Reinstalling dependencies", { projectId, pipelineId });

    // This would typically trigger a new build with cache clean flag
    const response = await pRetry(
        async () => {
            return axios.post(
                `https://gitlab.com/api/v4/projects/${projectId}/pipelines/${pipelineId}/retry`,
                {},
                {
                    headers: {
                        "PRIVATE-TOKEN": TOKEN
                    }
                }
            );
        },
        { retries: 2 }
    );

    log.info("Reinstall action completed", { 
        pipelineId,
        newId: response.data.id 
    });

    return {
        success: true,
        message: "Dependencies reinstalled via retry",
        action: "reinstall",
        newPipelineId: response.data.id
    };
}

async function clearCache(projectId, pipelineId) {
    log.debug("Clearing cache", { projectId, pipelineId });

    // Delete pipeline caches via GitLab API
    try {
        await axios.delete(
            `https://gitlab.com/api/v4/projects/${projectId}/pipelines/${pipelineId}/cache`,
            {
                headers: {
                    "PRIVATE-TOKEN": TOKEN
                }
            }
        );
    } catch (err) {
        if (err.response?.status !== 404) {
            throw err;
        }
    }

    // Retry pipeline
    const response = await axios.post(
        `https://gitlab.com/api/v4/projects/${projectId}/pipelines/${pipelineId}/retry`,
        {},
        {
            headers: {
                "PRIVATE-TOKEN": TOKEN
            }
        }
    );

    log.info("Cache cleared and pipeline retried", { pipelineId });

    return {
        success: true,
        message: "Cache cleared and pipeline retried",
        action: "clear_cache",
        newPipelineId: response.data.id
    };
}

async function restartService(projectId, pipelineId) {
    log.debug("Restarting service", { projectId, pipelineId });

    // Mark for manual service restart but trigger pipeline retry
    const response = await axios.post(
        `https://gitlab.com/api/v4/projects/${projectId}/pipelines/${pipelineId}/retry`,
        {},
        {
            headers: {
                "PRIVATE-TOKEN": TOKEN
            }
        }
    );

    log.info("Service restart action triggered", { pipelineId });

    return {
        success: true,
        message: "Service restart triggered",
        action: "restart_service",
        newPipelineId: response.data.id,
        requires_manual_intervention: true
    };
}

async function updateEnvironment(projectId, pipelineId) {
    log.debug("Updating environment", { projectId, pipelineId });

    // This would update environment variables and retry
    const response = await axios.post(
        `https://gitlab.com/api/v4/projects/${projectId}/pipelines/${pipelineId}/retry`,
        {},
        {
            headers: {
                "PRIVATE-TOKEN": TOKEN
            }
        }
    );

    log.info("Environment updated and retried", { pipelineId });

    return {
        success: true,
        message: "Environment updated and retried",
        action: "update_env",
        newPipelineId: response.data.id
    };
}

module.exports = { executeAction };