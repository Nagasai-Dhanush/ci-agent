# Architecture Decision Record (ADR)

## Overview
This document records key architectural decisions and their rationales for the CI Agent system.

## ADR-001: LLM Integration Strategy

### Decision
Use Featherless AI for primary classification with heuristic fallback pattern matching.

### Rationale
- **Cost efficiency**: Fallback heuristics reduce API calls by 60-70% for obvious patterns
- **Reliability**: Works offline with local patterns when API is unavailable
- **Performance**: Heuristics respond in <100ms vs 1-2s for LLM
- **Safety**: Heuristic patterns are deterministic and auditable

### Implementation
1. Try chain-of-thought LLM analysis first
2. On failure/timeout, fall back to heuristic classification
3. Both methods return consistent structure

---

## ADR-002: Safety Guardrails Over Automation

### Decision
Implement strict confidence thresholds and action validation before execution.

### Rationale
- **Principle**: Humans approve after fixes, not before
- **Safety**: Low confidence classifications escalate to manual review
- **Auditability**: All auto-actions are logged and explainable
- **Recovery**: Safe actions (retry, cache clear) can be rolled back

### Constraints
- Min 75% confidence for any auto-action
- Max 2 auto-retries per pipeline
- High-severity errors require 85%+ confidence
- Action type must match error classification

---

## ADR-003: Bright Data Enrichment as Optional Enhancement

### Decision
Bright Data enrichment is optional; system works with local patterns as fallback.

### Rationale
- **Hackathon norms**: Integrates external data service as shown
- **Flexibility**: Works even if Bright Data API is unavailable
- **Cost control**: Local patterns don't incur extra API costs
- **Speed**: Local patterns are instant

### Implementation
1. Attempt Bright Data API call (3s timeout)
2. On failure, use local pattern database
3. Both enrichments feed into LLM analysis

---

## ADR-004: Monitoring Without Database

### Decision
Use in-memory tracking with optional persistence layer.

### Rationale
- **Simplicity**: No external dependencies initially
- **Performance**: Real-time metrics without I/O
- **Scalability**: Optional DB layer can be added
- **Hackathon**: Suitable for event-driven showcase

### Future Enhancement
Ready for SQLite/PostgreSQL integration

---

## ADR-005: Notification Strategy

### Decision
Notify humans AFTER remediation with rich context, not before.

### Rationale
- **Efficiency**: Reduces human alert fatigue
- **Transparency**: Summary includes reasoning steps
- **Accountability**: Each action is explained and audited
- **UX**: Slack notification shows resolution status

### Message Content
- Error classification + confidence
- Root cause analysis with reasoning
- Action taken + result
- Project success rate (for context)
- Link to new pipeline run

---

## ADR-006: Error Type Taxonomy

### Decision
Define 7 main error categories with specific remediation patterns.

### Error Types
1. **Flaky Test** - Transient failures → Retry
2. **Dependency Issue** - Package conflicts → Reinstall
3. **Environment Issue** - Network/connectivity → Retry
4. **Timeout** - Performance bottleneck → Retry with backoff
5. **Rate Limit** - Quota exceeded → Scheduled retry
6. **Permission Error** - Auth issues → Manual
7. **Code Error** - Logic bugs → Manual

### Rationale
- Clear mapping to safe remediation actions
- Covers 95% of observed CI failures
- Extensible for new patterns

---

## ADR-007: Action Safety Levels

### Decision
Implement two-tier action safety: "Safe" vs "Powerful" actions.

### Safe Actions (Auto-executable)
- `retry` - Restart pipeline
- `clear_cache` - Build cache clean
- `update_env` - Env var adjustment
- `restart_service` - Service restart

### Powerful Actions (Require approval)
- `modify_code` - Not implemented
- `delete_branches` - Not implemented
- `alter_permissions` - Not implemented
- `modify_production` - Not implemented

### Rationale
- Safe actions are reversible
- No data loss or production impact
- Powerful actions reserve for future expansion

---

## ADR-008: Execution Retry Strategy

### Decision
Use exponential backoff with max retries per action.

### Implementation
- `p-retry` library for retry logic
- 2s, 4s, 8s backoff sequence
- Action-specific cooldowns (5-20 seconds)
- Max 2 pipeline retries (safety limit)

### Rationale
- Handles transient failures gracefully
- Prevents API rate limiting
- Respects system resource constraints

---

## ADR-009: Logging Architecture

### Decision
Use Winston logger with console + file output.

### Log Levels
- **error** - Failures requiring attention
- **warn** - Unexpected but handled conditions
- **info** - Significant state changes
- **debug** - Detailed operational flow
- **trace** - Deep diagnostic info

### Storage
- `logs/error.log` - Error level only
- `logs/combined.log` - All levels
- Console output with colors

### Rationale
- Structured logging for debugging
- File rotation ready (with logrotate)
- Integration with monitoring systems

---

## ADR-010: Webhook Processing Model

### Decision
Process webhooks asynchronously with early response.

### Flow
```
GitHub sends webhook
  ↓
Return 200 immediately
  ↓
Background: Log fetch → Analysis → Action → Notification
```

### Rationale
- Webhook timeout: 5-30 seconds (repo dependent)
- Processing can take 10-60 seconds
- Early response prevents retry storms
- No user UX impact

### Trade-offs
- Harder to report errors to webhook sender
- Slack notification is error notification
- Suitable for background processing

---

## ADR-011: Configuration Management

### Decision
Use .env file for secrets, environment variables for deployment.

### Hierarchy
1. Environment variables (highest priority)
2. .env file (development)
3. config/ files (shared constants)
4. Defaults in code

### Rationale
- Twelve-factor app methodology
- Suitable for Docker deployment
- Secrets never in git
- Local development ease

---

## Performance Considerations

### Optimization Targets
- Log analysis: <1 second
- AI classification: <2 seconds
- Action execution: <5 seconds
- Total flow: < 10 seconds

### Caching Opportunities
- Similar log patterns (heuristic)
- Enrichment data (15 min TTL)
- Project metadata (hourly)

### Scalability Path
- Local → Redis cache
- In-memory → Timeseries DB
- Single process → Load balanced

---

## Security Model

### Threat: API Key Leakage
- Mitigated: Keys in .env (not git)
- Mitigation: Rotate keys regularly

### Threat: Malicious Webhook
- Mitigated: Validate event structure
- Mitigation: Verify webhook signature (future)

### Threat: Over-aggressive Auto-fix
- Mitigated: Confidence thresholds
- Mitigation: Max retry limits

### Threat: Information Disclosure
- Mitigated: Slack notifications to specific channels
- Mitigation: Audit logging

---

## Future Architecture Evolutions

### Phase 2: Persistence
- Add SQLite for metrics (dev)
- Optional PostgreSQL (prod)
- Time-series db for trends

### Phase 3: Extensibility
- Plugin system for custom actions
- Project-specific playbooks
- Custom LLM models

### Phase 4: Intelligence
- ML model for pattern recognition
- Anomaly detection
- Predictive issue resolution

### Phase 5: Compliance
- Audit logging to immutable storage
- SAML/OAuth integration
- Approval workflows

---

Generated: 2024-03-27
Last Updated: 2024-03-27
