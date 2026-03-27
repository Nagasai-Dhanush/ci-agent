# ⚡ CI Agent - Real-World Testing Quick Start

## 🎯 Fastest Path to Winning the Hackathon

**From "setup complete" to "judges impressed" in 3 hours**

---

## 🚀 Hour 1: Setup (30 minutes)

```bash
# 1. Start CI Agent
npm start
# Wait for: "CI Agent listening on port 3000"

# 2. Verify ngrok is running (in separate terminal)
# Should show: Forwarding http://xxxxx.ngrok.io -> http://localhost:3000

# 3. Create .env file with credentials
# See GITLAB_INTEGRATION.md for complete setup

# 4. Test connection
curl -H "PRIVATE-TOKEN: your_gitlab_token" \
  https://gitlab.com/api/v4/user
# Should return your GitLab profile
```

## 🎯 Hour 2: Create Test Repository (30 minutes)

```bash
# 1. Create GitLab repository
# Go to: gitlab.com/projects/new
# Name: ci-agent-test-repo
# Visibility: Public

# 2. Clone locally
git clone https://gitlab.com/YOUR_USERNAME/ci-agent-test-repo.git
cd ci-agent-test-repo

# 3. Add .gitlab-ci.yml (copy from GITLAB_INTEGRATION.md)
git add .gitlab-ci.yml
git commit -m "Add CI/CD pipeline"
git push origin main

# 4. Configure GitLab webhook
# Go to: Settings → Webhooks
# URL: http://your-ngrok-url/webhook/gitlab
# Events: Pipeline events
# Test webhook (should get 200 OK)

# 5. Add first failing test (from SAMPLE_FAILURES.md)
mkdir -p test
# Create test/flaky.test.js
git add test/flaky.test.js
git commit -m "Add flaky test"
git push origin main
```

## 🎬 Hour 3: Watch It Work (30 minutes)

```bash
# Terminal 1: Monitor CI Agent logs
tail -f logs/combined.log | grep -i classification

# Terminal 2: Watch GitLab pipeline
# Go to: https://gitlab.com/YOUR_USERNAME/ci-agent-test-repo/-/pipelines

# Terminal 3: Watch Slack channel
# Should see auto-sent notification with:
# - Error classification
# - Confidence score
# - Automatic action taken
# - Success confirmation
```

---

## 📊 What Judges See

```
BEFORE (Without CI Agent):
Pipeline fails
  → Developer gets paged at 3 AM
  → Spends 30 mins debugging
  → Finds it was a flaky test
  → Manually reruns pipeline
  → Waits for fix
  Result: Lost productivity

AFTER (With CI Agent):
Pipeline fails
  → CI Agent detects in <30 seconds
  → LLM analyzes: "flaky_test" (87% confidence)
  → Automatically retries
  → Pipeline succeeds
  → Team gets notification
  → Developer can focus on real work
  Result: 30% faster resolution 🚀
```

---

## 🎯 Documentation Files

| File | What It's For | When to Use |
|------|---------------|------------|
| **QUICK_START.md** | This! Quick overview | First time setup |
| **GITLAB_INTEGRATION.md** | Step-by-step setup | Detailed configuration |
| **REAL_WORLD_TESTING.md** | Full testing guide | Complete walkthrough |
| **SAMPLE_FAILURES.md** | Error scenarios | Create test errors |
| **HACKATHON_DEMO_PLAN.md** | Demo script | Show to judges |
| **README.md** | Complete guide | Deep dive |

---

## 💡 Quick Reference

```
TO GET STARTED:
  → Start CI Agent: npm start
  → Get ngrok URL
  → Follow GITLAB_INTEGRATION.md

TO CREATE ERRORS:
  → Copy scenarios from SAMPLE_FAILURES.md
  → Push to test repository
  → Watch CI Agent classify

TO PREPARE DEMO:
  → Screenshot each error + fix
  → Record 5-minute screen video
  → Practice demo script (see HACKATHON_DEMO_PLAN.md)

TO WIN HACKATHON:
  → Show real GitLab integration working
  → Demonstrate LLM analysis on actual failure
  → Prove automatic fix succeeded
  → Explain safety guardrails
```

---

## ✅ Success Metrics

After following this guide, you'll have:

| Metric | Target | Your result |
|--------|--------|------------|
| Error detection time | <30 seconds | ___ |
| Classification accuracy | >90% | ___ |
| Auto-fix success rate | >85% | ___ |
| Slack notifications | 100% | ___ |
| Safety checks enforced | 100% | ___ |

---

## 🚨 Common Issues (Fixed)

| Problem | Solution |
|---------|----------|
| Webhook not received | Check ngrok URL is current, test from GitLab |
| No Slack message | Verify SLACK_WEBHOOK in .env |
| CI Agent logs show nothing | Check logs/combined.log, enable DEBUG mode |
| Pipeline won't fail | Add `exit 1` to .gitlab-ci.yml test job |
| ngrok URL changed | Update GitLab webhook URL with new URL |

---

## 🏆 Why This Wins

✅ **Real integration** - Actual GitLab, not mocked  
✅ **Live demo** - Working right now, not theoretical  
✅ **Autonomous** - System fixes without asking  
✅ **Smart** - LLM analysis with reasoning  
✅ **Safe** - All checks validated before action  
✅ **Measurable** - Metrics proving effectiveness  

---

## ⏱️ You Have 3 Hours

```
[0:00-0:30]   Setup & Configure
[0:30-1:00]   Create Test Repository
[1:00-1:30]   Trigger First Error
[1:30-2:00]   Test More Scenarios
[2:00-2:30]   Capture Evidence
[2:30-3:00]   Practice Demo Script

READY FOR JUDGES ✅
```

---

## 🚀 Next Steps

1. **Read GITLAB_INTEGRATION.md** for detailed setup (Step 1-10)
2. **Copy scenarios from SAMPLE_FAILURES.md** for error testing
3. **Follow REAL_WORLD_TESTING.md** for complete guidance
4. **Use HACKATHON_DEMO_PLAN.md** for demo script

---

**Everything is ready. Now execute! 🎯**

See individual guides for detailed instructions.
