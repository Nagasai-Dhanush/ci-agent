function getAction(type) {
    switch (type) {
        case "flaky_test":
            return "retry";

        case "dependency_issue":
            return "reinstall";

        case "env_issue":
            return "retry";

        default:
            return "notify";
    }
}

module.exports = { getAction };