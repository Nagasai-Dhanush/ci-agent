const axios = require("axios");

const TOKEN = process.env.GITLAB_TOKEN;
const log = require("../utils/logger");

function getFailedJob(event) {
    if (!event || !Array.isArray(event.builds)) {
        return null;
    }
    return event.builds.find(b => b.status === "failed");
}

async function getJobLogs(projectId, jobId) {
    if (!TOKEN) {
        const error = "GITLAB_TOKEN not configured";
        log.error(error);
        throw new Error(error);
    }

    try {
        const res = await axios.get(
            `https://gitlab.com/api/v4/projects/${projectId}/jobs/${jobId}/trace`,
            {
                headers: {
                    "PRIVATE-TOKEN": TOKEN
                },
                timeout: 10000
            }
        );

        if (!res.data) {
            log.warn("Empty response from GitLab API", { projectId, jobId });
            return "";
        }

        return res.data;
    } catch (err) {
        log.error("Failed to fetch job logs from GitLab", {
            projectId,
            jobId,
            status: err.response?.status,
            message: err.message
        });
        throw err;
    }
}

module.exports = { getFailedJob, getJobLogs };