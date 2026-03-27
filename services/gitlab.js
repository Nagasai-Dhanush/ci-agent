const axios = require("axios");

const TOKEN = process.env.GITLAB_TOKEN;

function getFailedJob(event) {
    if (!event.builds) return null;
    return event.builds.find(b => b.status === "failed");
}

async function getJobLogs(projectId, jobId) {
    const res = await axios.get(
        `https://gitlab.com/api/v4/projects/${projectId}/jobs/${jobId}/trace`,
        {
            headers: {
                "PRIVATE-TOKEN": TOKEN
            }
        }
    );

    return res.data;
}

module.exports = { getFailedJob, getJobLogs };