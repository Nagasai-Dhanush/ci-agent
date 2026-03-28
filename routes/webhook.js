const express = require("express");
const router = express.Router();

const { getFailedJob, getJobLogs } = require("../services/gitlab");
const {
    extractError,
    extractKeyword,
    extractStackTrace,
    parseLogMetadata
} = require("../utils/parser");
const { enrichError, analyzeEnrichment } = require("../services/brightdata");
const { classifyError } = require("../services/ai");
const { getExplanation } = require("../services/playbook");
const { executeAction } = require("../services/executor");
const { sendSlack, sendManualReviewNotification } = require("../services/slack");
const { trackExecution, getProjectMetrics, getSuccessRate } = require("../services/monitor");
const {
    shouldExecuteAction,
    validateAction,
    SAFETY_LIMITS
} = require("../config/playbook-guard");
const log = require("../utils/logger");

const { getRetryCount, incrementRetry } = require("../store");

router.post("/gitlab", async (req, res) => {
    const requestId = Math.random().toString(36).slice(2, 10);
    console.log("=== WEBHOOK HIT ===", requestId);

    try {
        const event = req.body;

        // 🔍 DEBUG incoming payload
        console.log("EVENT:", JSON.stringify(event, null, 2));

        // ✅ STEP 1: Validate event
        if (!event || typeof event !== "object") {
            console.warn("⚠️ Invalid event");
            return res.status(400).json({ error: "Invalid event" });
        }

        if (event.object_kind !== "pipeline") {
            console.log("Ignoring non-pipeline event");
            return res.sendStatus(200);
        }

        if (!event.object_attributes?.status) {
            console.warn("Missing status");
            return res.sendStatus(200);
        }

        if (event.object_attributes.status !== "failed") {
            console.log("Ignoring non-failed pipeline");
            return res.sendStatus(200);
        }

        if (!event.project?.id) {
            console.warn("Missing project info");
            return res.sendStatus(200);
        }

        const projectId = event.project.id;
        const pipelineId = event.object_attributes.id;
        const projectName = event.project.name || "Unknown";

        console.log("❌ Pipeline failed:", projectName);

        // ✅ STEP 2: Retry guard
        const retryCount = getRetryCount(pipelineId);
        if (retryCount >= SAFETY_LIMITS.max_retries_per_pipeline) {
            console.warn("Max retries reached");
            return res.sendStatus(200);
        }

        // ✅ STEP 3: Get failed job
        const failedJob = getFailedJob(event);

        // 🔥 GUARD 1
        if (!failedJob || !failedJob.id) {
            console.warn("⚠️ No valid failed job found");
            return res.sendStatus(200);
        }

        console.log("Failed Job:", failedJob.id);

        // ✅ STEP 4: Fetch logs
        const logs = await getJobLogs(projectId, failedJob.id);

        // 🔥 GUARD 2
        if (!logs || logs.length === 0) {
            console.warn("⚠️ No logs found");
            return res.sendStatus(200);
        }

        console.log("Logs fetched");

        // ✅ STEP 5: Parse logs
        const errorSection = extractError(logs);
        const keyword = extractKeyword(logs);
        const stackTrace = extractStackTrace(logs);
        const metadata = {}

        // ✅ STEP 6: Enrichment (safe)
        let enrichmentData = { source: "none", signals: [] };
        try {
            enrichmentData = await enrichError(keyword);
        } catch (e) {
            console.warn("Enrichment failed");
        }

        // ✅ STEP 7: AI classification
        const combinedInput = `
ERROR:
${errorSection}

STACK:
${stackTrace || "N/A"}

EXTERNAL:
${JSON.stringify(enrichmentData).slice(0, 300)}
`;

        const analysis = await classifyError(combinedInput, enrichmentData);

        // 🔥 GUARD 3
        if (!analysis || !analysis.type) {
            console.warn("⚠️ Invalid AI response");
            return res.sendStatus(200);
        }

        console.log("AI Result:", analysis.type);

        // ✅ STEP 8: Confidence check
        if (analysis.confidence < SAFETY_LIMITS.min_confidence_for_action) {
            await sendManualReviewNotification({
                project: projectName,
                errorType: analysis.type,
                confidence: analysis.confidence
            });
            return res.sendStatus(200);
        }

        // ✅ STEP 9: Validate action
        const selectedAction = analysis.suggested_action;
        const validation = validateAction(selectedAction, analysis.type);

        if (!validation.valid) {
            console.warn("Invalid action");
            return res.sendStatus(200);
        }

        // ✅ STEP 10: Execute action
        const executionResult = await executeAction({
            action: selectedAction,
            projectId,
            pipelineId
        });

        incrementRetry(pipelineId);

        trackExecution(pipelineId, projectId, {
            status: executionResult.success ? "resolved" : "failed",
            action: selectedAction
        });

        // ✅ STEP 11: Slack
        const explanation = getExplanation(
            analysis.type,
            selectedAction,
            analysis.confidence
        );

        await sendSlack({
            project: projectName,
            errorType: analysis.type,
            action: selectedAction,
            result: executionResult,
            explanation: explanation.explanation
        });

        console.log("✅ Completed");

        return res.sendStatus(200);

    } catch (err) {
        console.error("🔥 FULL ERROR OBJECT:");
        console.error(err);

        console.error("🔥 MESSAGE:", err.message);
        console.error("🔥 STACK:", err.stack);

        return res.status(500).json({
            error: err.message,
            requestId
        });
    }
});

// Health check
router.get("/health", (req, res) => {
    res.json({ status: "healthy" });
});

module.exports = router;