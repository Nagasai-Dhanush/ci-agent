# Advanced CI Agent Usage Guide

## Custom Integration Examples

### 1. Custom Slack Channel Routing

Route different error types to different Slack channels:

```javascript
// services/slack.js - Enhancement
async function sendSlackToSpecificChannel(data, channel) {
    const webhooksMap = {
        'backend-failures': process.env.SLACK_WEBHOOK_BACKEND,
        'frontend-failures': process.env.SLACK_WEBHOOK_FRONTEND,
        'infra-failures': process.env.SLACK_WEBHOOK_INFRA
    };

    const webhook = webhooksMap[channel];
    if (!webhook) throw new Error(`Unknown channel: ${channel}`);

    await axios.post(webhook, {
        attachments: [{...}]
    });
}
```

### 2. Custom Remediation Workflows

Add project-specific remediation logic:

```javascript
// services/custom-playbook.js
const projectSpecificActions = {
    'frontend-app': {
        'css_build_error': () => clearYarnCache(),
        'npm_conflict': () => rebuildNodeModules()
    },
    'backend-api': {
        'db_timeout': () => restartDatabasePool(),
        'env_missing': () => fetchSecretsFromVault()
    }
};

async function getCustomAction(projectName, errorType) {
    const actions = projectSpecificActions[projectName] || {};
    return actions[errorType] || null;
}
```

### 3. Database Logging

Persist execution history:

```javascript
// services/database-logger.js
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./data/ci-agent.db');

async function logExecution(event) {
    db.run(`
        INSERT INTO executions 
        (pipeline_id, project_id, error_type, action, confidence, success, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
        event.pipelineId,
        event.projectId,
        event.errorType,
        event.action,
        event.confidence,
        event.success,
        new Date()
    ]);
}

// Query trends
async function getErrorTrends(projectId, days = 7) {
    return db.all(`
        SELECT error_type, COUNT(*) as count
        FROM executions
        WHERE project_id = ? AND timestamp > datetime('now', '-' || ? || ' days')
        GROUP BY error_type
        ORDER BY count DESC
    `, [projectId, days]);
}
```

## Metrics & Analytics

### Custom Dashboard

```javascript
// services/analytics.js
async function generateDashboard(projectId) {
    const metrics = {
        resolutionRate: await getResolutionRate(projectId),
        avgResolutionTime: await getAvgResolutionTime(projectId),
        errorDistribution: await getErrorDistribution(projectId),
        actionEffectiveness: await getActionEffectiveness(projectId),
        timelineMetrics: await getTimelineMetrics(projectId),
        topResolvedErrors: await getTopResolvedErrors(projectId)
    };

    return metrics;
}

// Express endpoint
app.get('/dashboard', async (req, res) => {
    const projectId = req.query.projectId;
    const dashboard = await generateDashboard(projectId);
    res.json(dashboard);
});
```

## Advanced Error Classification

### Multi-Model Ensemble

Combine multiple analysis approaches:

```javascript
// services/ensemble-classifier.js
async function classifyWithEnsemble(logs, enrichment) {
    const results = await Promise.allSettled([
        // LLM analysis
        analyzeWithChainOfThought(logs, enrichment),
        // Heuristic analysis
        heuristicClassification(logs, enrichment),
        // Pattern matching
        patternMatchClassification(logs),
        // External service check
        checkExternalServiceStatus(enrichment)
    ]);

    // Aggregate results
    const classifications = results
        .filter(r => r.status === 'fulfilled')
        .map(r => r.value);

    // Vote on final classification
    return aggregateClassifications(classifications);
}
```

### Learning from History

Improve classification over time:

```javascript
// services/learning-classifier.js
async function classifyAndLearn(logs, enrichment) {
    // Get historical similar cases
    const similar = await findSimilarCases(logs);
    
    // Use similar cases as context
    const contextualAnalysis = await analyzeWithContext(logs, similar);
    
    // Store for future learning
    await storeAnalysis(logs, contextualAnalysis);
    
    return contextualAnalysis;
}
```

## Safety & Governance

### Approval Workflow

Add approval for high-risk actions:

```javascript
// services/approval-manager.js
async function executeWithApproval(action, errorType, confidence) {
    // Check if approval needed
    if (needsApproval(action, errorType, confidence)) {
        // Send approval request to Slack
        const approvalId = await requestApprovalViaSlack({
            action,
            errorType,
            confidence
        });

        // Wait for response (with timeout)
        const approved = await waitForApproval(approvalId, 5000); // 5min timeout
        
        if (!approved) {
            throw new Error('Approval timeout');
        }
    }

    return executeAction(action);
}

function needsApproval(action, errorType, confidence) {
    // High-risk combinations
    return confidence < 0.8 || errorType === 'code_error';
}
```

### Audit Trail

Complete audit logging:

```javascript
// middleware/audit-logger.js
async function logAuditEvent(event) {
    const auditRecord = {
        timestamp: new Date(),
        eventType: event.type,
        actor: 'ci-agent',
        action: event.action,
        target: event.target,
        result: event.result,
        riskLevel: event.riskLevel,
        signature: signAuditEntry(event)
    };

    await storeAuditEvent(auditRecord);
    
    // Alert on unusual activity
    if (isUnusualActivity(event)) {
        await notifySecurityTeam(event);
    }
}
```

## Performance Optimization

### Caching

```javascript
// utils/cache.js
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 600 }); // 10 min

async function classifyWithCache(logs, enrichment) {
    const cacheKey = hashLogs(logs);
    
    // Check cache
    const cached = cache.get(cacheKey);
    if (cached) {
        log.debug('Cache hit for classification');
        return cached;
    }

    // Classify and cache
    const result = await classifyError(logs, enrichment);
    cache.set(cacheKey, result);
    
    return result;
}
```

### Parallel Processing

```javascript
// services/batch-processor.js
async function processBatch(events) {
    const concurrency = 5; // Max parallel
    
    for (let i = 0; i < events.length; i += concurrency) {
        const batch = events.slice(i, i + concurrency);
        await Promise.all(batch.map(processEvent));
    }
}
```

## Integration Examples

### With PagerDuty

```javascript
// services/pagerduty-integration.js
async function createIncidentOnHighSeverity(analysis) {
    if (analysis.severity === 'high' && analysis.confidence < 0.7) {
        await axios.post('https://api.pagerduty.com/incidents', {
            incident: {
                title: `CI Failure - ${analysis.errorType}`,
                body: {
                    details: analysis.root_cause
                },
                urgency: 'high'
            }
        }, {
            headers: {
                'Authorization': `Token token=${process.env.PAGERDUTY_TOKEN}`
            }
        });
    }
}
```

### With DataDog/Monitoring

```javascript
// services/monitoring-integration.js
const StatsD = require('node-statsd').StatsD;
const dogstatsd = new StatsD();

async function trackMetrics(analysis, result) {
    dogstatsd.increment('ci_agent.failures', 1, [`type:${analysis.type}`]);
    dogstatsd.gauge('ci_agent.confidence', analysis.confidence);
    dogstatsd.timing('ci_agent.resolution_time', result.duration);
    
    if (result.success) {
        dogstatsd.increment('ci_agent.resolutions', 1);
    }
}
```

### With Datadog/Logs

```javascript
// utils/datadog-logger.js
const DDTracer = require('dd-trace');
const tracer = DDTracer.init();

async function logWithTracing(event) {
    const span = tracer.startSpan('ci_agent.process_event');
    try {
        // Process event
        span.setTag('event.type', event.type);
        span.setTag('project.id', event.projectId);
    } catch (err) {
        span.setTag('error', true);
        span.setTag('error.message', err.message);
    } finally {
        span.finish();
    }
}
```

## Testing Strategies

### Unit Tests

```javascript
// test/playbook.test.js
const { getAction } = require('../services/playbook');

describe('Playbook', () => {
    test('should select retry for flaky tests', () => {
        const action = getAction('flaky_test', { confidence: 0.9 });
        expect(action).toBe('retry');
    });

    test('should escalate low confidence', () => {
        const action = getAction('code_error', { confidence: 0.5 });
        expect(action).toBe('notify');
    });
});
```

### Integration Tests

```javascript
// test/webhook.integration.test.js
const request = require('supertest');
const app = require('../server');

describe('Webhook Integration', () => {
    test('should process failed pipeline event', async () => {
        const response = await request(app)
            .post('/webhook/gitlab')
            .send(require('./fixtures/failed-pipeline.json'));
        
        expect(response.status).toBe(200);
    });
});
```

---

For more information, see README.md and DEPLOYMENT.md
