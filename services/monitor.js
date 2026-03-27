// In-memory monitoring with persistence ready
const log = require("../utils/logger");

const executionHistory = {};
const projectMetrics = {};

function trackExecution(pipelineId, projectId, data) {
    if (!executionHistory[pipelineId]) {
        executionHistory[pipelineId] = [];
    }

    executionHistory[pipelineId].push({
        timestamp: new Date().toISOString(),
        projectId,
        ...data
    });

    // Update project metrics
    if (!projectMetrics[projectId]) {
        projectMetrics[projectId] = {
            total_failures: 0,
            resolved_auto: 0,
            failed_auto: 0,
            manual_reviews: 0,
            by_type: {}
        };
    }

    const metric = projectMetrics[projectId];
    metric.total_failures++;

    if (data.status === "resolved") {
        metric.resolved_auto++;
    } else if (data.status === "failed") {
        metric.failed_auto++;
    } else if (data.status === "manual_review") {
        metric.manual_reviews++;
    }

    // Track by error type
    if (data.errorType) {
        if (!metric.by_type[data.errorType]) {
            metric.by_type[data.errorType] = 0;
        }
        metric.by_type[data.errorType]++;
    }

    log.info("Execution tracked", {
        pipelineId,
        projectId,
        status: data.status,
        errorType: data.errorType
    });
}

function getProjectMetrics(projectId) {
    return projectMetrics[projectId] || null;
}

function getSuccessRate(projectId) {
    const metric = projectMetrics[projectId];
    if (!metric || metric.total_failures === 0) return 0;
    return (metric.resolved_auto / metric.total_failures * 100).toFixed(2);
}

function getRecentHistory(pipelineId, limit = 10) {
    const history = executionHistory[pipelineId] || [];
    return history.slice(-limit);
}

function getPipelinePattern(projectId) {
    // Analyze patterns to identify recurring issues
    const patterns = {};
    
    Object.entries(executionHistory).forEach(([pipelineId, history]) => {
        history.forEach(execution => {
            if (execution.projectId === projectId && execution.errorType) {
                patterns[execution.errorType] = (patterns[execution.errorType] || 0) + 1;
            }
        });
    });

    return patterns;
}

module.exports = {
    trackExecution,
    getProjectMetrics,
    getSuccessRate,
    getRecentHistory,
    getPipelinePattern
};
