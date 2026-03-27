const express = require("express");
const router = express.Router();

const { getFailedJob, getJobLogs } = require("../services/gitlab");
const { extractError, extractKeyword } = require("../utils/parser");
const { enrichError } = require("../services/brightdata");
const { classifyError } = require("../services/ai");
const { getAction } = require("../services/playbook");
const { executeAction } = require("../services/executor");
const { sendSlack } = require("../services/slack");

const { getRetryCount, incrementRetry } = require("../store");

router.post("/gitlab", async (req, res) => {
    console.log("📩 Webhook received");

    try {
        const event = req.body;

        // ✅ Step 1: Validate event
        if (
            event.object_kind !== "pipeline" ||
            event.object_attributes.status !== "failed"
        ) {
            console.log("Ignoring non-failure event");
            return res.sendStatus(200);
        }

        const projectId = event.project.id;
        const pipelineId = event.object_attributes.id;
        const projectName = event.project.name;

        console.log(`❌ Pipeline failed: ${pipelineId}`);

        // ✅ Step 2: Retry guard
        const retryCount = getRetryCount(pipelineId);
        if (retryCount >= 2) {
            console.log("⚠️ Max retries reached");
            return res.sendStatus(200);
        }

        // ✅ Step 3: Get failed job
        const failedJob = getFailedJob(event);
        if (!failedJob) {
            console.log("No failed job found");
            return res.sendStatus(200);
        }

        console.log("🔍 Failed job ID:", failedJob.id);

        // ✅ Step 4: Fetch logs
        const logs = await getJobLogs(projectId, failedJob.id);
        console.log("📄 Logs fetched");

        // ✅ Step 5: Parse logs
        const errorSnippet = extractError(logs);
        const keyword = extractKeyword(errorSnippet);

        console.log("🧠 Extracted keyword:", keyword);

        // ✅ Step 6: Bright Data enrichment (safe)
        let enrichment = "No external data";

        try {
            enrichment = await enrichError(keyword);
            console.log("🌐 Bright Data enrichment success");
        } catch (err) {
            console.log("⚠️ Bright Data failed, continuing without it");
        }

        // ✅ Step 7: Combine input
        const combinedInput = `
Logs:
${errorSnippet}

External Signals:
${JSON.stringify(enrichment).slice(0, 1000)}
`;

        // ✅ Step 8: AI classification (with fallback inside)
        const analysis = await classifyError(combinedInput);

        console.log("🧾 AI Analysis:", analysis);

        // ✅ Step 9: Confidence guard
        if (analysis.confidence < 0.7) {
            console.log("⚠️ Low confidence, skipping auto-fix");

            await sendSlack({
                project: projectName,
                type: analysis.type,
                reason: analysis.reason,
                confidence: analysis.confidence,
                action: "manual_required",
                result: "LOW CONFIDENCE"
            });

            return res.sendStatus(200);
        }

        // ✅ Step 10: Select playbook action
        const action = getAction(analysis.type);
        console.log("⚙️ Action selected:", action);

        // ✅ Step 11: Execute action
        const result = await executeAction({
            action,
            projectId,
            pipelineId
        });

        console.log("🚀 Execution result:", result);

        // ✅ Step 12: Increment retry count
        incrementRetry(pipelineId);

        // ✅ Step 13: Send Slack notification
        await sendSlack({
            project: projectName,
            type: analysis.type,
            reason: analysis.reason,
            confidence: analysis.confidence,
            action,
            result
        });

        console.log("✅ Workflow completed");

        return res.sendStatus(200);

    } catch (err) {
        console.error("🔥 Webhook Error:", err);
        return res.sendStatus(500);
    }
});

module.exports = router;