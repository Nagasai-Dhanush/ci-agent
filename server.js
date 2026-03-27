require("dotenv").config();

const express = require("express");
const bodyParser = require("body-parser");
const log = require("./utils/logger");

const webhook = require("./routes/webhook");

const app = express();
app.use(bodyParser.json());

// Request logging middleware
app.use((req, res, next) => {
    log.debug(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get("user-agent")
    });
    next();
});

app.get("/", (req, res) => {
    res.json({
        name: "🚀 CI/CD Agent",
        status: "running",
        version: "1.0.0",
        features: [
            "LLM-powered error classification",
            "Autonomous remediation",
            "Safety guardrails",
            "Bright Data enrichment",
            "Slack notifications"
        ]
    });
});

app.use("/webhook", webhook);

// Error handler middleware
app.use((err, req, res, next) => {
    log.error("Unhandled error", {
        message: err.message,
        stack: err.stack
    });
    res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    log.info(`🚀 CI Agent running on port ${PORT}`, {
        environment: process.env.NODE_ENV || "development"
    });
});