const axios = require("axios");

async function sendSlack(data) {
    await axios.post(process.env.SLACK_WEBHOOK, {
        text: `
🚨 CI Failure Auto-Handled

Project: ${data.project}
Cause: ${data.type}
Reason: ${data.reason}
Action: ${data.action}
Result: ${data.result}
Confidence: ${data.confidence}
        `
    });
}

module.exports = { sendSlack };