const axios = require("axios");
const log = require("../utils/logger");

// ==============================
// MAIN SLACK NOTIFICATION
// ==============================
async function sendSlack(data) {
    try {
        log.debug("Preparing Slack notification", {
            project: data?.project,
            type: data?.errorType,
            action: data?.action
        });

        // ==============================
        // SAFE DATA EXTRACTION
        // ==============================
        const project = data?.project || "Unknown Project";
        const errorType = data?.errorType || "unknown";
        const reason = data?.reason || "No reason provided";
        const confidence = data?.confidence ?? 0;
        const action = data?.action || "notify";
        const result = data?.result || {};
        const reasoning = data?.reasoning || [];
        const severity = data?.severity || "medium";
        const timestamp = data?.timestamp || Date.now();
        const newPipelineId = data?.newPipelineId;
        const metrics = data?.metrics;

        // ==============================
        // COLOR MAPPING
        // ==============================
        const colorMap = {
            low: "#36a64f",
            medium: "#FFA500",
            high: "#ff0000"
        };

        const color = colorMap[severity] || "#808080";

        // ==============================
        // SAFE RESULT STRING
        // ==============================
        const resultText =
            typeof result === "object"
                ? (result.message || JSON.stringify(result))
                : String(result || "Pending");

        // ==============================
        // SLACK MESSAGE STRUCTURE
        // ==============================
        const message = {
            attachments: [
                {
                    color,
                    title: `🚨 CI Failure Auto-Handled: ${project}`,
                    title_link: newPipelineId
                        ? `https://gitlab.com/-/pipelines/${newPipelineId}`
                        : undefined,
                    fields: [
                        {
                            title: "Error Classification",
                            value: String(errorType).toUpperCase(),
                            short: true
                        },
                        {
                            title: "Confidence",
                            value: `${(confidence * 100).toFixed(0)}%`,
                            short: true
                        },
                        {
                            title: "Severity",
                            value: String(severity).toUpperCase(),
                            short: true
                        },
                        {
                            title: "Auto Action Taken",
                            value: String(action).toUpperCase(),
                            short: true
                        },
                        {
                            title: "Root Cause Analysis",
                            value: reason,
                            short: false
                        },

                        // Reasoning steps (optional)
                        ...(reasoning.length > 0
                            ? [
                                  {
                                      title: "Reasoning Steps",
                                      value: reasoning
                                          .map((r, i) => `${i + 1}. ${r}`)
                                          .join("\n"),
                                      short: false
                                  }
                              ]
                            : []),

                        {
                            title: "Action Result",
                            value: resultText,
                            short: false
                        },

                        ...(newPipelineId
                            ? [
                                  {
                                      title: "New Pipeline ID",
                                      value: String(newPipelineId),
                                      short: true
                                  }
                              ]
                            : []),

                        ...(metrics
                            ? [
                                  {
                                      title: "Project Success Rate",
                                      value: `${metrics.successRate}%`,
                                      short: true
                                  }
                              ]
                            : [])
                    ],
                    footer: "CI Agent Analytics",
                    ts: Math.floor(new Date(timestamp).getTime() / 1000)
                }
            ]
        };

        // ==============================
        // ENV CHECK
        // ==============================
        const webhookUrl = process.env.SLACK_WEBHOOK;

        if (!webhookUrl) {
            log.warn("⚠️ SLACK_WEBHOOK not configured");
            return;
        }

        // ==============================
        // SEND REQUEST
        // ==============================
        await axios.post(webhookUrl, message, {
            timeout: 5000
        });

        log.info("✅ Slack notification sent", {
            project,
            errorType,
            action
        });
    } catch (err) {
        log.error("❌ Failed to send Slack notification", {
            error: err.message
        });
    }
}

// ==============================
// MANUAL REVIEW NOTIFICATION
// ==============================
async function sendManualReviewNotification(data) {
    try {
        log.debug("Sending manual review notification");

        const project = data?.project || "Unknown Project";
        const errorType = data?.errorType || "unknown";
        const reason = data?.reason || "No analysis";
        const confidence = data?.confidence ?? 0;
        const timestamp = data?.timestamp || Date.now();

        const message = {
            attachments: [
                {
                    color: "#FF9900",
                    title: `⚠️ Manual Review Required: ${project}`,
                    fields: [
                        {
                            title: "Reason",
                            value: `Low confidence (${(confidence * 100).toFixed(
                                0
                            )}%)`,
                            short: false
                        },
                        {
                            title: "Error Type",
                            value: String(errorType).toUpperCase(),
                            short: true
                        },
                        {
                            title: "Analysis",
                            value: reason,
                            short: false
                        }
                    ],
                    footer: "CI Agent - Manual Review Escalation",
                    ts: Math.floor(new Date(timestamp).getTime() / 1000)
                }
            ]
        };

        const webhookUrl = process.env.SLACK_WEBHOOK;

        if (!webhookUrl) {
            log.warn("⚠️ SLACK_WEBHOOK not configured");
            return;
        }

        await axios.post(webhookUrl, message, {
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