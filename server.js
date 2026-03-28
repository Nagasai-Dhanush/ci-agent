require("dotenv").config();

const express = require("express");
const log = require("./utils/logger");
const webhook = require("./routes/webhook");

const app = express();

app.use(express.json());

// Logging
app.use((req, res, next) => {
    log.debug(`${req.method} ${req.path}`);
    next();
});

// Health
app.get("/", (req, res) => {
    res.json({ status: "running" });
});

// 🔥 Mount
app.use("/webhook", webhook);

// Error handler
app.use((err, req, res, next) => {
    log.error(err.message);
    res.status(500).json({ error: "Internal server error" });
});

app.listen(3000, () => {
    log.info("Server running on port 3000");
});