const axios = require("axios");

async function enrichError(keyword) {
    const res = await axios.post(
        "https://api.brightdata.com/datasets/v1/query",
        { query: keyword },
        {
            headers: {
                Authorization: `Bearer ${process.env.BRIGHTDATA_API_KEY}`
            },
            timeout: 2000
        }
    );

    return res.data;
}

module.exports = { enrichError };