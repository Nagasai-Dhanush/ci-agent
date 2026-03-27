const axios = require("axios");

const TOKEN = process.env.GITLAB_TOKEN;

async function executeAction({ action, projectId, pipelineId }) {
    try {
        if (action === "retry") {
            await axios.post(
                `https://gitlab.com/api/v4/projects/${projectId}/pipelines/${pipelineId}/retry`,
                {},
                {
                    headers: {
                        "PRIVATE-TOKEN": TOKEN
                    }
                }
            );

            return "RETRIED";
        }

        if (action === "reinstall") {
            // simplified fallback → retry pipeline
            await axios.post(
                `https://gitlab.com/api/v4/projects/${projectId}/pipelines/${pipelineId}/retry`,
                {},
                {
                    headers: {
                        "PRIVATE-TOKEN": TOKEN
                    }
                }
            );

            return "REINSTALL + RETRY";
        }

        return "NO ACTION";
    } catch (err) {
        console.error(err);
        return "FAILED";
    }
}

module.exports = { executeAction };