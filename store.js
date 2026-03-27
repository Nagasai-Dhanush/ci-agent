const retryMap = {};

function getRetryCount(pipelineId) {
    return retryMap[pipelineId] || 0;
}

function incrementRetry(pipelineId) {
    retryMap[pipelineId] = (retryMap[pipelineId] || 0) + 1;
}

module.exports = { getRetryCount, incrementRetry };