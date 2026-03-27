# 📋 Sample CI Failures for Testing

**Ready-to-use failing pipeline configurations to test each error classification**

> Copy/paste these into your `.gitlab-ci.yml` to trigger specific error types and watch CI Agent classify and remediate them.

---

## Quick Copy-Paste Reference

```
1. Flaky Test       → Copy FLAKY_TEST scenario below
2. Dependency Issue → Copy DEPENDENCY_ISSUE scenario below
3. Environment Issue → Copy ENV_ISSUE scenario below
4. Timeout         → Copy TIMEOUT scenario below
5. Rate Limit      → Copy RATE_LIMIT scenario below
6. Permission Error → Copy PERMISSION_ERROR scenario below
7. Code Error      → Copy CODE_ERROR scenario below
```

---

## Base `.gitlab-ci.yml` Template

Start with this, then add individual test jobs:

```yaml
stages:
  - test
  - build
  - deploy

variables:
  NODE_ENV: test
  DEBUG: "false"

# ============================================
# Base before_script for all jobs
# ============================================
before_script:
  - echo "Pipeline initialized at $(date)"
  - echo "Git commit: $CI_COMMIT_SHA"

# ============================================
# Base after_script for all jobs
# ============================================
after_script:
  - echo "Job completed at $(date)"
```

---

## Testing Scenarios

### 1️⃣ FLAKY TEST - Random Intermittent Failure

**What it tests**: Detection of tests that pass intermittently

**Create**: `test/flaky.test.js`

```javascript
// test/flaky.test.js
describe('Flaky Test Suite', () => {
    test('intermittent failure - should sometimes timeout', async () => {
        // Simulate random failure ~30% of the time
        const random = Math.random();
        if (random < 0.3) {
            // Simulate timeout
            throw new Error('ETIMEDOUT: connection timed out');
        }
        expect(true).toBe(true);
    });

    test('network call that intermittently fails', async () => {
        // Simulate network flakiness
        const randomFail = Math.random() < 0.25;
        if (randomFail) {
            throw new Error('ECONNREFUSED: connection refused by server');
        }
        return Promise.resolve('OK');
    });

    test('database query that sometimes fails', async () => {
        // Simulate database flakiness
        const shouldFail = Math.random() < 0.2;
        if (shouldFail) {
            throw new Error('Connection pool exhausted - too many connections');
        }
        expect(1 + 1).toBe(2);
    });
});
```

**Add to `.gitlab-ci.yml`**:

```yaml
test_flaky:
  stage: test
  image: node:18
  script:
    - npm install 2>&1 || true
    - npm test -- test/flaky.test.js
  allow_failure: true
  tags:
    - docker
```

**Expected Classification**:
- ✅ Error Type: `flaky_test`
- ✅ Confidence: 0.80-0.92
- ✅ Action: `retry`
- ✅ Result: Passes on retry (intermittent success)

**Watch for in CI Agent logs**:
```
[INFO] Detected flaky_test pattern
[DEBUG] Error contains: timeout, connection refused, exhausted
[ANALYSIS] Test passes sometimes, fails sometimes = flaky
```

---

### 2️⃣ DEPENDENCY ISSUE - Missing or Conflicting Packages

**What it tests**: Detection of npm/pip dependency problems

**Option A: Missing Package**

```yaml
test_dependency_missing:
  stage: test
  image: node:18
  script:
    - npm install 2>&1
    - npm install non-existent-random-package-xyz 2>&1 || true
    - npm test
  allow_failure: true
```

**Option B: Version Conflict**

```yaml
test_dependency_conflict:
  stage: test
  image: node:18
  script:
    - npm install 2>&1
    - npm install incompatible-version@999.99.99 2>&1 || true
    - npm test
  allow_failure: true
```

**Option C: Corrupted node_modules**

```yaml
test_dependency_corrupted:
  stage: test
  image: node:18
  script:
    - npm install 2>&1
    - rm -rf node_modules/.bin  # Corrupt modules
    - npm test 2>&1 || true
  allow_failure: true
```

**Expected Error Message** (what triggers classification):

```
npm ERR! code E404
npm ERR! 404 Not Found - GET https://registry.npmjs.org/non-existent-package
npm ERR! 404
npm ERR! 404  'non-existent-package' is not in this registry.
npm ERR! 404 You should bug the author to publish it
```

Or:

```
npm ERR! code ERESOLVE
npm ERR! ERESOLVE unable to resolve dependency tree
npm ERR! While resolving: ci-agent@1.0.0
npm ERR! Found: express@5.0.0
npm ERR! Could not resolve dependency:
```

**Expected Classification**:
- ✅ Error Type: `dependency_issue`
- ✅ Confidence: 0.88-0.95
- ✅ Action: `reinstall`
- ✅ Next Step: Clear npm cache, re-install

**Watch for in CI Agent logs**:
```
[INFO] Detected dependency_issue pattern
[DEBUG] npm ERR! patterns found: E404, ERESOLVE
[ANALYSIS] Package manager error = dependency issue
```

---

### 3️⃣ ENVIRONMENT ISSUE - Missing or Invalid Environment Variables

**What it tests**: Detection of env variable problems

**Create** new job in `.gitlab-ci.yml`:

```yaml
test_environment_issue:
  stage: test
  image: node:18
  script:
    - echo "Checking required environment variables..."
    - |
      if [ -z "$REQUIRED_API_KEY" ]; then
        echo "ERROR: REQUIRED_API_KEY not set"
        exit 1
      fi
    - |
      if [ -z "$DATABASE_URL" ]; then
        echo "ERROR: DATABASE_URL not set"
        exit 1
      fi
    - echo "Environment check passed (this will fail)"
    - npm test
  allow_failure: true
```

**Expected Error Messages** (what triggers classification):

```
ERROR: REQUIRED_API_KEY not set
No such file or directory
ENOENT: Cannot find config file at $CONFIG_PATH
Unable to connect to database: empty DATABASE_URL
Connection string is empty or invalid
```

**Add to environment to test recovery**:

```yaml
test_environment_fix:
  stage: test
  image: node:18
  variables:
    REQUIRED_API_KEY: "test-key-12345"
    DATABASE_URL: "postgres://localhost/testdb"
    CONFIG_PATH: "/etc/config/app.conf"
  script:
    - npm test
  allow_failure: true
```

**Expected Classification**:
- ✅ Error Type: `env_issue`
- ✅ Confidence: 0.82-0.90
- ✅ Action: `update_env` or escalate
- ✅ Next Step: Set missing variables or manual review

**Watch for in CI Agent logs**:
```
[INFO] Detected env_issue pattern
[DEBUG] Missing environment variables: REQUIRED_API_KEY, DATABASE_URL
[ANALYSIS] Environment variable missing = env issue
```

---

### 4️⃣ TIMEOUT - Job Exceeds Time Limit

**What it tests**: Detection of timeout/performance issues

**Create job in `.gitlab-ci.yml`**:

```yaml
test_timeout:
  stage: test
  image: node:18
  timeout: 30s  # Set timeout to 30 seconds
  script:
    - echo "Starting long-running operation..."
    - echo "This will timeout because sleep > 30s"
    - sleep 60  # Will timeout after 30 seconds
    - echo "This won't execute"
  allow_failure: true
```

**Expected Error Message**:

```
Timeout has been reached! Killing the job.
Timeout job exceeded maximum duration of 30 seconds
Command exited with code 1

Job's log exceeded limit of 4194304 bytes.
Last few lines:
Starting long-running operation...
This will timeout because sleep > 30s
```

**Shorter timeout to test faster**:

```yaml
test_timeout_short:
  stage: test
  image: node:18
  timeout: 10s
  script:
    - npm install  # Will likely timeout
    - npm test
  allow_failure: true
```

**Expected Classification**:
- ✅ Error Type: `timeout`
- ✅ Confidence: 0.90-0.97
- ✅ Action: `retry` with exponential backoff
- ✅ Next Step: Increase timeout or optimize performance

**Watch for in CI Agent logs**:
```
[INFO] Detected timeout pattern
[DEBUG] Keywords found: "Timeout has been reached", "exceeded maximum"
[ANALYSIS] Operation exceeded time limit = timeout
```

---

### 5️⃣ RATE LIMIT - External Service Quota Exceeded

**What it tests**: Detection of rate limiting from external APIs

**Create job in `.gitlab-ci.yml`**:

```yaml
test_rate_limit:
  stage: test
  image: node:18
  script:
    - echo "Simulating rapid API calls..."
    - |
      for i in {1..100}; do
        echo "Request $i"
        curl -s https://api.github.com/user -H "Authorization: Bearer invalid-token" 2>&1 || true
        if [ $? -ne 0 ]; then
          echo "Rate limit exceeded"
          break
        fi
      done
  allow_failure: true
```

**Expected Error Messages** (what triggers classification):

```
HTTP 429 Too Many Requests
{
  "message": "API rate limit exceeded",
  "documentation_url": "https://docs.github.com/rest/overview/resources-in-the-rest-api#rate-limiting"
}

x-ratelimit-limit: 60
x-ratelimit-remaining: 0
x-ratelimit-reset: 1234567890

Error: Too many requests. Please retry after 60 seconds.
Quota exceeded for quota metric '...' and limit '...'
```

**Expected Classification**:
- ✅ Error Type: `rate_limit`
- ✅ Confidence: 0.85-0.95
- ✅ Action: `retry` with long backoff
- ✅ Next Step: Wait and retry after cooldown

**Watch for in CI Agent logs**:
```
[INFO] Detected rate_limit pattern
[DEBUG] Keywords: "429", "rate limit exceeded", "quota exceeded"
[ANALYSIS] External service rate limiting detected
```

---

### 6️⃣ PERMISSION ERROR - Authentication or Authorization Failed

**What it tests**: Detection of auth/credential issues

**Create job in `.gitlab-ci.yml`**:

```yaml
test_permission_error:
  stage: test
  image: node:18
  script:
    - echo "Attempting to access protected resource..."
    - curl -s https://api.github.com/user \
        -H "Authorization: Bearer invalid-token-xyz" 2>&1 || true
    - echo "Attempting SSH with wrong key..."
    - ssh -o StrictHostKeyChecking=no invalid-user@github.com 2>&1 || true
  allow_failure: true
```

**Expected Error Messages**:

```
HTTP 401 Unauthorized
{"message":"Bad credentials","documentation_url":"https://docs.github.com/rest"}

Permission denied (publickey).
Could not read from remote repository.

Error: EACCES: permission denied, open '/etc/passwd'
fatal error: Permission denied while accessing repo

WARNING: UNPROTECTED PRIVATE KEY FILE!
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
Error: You do not have permission to pull this repository
```

**Expected Classification**:
- ✅ Error Type: `permission_error`
- ✅ Confidence: 0.88-0.95
- ✅ Action: Manual review (not auto-fixable)
- ✅ Next Step: Alert team to review credentials

**Watch for in CI Agent logs**:
```
[INFO] Detected permission_error pattern
[DEBUG] Keywords: "401", "Unauthorized", "Permission denied"
[ANALYSIS] Authentication/authorization failure = manual review needed
```

---

### 7️⃣ CODE ERROR - Application Logic Error

**What it tests**: Detection of actual code bugs

**Create failing test**: `test/code-error.test.js`

```javascript
// test/code-error.test.js
describe('Code Error Suite', () => {
    test('undefined variable access', () => {
        const obj = { a: 1 };
        // This will throw: Cannot read property 'b' of undefined
        const result = obj.missing.property;
        expect(result).toBeDefined();
    });

    test('null pointer dereference', () => {
        let data = null;
        // This will throw: Cannot read property 'length' of null
        const length = data.length;
        expect(length).toBeGreaterThan(0);
    });

    test('type error', () => {
        const num = "123";
        // This will throw: num.toFixed is not a function
        const fixed = num.toFixed(2);
        expect(fixed).toBe("123.00");
    });

    test('syntax/logic error', () => {
        const arr = [1, 2, 3];
        // Logic error: comparing array to number
        if (arr == 3) {  // Always false, likely a bug
            expect(true).toBe(true);
        }
    });
});
```

**Add to `.gitlab-ci.yml`**:

```yaml
test_code_error:
  stage: test
  image: node:18
  script:
    - npm install 2>&1 || true
    - npm test -- test/code-error.test.js
  allow_failure: true
```

**Expected Error Messages**:

```
TypeError: Cannot read property 'property' of undefined
    at Object.<anonymous> (test.js:5:13)

ReferenceError: x is not defined
    at test.js:10:5

TypeError: num.toFixed is not a function
    at test.js:15:10

SyntaxError: Unexpected identifier
    at module.js:327:6
```

**Expected Classification**:
- ✅ Error Type: `code_error`
- ✅ Confidence: 0.80-0.90
- ✅ Action: Manual review (code fix required)
- ✅ Next Step: Alert developer to fix code

**Watch for in CI Agent logs**:
```
[INFO] Detected code_error pattern
[DEBUG] Stack trace contains: "TypeError", "ReferenceError", "at (.*).js"
[ANALYSIS] Application error in code = requires developer fix
```

---

## 🧪 Testing All 7 Types in Sequence

**One-liner to test all error types**:

```yaml
stages:
  - flaky
  - dependency
  - environment
  - timeout
  - rate_limit
  - permission
  - code

flaky_test:
  stage: flaky
  script: npm test -- test/flaky.test.js
  allow_failure: true

dependency_test:
  stage: dependency
  script: npm install non-existent-package 2>&1 || true
  allow_failure: true

environment_test:
  stage: environment
  script: sh -c 'if [ -z $MISSING_VAR ]; then exit 1; fi'
  allow_failure: true

timeout_test:
  stage: timeout
  timeout: 5s
  script: sleep 10
  allow_failure: true

rate_limit_test:
  stage: rate_limit
  script: echo "Too many requests. Please retry after 60 seconds"
  allow_failure: true

permission_test:
  stage: permission
  script: ssh -o StrictHostKeyChecking=no fake@host 2>&1 || true
  allow_failure: true

code_error_test:
  stage: code
  script: npm test -- test/code-error.test.js
  allow_failure: true
```

**Expected Result**:
- ✅ 7 different errors triggered
- ✅ 7 different classifications
- ✅ 7 Slack notifications
- ✅ Different actions taken for each
- ✅ Success rate metrics updated

---

## 📊 Results Dashboard

After testing all 7 types, you should see in CI Agent metrics:

```json
{
  "total_failures": 7,
  "successful_classifications": 7,
  "accuracy_rate": "100%",
  "error_distribution": {
    "flaky_test": 1,
    "dependency_issue": 1,
    "env_issue": 1,
    "timeout": 1,
    "rate_limit": 1,
    "permission_error": 1,
    "code_error": 1
  },
  "auto_fixes_applied": 4,  // flaky, dependency, env, timeout can be auto-fixed
  "manual_reviews": 3,       // permission, code, rate_limit need manual review
  "fix_success_rate": "75%"
}
```

---

## 🎯 Pick Your Demo Scenario

**For Quick Demo (5 min)**:
1. Trigger: Flaky test
2. Watch: Auto-retry succeeds
3. Show: Slack notification

**For Impressive Demo (15 min)**:
1. Trigger: Flaky test → Success
2. Trigger: Dependency issue → Auto-fix
3. Trigger: Code error → Manual review alert
4. Show: All 3 Slack notifications
5. Explain: Safety guardrails in action

**For Complete Demo (30 min)**:
1. Trigger all 7 error types
2. For each one show:
   - Webhook received
   - Classification + confidence
   - Action selected
   - Execution result
   - Slack notification
3. Show final metrics dashboard
4. Explain why each action is safe

---

## 🔧 Copy-Paste Quick Guide

```bash
# Test flaky errors
echo "
test_flaky:
  stage: test
  script: npm test -- test/flaky.test.js
  allow_failure: true
" >> .gitlab-ci.yml

# Test dependency errors
echo "
test_deps:
  stage: test
  script: npm install non-existent 2>&1 || true
  allow_failure: true
" >> .gitlab-ci.yml

# Push and watch!
git add .gitlab-ci.yml
git commit -m "Add test scenarios"
git push origin main
```

---

## ✅ Verification Checklist

- [ ] All 7 test scenarios created
- [ ] Each scenario added to `.gitlab-ci.yml`
- [ ] Changes committed and pushed
- [ ] Pipelines triggered on GitLab
- [ ] CI Agent webhook receiving events
- [ ] Classifications logged in CI Agent terminal
- [ ] Slack notifications received for failures
- [ ] Metrics updated with 7 different error types
- [ ] Success rate calculated

---

**Ready to demonstrate CI/CD automation mastery! 🏆**
