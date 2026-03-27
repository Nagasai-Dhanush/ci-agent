# 🚀 Real-World GitLab Integration Testing Guide

**CI Agent - Live GitLab Testing Strategy**

> This guide walks you through testing CI Agent on real GitLab repositories with actual CI/CD pipelines, enabling you to demonstrate autonomous error detection and remediation to hackathon judges.

---

## 📋 Testing Strategy Overview

```
PHASE 1: Setup (15 minutes)
├─ Configure ngrok for public access
├─ Create test GitLab repository
└─ Setup GitLab webhook to your ngrok URL

PHASE 2: Test Error Detection (20 minutes)
├─ Create failing pipelines of each error type
├─ Trigger webhooks and verify classification
└─ Monitor LLM analysis in real-time

PHASE 3: Test Autonomous Remediation (25 minutes)
├─ Execute safe actions (retry, reinstall)
├─ Verify pipeline re-runs
└─ Capture success metrics

PHASE 4: Capture Evidence (10 minutes)
├─ Screenshot successful resolutions
├─ Save Slack notifications
└─ Document metrics & improvements

EXPECTED TIME: 70 minutes for complete demo
```

---

## 🎯 Phase 1: Setup & Configuration

### Step 1: Verify ngrok is Running

Your ngrok tunnel is already active. Verify:

```bash
# Check ngrok output (should show http://xxxx.ngrok.io)
# This is your PUBLIC_URL for GitLab webhooks
```

**Expected Output:**
```
ngrok by @inconshreveable                    (Ctrl+C to quit)
Session Status                online
Account                       [Your Account]
Version                        3.x.x
Region                         us (United States)
Latency                        65ms
HTTP URL:  http://abc123def.ngrok.io
```

**Note the URL**: `http://abc123def.ngrok.io` - You'll need this for webhooks.

### Step 2: Configure CI Agent for Testing

Update your `.env` file:

```env
# Server
PORT=3000
NODE_ENV=development
CI_AGENT_DEBUG=true

# GitLab
GITLAB_TOKEN=glpat_YOUR_PERSONAL_ACCESS_TOKEN
GITLAB_API_BASE=https://gitlab.com/api/v4
GITLAB_WEBHOOK_SECRET=your_webhook_secret_string

# Slack
SLACK_WEBHOOK=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# Featherless AI
FEATHERLESS_API_KEY=ftr_YOUR_API_KEY

# Bright Data (optional)
BRIGHTDATA_API_KEY=optional_if_available

# Testing
TEST_MODE=true
VERBOSE_LOGGING=true
```

### Step 3: Start CI Agent Server

```bash
# Terminal 1: Start the CI Agent
npm start

# Expected output:
# CI Agent listening on port 3000
# Status: Ready for webhooks
# Webhook endpoint: POST http://localhost:3000/webhook/gitlab
```

---

## 🎯 Phase 2: Create Test GitLab Repository

### Step 1: Create New GitLab Repository

1. Go to https://gitlab.com/projects/new
2. Create repository named: `ci-agent-test-repo`
3. Initialize with README
4. Clone to your machine:

```bash
git clone https://gitlab.com/YOUR_USERNAME/ci-agent-test-repo.git
cd ci-agent-test-repo
```

### Step 2: Create `.gitlab-ci.yml` with Basic Pipeline

```yaml
# .gitlab-ci.yml
stages:
  - test
  - build
  - deploy

test_job:
  stage: test
  image: node:18
  script:
    - echo "Running tests..."
    - npm install
    - npm test
  artifacts:
    reports:
      junit: junit.xml

build_job:
  stage: build
  image: node:18
  script:
    - echo "Building application..."
    - npm run build
  only:
    - merge_requests
    - main

deploy_job:
  stage: deploy
  image: node:18
  script:
    - echo "Deploying to production..."
  only:
    - main
```

### Step 3: Commit & Push

```bash
git add .gitlab-ci.yml
git commit -m "Add initial CI/CD pipeline"
git push origin main

# GitLab will automatically trigger the pipeline
```

---

## 🎯 Phase 3: Configure GitLab Webhook

### Step 1: Get Your ngrok URL

From your ngrok terminal, note the URL (e.g., `http://abc123def.ngrok.io`)

### Step 2: Add Webhook to GitLab Repository

1. Go to your repository on GitLab
2. **Settings** → **Webhooks**
3. Add new webhook with:

```
URL: http://abc123def.ngrok.io/webhook/gitlab
Trigger events: Pipeline events, Job events, Push events
Token (optional): your_webhook_secret_string
```

4. Click **Add webhook**
5. Test the webhook (GitLab provides test button)

**Expected Response**: Status 200 from your CI Agent

---

## 🧪 Phase 4: Test Each Error Type

### Type 1: Flaky Test Error

**Create file**: `tests/flaky.test.js`

```javascript
describe('Flaky Test Example', () => {
    test('intermittent timeout failure', async () => {
        // Randomly fails ~50% of time to simulate flakiness
        const random = Math.random();
        if (random < 0.5) {
            throw new Error('Timeout waiting for response');
        }
        expect(true).toBe(true);
    });
});
```

**Trigger**:
```bash
git add tests/flaky.test.js
git commit -m "Add flaky test"
git push origin main

# Push multiple times to trigger multiple runs
# Some will fail → CI Agent will classify as "flaky_test"
# Action: Retry automatically
```

**Watch for**:
- ✅ Webhook received by CI Agent
- ✅ LLM classifies as "flaky_test"
- ✅ Confidence score assigned (0.7-0.95)
- ✅ Action selected: "retry"
- ✅ Slack notification sent AFTER retry succeeds

---

### Type 2: Dependency Issue

**Create file**: `.gitlab-ci.yml` (modified for dependency failure)

```yaml
test_job:
  stage: test
  image: node:18
  script:
    - echo "Installing dependencies..."
    - npm install non-existent-package-xyz
    - npm test
```

**Trigger**:
```bash
git add .gitlab-ci.yml
git commit -m "Add missing dependency to trigger error"
git push origin main
```

**Watch for**:
- ✅ Webhook received
- ✅ LLM classifies as "dependency_issue"
- ✅ Confidence score (0.85-0.95)
- ✅ Action selected: "reinstall"
- ✅ Cache cleared & retried
- ✅ Success rate tracked

---

### Type 3: Environment Variable Issue

**Create file**: `.gitlab-ci.yml` (modified for env issue)

```yaml
test_job:
  stage: test
  image: node:18
  script:
    - echo "Checking required environment..."
    - if [ -z "$REQUIRED_API_KEY" ]; then exit 1; fi
    - npm test
```

**Trigger**:
```bash
git add .gitlab-ci.yml
git commit -m "Add env variable check"
git push origin main
```

**Watch for**:
- ✅ Classification: "env_issue"
- ✅ Action: "update_env" or escalation
- ✅ Confidence score calculated

---

### Type 4: Network Timeout

**Create file**: `.gitlab-ci.yml` (modified for timeout)

```yaml
test_job:
  stage: test
  image: node:18
  timeout: 30s
  script:
    - echo "Simulating long-running operation..."
    - sleep 60  # Will timeout after 30s
    - npm test
```

**Trigger**:
```bash
git add .gitlab-ci.yml
git commit -m "Add timeout test"
git push origin main
```

**Watch for**:
- ✅ Classification: "timeout"
- ✅ Action: "retry" with exponential backoff
- ✅ Multiple retry attempts

---

## 📊 Real-Time Monitoring

### Monitor CI Agent Logs

**Terminal 1** (CI Agent):
```bash
# Watch for real-time logs
# Should show:
# [INFO] Webhook received from GitLab
# [INFO] Pipeline ID: xxx, Status: failed
# [INFO] Extracting error logs...
# [INFO] Analyzing with LLM...
# [INFO] Classification: [error_type]
# [INFO] Confidence: 0.xx
# [INFO] Executing action: [action]
# [INFO] Re-running pipeline...
# [INFO] Slack notification sent
```

### Monitor GitLab Pipeline

Watch the pipeline status in real-time:
1. Go to **CI/CD → Pipelines** in your test repo
2. Click on pipeline
3. Watch job status change
4. See re-runs triggered by CI Agent

### Monitor Slack Notifications

Watch your Slack channel for:
```
[CI Agent] Pipeline Error Detected
Project: ci-agent-test-repo
Pipeline: xxx
Error Type: flaky_test
Classification Confidence: 87%

Reasoning:
- Detected timeout pattern
- Error is intermittent (flaky)
- Recommending retry strategy

Action Taken: Automatically retried pipeline
Result: ✅ SUCCESS after 2 attempts

Success Rate: 85% (improved)
```

---

## 📈 Capture Metrics & Evidence

### Create Monitoring Dashboard (Optional)

```bash
# Check your CI Agent's built-in metrics
curl http://localhost:3000/metrics/project/ci-agent-test-repo

# Expected response:
{
  "projectId": "ci-agent-test-repo",
  "totalFailures": 15,
  "successRate": "86.67%",
  "errorDistribution": {
    "flaky_test": 5,
    "dependency_issue": 3,
    "env_issue": 2,
    "timeout": 2,
    "rate_limit": 1,
    "permission_error": 1,
    "code_error": 1
  },
  "autoFixesApplied": 12,
  "autoFixesSuccessful": 10,
  "lastUpdated": "2026-03-28T10:30:45Z"
}
```

### Save Screenshots

Capture these for your presentation:
1. ✅ GitLab webhook receiving requests
2. ✅ CI Agent terminal showing real-time processing
3. ✅ Slack notification with full reasoning
4. ✅ Pipeline re-running and succeeding
5. ✅ Metrics showing success rate improvement

---

## 🎬 Demo Scenario: Complete Walk-Through

### Scenario: 5-Minute Live Demo

**Setup (Before judges arrive)**:
```bash
# Terminal 1: CI Agent running
npm start

# Terminal 2: Monitor logs
tail -f logs/combined.log

# Terminal 3: Ready to push to GitLab
cd ../ci-agent-test-repo
```

**During Demo (Record this)**:

```
1. [0:00] "This is our test repository"
   → Show GitLab repo
   
2. [0:30] "Modify the pipeline to introduce a flaky test"
   → Edit .gitlab-ci.yml to add random failure
   
3. [1:00] "Push the change"
   → git push origin main
   → Show commit hash
   
4. [1:30] "GitLab pipeline starts failing"
   → Show pipeline on GitLab turning red
   
5. [2:00] "CI Agent detects and analyzes the failure"
   → Show CI Agent terminal receiving webhook
   → Show LLM analysis: "This is a flaky test"
   → Show confidence: 0.87
   
6. [3:00] "Autonomous action: Retry"
   → Show pipeline automatically re-running
   → Show second attempt succeeding
   
7. [4:00] "Slack notification sent to team"
   → Show Slack message with:
     - Classification & reasoning
     - Action taken
     - Success result
   
8. [5:00] "Metrics updated"
   → Show success rate improved
   → Show pattern tracking
```

---

## 🔍 Advanced Testing Scenarios

### Scenario A: Concurrent Failures

```bash
# Push multiple changes simultaneously to trigger multiple pipeline failures
for i in {1..5}; do
  echo "Test run $i" >> test.txt
  git add test.txt
  git commit -m "Test push $i"
  git push origin main &
done
```

**Expected**:
- ✅ CI Agent handles multiple webhooks concurrently
- ✅ Each error classified independently
- ✅ Separate Slack notifications
- ✅ Metrics aggregated correctly

### Scenario B: Repeated Same Error

```bash
# Push 10 times with same error to test pattern detection
for i in {1..10}; do
  git commit --allow-empty -m "Trigger test $i"
  git push origin main
done
```

**Expected**:
- ✅ CI Agent detects pattern: "flaky_test appearing repeatedly"
- ✅ Adjusts strategy: Increases backoff time
- ✅ Metrics show: "90% of similar errors now fixed"

### Scenario C: Different Error Types in Sequence

```bash
# Change pipeline to trigger different errors on each push
# Push 1: Flaky test
# Push 2: Dependency issue  
# Push 3: Timeout
# ...and so on
```

**Expected**:
- ✅ Each error classified correctly
- ✅ Appropriate action taken for each type
- ✅ Success tracking shows which strategies work best

---

## 📋 Troubleshooting

### Issue: Webhook Not Received

```bash
# 1. Check ngrok is still running
# 2. Verify ngrok URL hasn't changed
# 3. Test webhook from GitLab UI (GitLab → Webhooks → Edit → Test)
# 4. Check CI Agent is listening on port 3000
curl http://localhost:3000/health  # Should return 200
```

### Issue: LLM Classification Takes Too Long

```bash
# 1. Check Featherless AI API is responsive
# 2. Use heuristic-only mode (built-in fallback)
# 3. Check network connectivity
# 4. Verify API key is valid
```

### Issue: Slack Notifications Not Sent

```bash
# 1. Verify SLACK_WEBHOOK is correct
# 2. Test Slack connection:
curl -X POST $SLACK_WEBHOOK \
  -d '{"text":"Test message"}' \
  -H 'Content-Type: application/json'

# 3. Check firewall/network allows outbound to Slack
```

### Issue: Pipeline Doesn't Re-run

```bash
# 1. Verify your GitLab token has permissions
# 2. Check token scope includes: api, read_api, write_repository
# 3. Test GitLab API directly:
curl -H "PRIVATE-TOKEN: $GITLAB_TOKEN" \
  https://gitlab.com/api/v4/projects/YOUR_PROJECT_ID/jobs
```

---

## 🎯 Hackathon Presentation Checklist

### Before Demo Day

- [ ] Test repository created and configured
- [ ] ngrok tunnel is stable and public URL noted
- [ ] CI Agent running and responding to webhooks
- [ ] 3-4 error scenarios tested successfully
- [ ] Slack notifications verified
- [ ] Screenshots/videos recorded
- [ ] Metrics documented
- [ ] Demo script written and practiced
- [ ] Fallback plan if live repo fails

### On Demo Day

1. **Show the Setup** (1 min)
   - GitLab repo structure
   - Webhook configuration
   - CI Agent architecture

2. **Trigger Error** (1 min)
   - Push code with error
   - Show pipeline failing on GitLab

3. **Show Analysis** (1 min)
   - Live terminal showing webhook receipt
   - LLM analysis and classification
   - Confidence scoring

4. **Show Remediation** (1 min)
   - Pipeline automatically re-running
   - Autonomous fix succeeding
   - Metrics updating

5. **Show Results** (1 min)
   - Slack notification sent
   - Success rate improved
   - Team notified after resolution

---

## 🏆 Why This Impresses Judges

✅ **Real-World Testing** - Not just unit tests, actual GitLab integration  
✅ **Live Demonstration** - Show it working in real-time  
✅ **Error Detection** - Multiple error types classified correctly  
✅ **Autonomous Action** - System fixes problems automatically  
✅ **Safety First** - All actions validated before execution  
✅ **Team Communication** - Slack notifications with reasoning  
✅ **Measuring Impact** - Success rates and metrics show value  

---

## 📊 Expected Results After Testing

```
METRICS DASHBOARD
├─ Total Errors Detected: 15-20
├─ Classification Accuracy: 90%+
├─ Autonomous Fixes Applied: 12-15
├─ Fix Success Rate: 85-90%
├─ Response Time: <30 seconds
├─ False Positives: <10%
├─ Team Notifications: 15-20 Slack messages
└─ Pipeline Efficiency: 25-30% improvement

ERROR DISTRIBUTION
├─ Flaky Tests: 40%
├─ Dependency Issues: 25%
├─ Environment Issues: 15%
├─ Timeouts: 10%
├─ Rate Limits: 5%
└─ Other: 5%

ACTION EFFECTIVENESS
├─ Retry Success: 92%
├─ Reinstall Success: 88%
├─ Clear Cache Success: 85%
└─ Environment Update Success: 80%
```

---

## 🚀 Final Demo Command

```bash
# Run this 5 minutes before demo time
npm start

# In another terminal, monitor logs
tail -f logs/combined.log | grep -i "webhook\|classification\|action"

# Be ready to push test code that triggers errors
# Record screen for evidence
```

**Total Demo Time**: 5-10 minutes  
**Impact**: Shows judges a complete, working CI/CD automation solution

---

**Ready to win the hackathon? Let's go! 🏆**
