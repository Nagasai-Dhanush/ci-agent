const express = require("express");
const router = express.Router();

const { getFailedJob, getJobLogs } = require("../services/gitlab");
const {
    extractError,
    extractKeyword,
    extractStackTrace,
    parseLogMetadata,
    extractLogSection
} = require("../utils/parser");
const { enrichError, analyzeEnrichment } = require("../services/brightdata");
const { classifyError } = require("../services/ai");
const { getAction, getExplanation } = require("../services/playbook");
const { executeAction } = require("../services/executor");
const { sendSlack, sendManualReviewNotification } = require("../services/slack");
const { trackExecution, getProjectMetrics, getSuccessRate } = require("../services/monitor");
const {
    shouldExecuteAction,
    validateAction,
    getExplanationTemplate,
    SAFETY_LIMITS
} = require("../config/playbook-guard");
const log = require("../utils/logger");

const { getRetryCount, incrementRetry } = require("../store");

router.post("/gitlab", async (req, res) => {
    const requestId = Math.random().toString(36).slice(2, 10);
    log.info("🎯 Webhook received", { requestId });

    try {
        const event = req.body;

        // ✅ STEP 1: Validate event
        if (
            event.object_kind !== "pipeline" ||
            event.object_attributes.status !== "failed"
        ) {
            log.debug("Ignoring non-failure event", { requestId });
            return res.sendStatus(200);
        }

        const projectId = event.project.id;
        const pipelineId = event.object_attributes.id;
        const projectName = event.project.name;

        log.info("❌ Pipeline failed", {
            requestId,
            pipelineId,
            projectName
        });

        // ✅ STEP 2: Check retry guard
        const retryCount = getRetryCount(pipelineId);
        if (retryCount >= SAFETY_LIMITS.max_retries_per_pipeline) {
            log.warn("⚠️ Max retries reached - escalating to manual", {
                requestId,
                pipelineId,
                retryCount,
                maxRetries: SAFETY_LIMITS.max_retries_per_pipeline
            });

            trackExecution(pipelineId, projectId, {
                requestId,
                status: "manual_review",
                reason: "Max retries exceeded"
            });

            return res.sendStatus(200);
        }

        // ✅ STEP 3: Get failed job details
        const failedJob = getFailedJob(event);
        if (!failedJob) {
            log.warn("No failed job found in event", { requestId, pipelineId });
            return res.sendStatus(200);
        }

        log.debug("🔍 Fetching job logs", {
            requestId,
            jobId: failedJob.id
        });

        // ✅ STEP 4: Fetch job logs
        const logs = await getJobLogs(projectId, failedJob.id);
        log.info("📄 Logs fetched", {
            requestId,
            logSize: logs.length
        });

        // ✅ STEP 5: Parse logs thoroughly
        const errorSection = extractError(logs);
        const keyword = extractKeyword(logs);
        const stackTrace = extractStackTrace(logs);
        const metadata = parseLogMetadata(logs);

        log.debug("📊 Log parsing complete", {
            requestId,
            errorLength: errorSection.length,
            hasStackTrace: !!stackTrace,
            metadata
        });

        // ✅ STEP 6: Bright Data enrichment
        let enrichmentData = { source: "none", signals: [] };

        try {
            log.debug("🌐 Fetching Bright Data enrichment", {
                requestId,
                keyword
            });

            enrichmentData = await enrichError(keyword);
            const insights = analyzeEnrichment(enrichmentData);

            log.info("✨ Bright Data enrichment complete", {
                requestId,
                insightCount: insights.length
            });
        } catch (err) {
            log.warn("⚠️ Bright Data enrichment failed, continuing", {
                requestId,
                error: err.message
            });
        }

        // ✅ STEP 7: AI classification with reasoning
        const combinedInput = `
ERROR LOGS:
${errorSection}

STACK TRACE:
${stackTrace || "Not available"}

EXTERNAL SIGNALS:
${JSON.stringify(enrichmentData).slice(0, 500)}
`;

        log.debug("🤖 Starting AI classification", { requestId });

        const analysis = await classifyError(combinedInput, enrichmentData);

        log.info("🧠 AI analysis complete", {
            requestId,
            errorType: analysis.type,
            confidence: analysis.confidence,
            severity: analysis.severity,
            source: analysis.source
        });

        // ✅ STEP 8: Confidence check - safety guard
        if (analysis.confidence < SAFETY_LIMITS.min_confidence_for_action) {
            log.warn("⚠️ Low confidence - requiring manual review", {
                requestId,
                confidence: analysis.confidence,
                threshold: SAFETY_LIMITS.min_confidence_for_action
            });

            trackExecution(pipelineId, projectId, {
                requestId,
                status: "manual_review",
                errorType: analysis.type,
                confidence: analysis.confidence
            });

            await sendManualReviewNotification({
                project: projectName,
                errorType: analysis.type,
                reason: analysis.root_cause,
                confidence: analysis.confidence,
                timestamp: new Date().toISOString()
            });

            return res.sendStatus(200);
        }

        // ✅ STEP 9: Validate action compatibility
        const selectedAction = analysis.suggested_action;
        const actionValidation = validateAction(selectedAction, analysis.type);

        if (!actionValidation.valid) {
            log.warn("❌ Action validation failed", {
                requestId,
                action: selectedAction,
                reason: actionValidation.reason
            });

            trackExecution(pipelineId, projectId, {
                requestId,
                status: "action_validation_failed",
                errorType: analysis.type
            });

            return res.sendStatus(200);
        }

        // ✅ STEP 10: Execution eligibility check
        const canExecute = shouldExecuteAction(
            analysis.confidence,
            analysis.type,
            retryCount
        );

        if (!canExecute.allowed) {
            log.warn("⚠️ Cannot execute action", {
                requestId,
                reason: canExecute.reason,
                confidence: analysis.confidence,
                retryCount
            });

            trackExecution(pipelineId, projectId, {
                requestId,
                status: "execution_blocked",
                errorType: analysis.type,
                reason: canExecute.reason
            });

            return res.sendStatus(200);
        }

        // ✅ STEP 11: Execute remediation action
        log.info("⚙️ Executing remediation action", {
            requestId,
            action: selectedAction,
            pipelineId
        });

        const executionResult = await executeAction({
            action: selectedAction,
            projectId,
            pipelineId,
            dryRun: false
        });

        log.info("🚀 Action executed", {
            requestId,
            action: selectedAction,
            success: executionResult.success,
            message: executionResult.message
        });

        // ✅ STEP 12: Track execution
        incrementRetry(pipelineId);

        trackExecution(pipelineId, projectId, {
            requestId,
            status: executionResult.success ? "resolved" : "failed",
            errorType: analysis.type,
            action: selectedAction,
            confidence: analysis.confidence
        });

        // ✅ STEP 13: Get project metrics for notification
        const projectMetrics = getProjectMetrics(projectId);
        const successRate = getSuccessRate(projectId);

        // ✅ STEP 14: Send comprehensive Slack notification
        const explanation = getExplanation(analysis.type, selectedAction, analysis.confidence);

        await sendSlack({
            project: projectName,
            errorType: analysis.type,
            reason: analysis.root_cause,
            reasoning: analysis.reasoning || [],
            confidence: analysis.confidence,
            severity: analysis.severity,
            action: selectedAction,
            result: executionResult,
            newPipelineId: executionResult.newPipelineId,
            timestamp: new Date().toISOString(),
            metrics: projectMetrics ? { successRate } : null,
            explanation: explanation.explanation
        });

        log.info("✅ Workflow completed successfully", {
            requestId,
            pipelineId,
            action: selectedAction,
            success: executionResult.success
        });

        return res.sendStatus(200);

    } catch (err) {
        log.error("🔥 Webhook processing error", {
            requestId,
            error: err.message,
            stack: err.stack
        });

        return res.status(500).json({
            error: "Internal server error",
            requestId
        });
    }
});

// Health check endpoint
router.get("/health", (req, res) => {
    res.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

module.exports = router;