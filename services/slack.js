const axios = require("axios");
const log = require("../utils/logger");

// Rich Slack notification with explainable reasoning
async function sendSlack(data) {
    log.debug("Preparing Slack notification", {
        project: data.project,
        type: data.errorType,
        action: data.action
    });

    const {
        project,
        errorType,
        reason,
        confidence,
        action,
        result,
        reasoning,
        severity,
        timestamp,
        newPipelineId,
        metrics
    } = data;

    // Color code by severity
    const colorMap = {
        low: "#36a64f",
        medium: "#FFA500",
        high: "#ff0000"
    };

    const color = colorMap[severity] || "#808080";

    const message = {
        attachments: [
            {
                color,
                title: `CI Failure Auto-Handled: ${project}`,
                title_link: newPipelineId ? `https://gitlab.com/-/pipelines/${newPipelineId}` : undefined,
                fields: [
                    {
                        title: "Error Classification",
                        value: errorType.toUpperCase(),
                        short: true
                    },
                    {
                        title: "Confidence",
                        value: `${(confidence * 100).toFixed(0)}%`,
                        short: true
                    },
                    {
                        title: "Severity",
                        value: severity.toUpperCase(),
                        short: true
                    },
                    {
                        title: "Auto Action Taken",
                        value: action.toUpperCase(),
                        short: true
                    },
                    {
                        title: "Root Cause Analysis",
                        value: reason,
                        short: false
                    },
                    ...(reasoning?.length > 0 ? [{
                        title: "Reasoning Steps",
                        value: reasoning.map((r, i) => `${i + 1}. ${r}`).join("\n"),
                        short: false
                    }] : []),
                    {
                        title: "Action Result",
                        value: result?.message || result || "Pending",
                        short: false
                    },
                    ...(result?.newPipelineId ? [{
                        title: "New Pipeline ID",
                        value: result.newPipelineId,
                        short: true
                    }] : []),
                    ...(metrics ? [{
                        title: "Project Success Rate",
                        value: `${metrics.successRate}%`,
                        short: true
                    }] : [])
                ],
                footer: "CI Agent Analytics",
                ts: Math.floor(new Date(timestamp || Date.now()).getTime() / 1000)
            }
        ]
    };

    try {
        await axios.post(process.env.SLACK_WEBHOOK, message, {
            timeout: 5000
        });

        log.info("Slack notification sent", {
            project,
            errorType,
            action
        });
    } catch (err) {
        log.error("Failed to send Slack notification", {
            error: err.message,
            project
        });
        throw err;
    }
}

// Simpler notification for manual review
async function sendManualReviewNotification(data) {
    log.debug("Sending manual review notification");

    const {
        project,
        errorType,
        reason,
        confidence,
        timestamp
    } = data;

    const message = {
        attachments: [
            {
                color: "#FF9900",
                title: `⚠️ Manual Review Required: ${project}`,
                fields: [
                    {
                        title: "Reason",
                        value: `Low confidence (${(confidence * 100).toFixed(0)}%) in error classification`,
                        short: false
                    },
                    {
                        title: "Error Type",
                        value: errorType,
                        short: true
                    },
                    {
                        title: "Analysis",
                        value: reason,
                        short: false
                    }
                ],
                footer: "CI Agent - Manual Review Escalation",
                ts: Math.floor(new Date(timestamp || Date.now()).getTime() / 1000)
            }
        ]
    };

    try {
        await axios.post(process.env.SLACK_WEBHOOK, message, {
            timeout: 5000
        });
        log.info("Manual review notification sent", { project });
    } catch (err) {
        log.error("Failed to send manual review notification", {
            error: err.message
        });
    }
}

module.exports = {
    sendSlack,
    sendManualReviewNotification
};