const { PLAYBOOK } = require('../../services/playbook');
const { SAFETY_LIMITS, shouldExecuteAction, validateAction } = require('../../config/playbook-guard');
const { heuristicClassification } = require('../../utils/llm-reasoning');

describe('CI Agent - Integration Tests', () => {
    describe('End-to-End Workflow', () => {
        test('should handle flaky test failure end-to-end', () => {
            // Step 1: Error occurs
            const logs = `
            [ERROR] Test timeout waiting for response
            AssertionError: expected 5 to equal 10
            This test sometimes passes
            `;

            // Step 2: Analyze error
            const analysis = heuristicClassification(logs);
            expect(analysis.type).toBe('flaky_test');
            expect(analysis.confidence).toBeGreaterThan(0.7);

            // Step 3: Validate action
            const action = analysis.suggested_action;
            const validation = validateAction(action, analysis.type);
            expect(validation.valid).toBe(true);

            // Step 4: Check execution eligibility
            const canExecute = shouldExecuteAction(analysis.confidence, analysis.type, 0);
            expect(canExecute.allowed).toBe(true);

            // Step 5: Get playbook entry
            const entry = PLAYBOOK[analysis.type];
            expect(entry.primary).toBe(action);
        });

        test('should escalate permission error to manual', () => {
            const logs = 'Permission denied EACCES access';
            const analysis = heuristicClassification(logs);
            
            expect(analysis.type).toBe('permission_error');
            expect(analysis.suggested_action).toBe('notify');
            
            // Should NOT auto-execute
            const canExecute = shouldExecuteAction(0.95, analysis.type, 0);
            // High severity requires manual review
            expect(canExecute.allowed).toBe(false);
        });

        test('should respect retry limits', () => {
            const logs = 'npm ERR! 404 package not found';
            const analysis = heuristicClassification(logs);
            
            // First attempt: allowed
            let canExecute = shouldExecuteAction(analysis.confidence, analysis.type, 0);
            expect(canExecute.allowed).toBe(true);

            // Second attempt: allowed
            canExecute = shouldExecuteAction(analysis.confidence, analysis.type, 1);
            expect(canExecute.allowed).toBe(true);

            // Third attempt: blocked
            canExecute = shouldExecuteAction(analysis.confidence, analysis.type, 2);
            expect(canExecute.allowed).toBe(false);
        });

        test('should enforce confidence thresholds by severity', () => {
            // Low confidence + high severity = block
            const highSeverity = 'SyntaxError invalid code';
            const analysis = heuristicClassification(highSeverity);
            
            const lowConfidence = shouldExecuteAction(0.70, analysis.type, 0);
            expect(lowConfidence.allowed).toBe(false);

            // High confidence + high severity = allow
            const highConfidence = shouldExecuteAction(0.95, 'flaky_test', 0);
            expect(highConfidence.allowed).toBe(true);
        });
    });

    describe('Error Classification Pipeline', () => {
        test('should classify common CI failures correctly', () => {
            const scenarios = [
                {
                    name: 'Flaky test',
                    logs: 'test failed timeout',
                    expectedType: 'flaky_test'
                },
                {
                    name: 'Missing dependency',
                    logs: 'npm ERR! Cannot find module',
                    expectedType: 'dependency_issue'
                },
                {
                    name: 'Network issue',
                    logs: 'ECONNRESET socket reset',
                    expectedType: 'env_issue'
                },
                {
                    name: 'API timeout',
                    logs: 'request timeout after 30 seconds',
                    expectedType: 'timeout'
                },
                {
                    name: 'Rate limited',
                    logs: 'HTTP 429 Too Many Requests',
                    expectedType: 'rate_limit'
                }
            ];

            scenarios.forEach(scenario => {
                const result = heuristicClassification(scenario.logs);
                expect(result.type).toBe(scenario.expectedType);
                console.log(`✓ ${scenario.name} classified correctly`);
            });
        });
    });

    describe('Safety Guardrails in Action', () => {
        test('should prevent unsafe combinations', () => {
            const testCases = [
                {
                    action: 'retry',
                    type: 'code_error',
                    shouldValidate: false // Wrong match
                },
                {
                    action: 'reinstall',
                    type: 'flaky_test',
                    shouldValidate: false // Wrong match
                },
                {
                    action: 'retry',
                    type: 'flaky_test',
                    shouldValidate: true // Correct match
                }
            ];

            testCases.forEach(tc => {
                const result = validateAction(tc.action, tc.type);
                expect(result.valid).toBe(tc.shouldValidate);
            });
        });

        test('should enforce minimum confidence requirements', () => {
            const tests = [
                { conf: 0.50, expected: false }, // Too low
                { conf: 0.75, expected: true },  // Minimum
                { conf: 0.85, expected: true },  // Good
                { conf: 0.95, expected: true }   // Excellent
            ];

            tests.forEach(test => {
                const result = shouldExecuteAction(test.conf, 'flaky_test', 0);
                expect(result.allowed).toBe(test.expected);
            });
        });

        test('should handle edge cases', () => {
            // Zero retries
            let result = shouldExecuteAction(0.95, 'flaky_test', 0);
            expect(result.allowed).toBe(true);

            // Max retries
            result = shouldExecuteAction(0.95, 'flaky_test', SAFETY_LIMITS.max_retries_per_pipeline);
            expect(result.allowed).toBe(false);

            // Confidence on boundary
            result = shouldExecuteAction(SAFETY_LIMITS.min_confidence_for_action, 'flaky_test', 0);
            expect(result.allowed).toBe(true);
        });
    });

    describe('Playbook Consistency', () => {
        test('all error types should be handled', () => {
            const errorTypes = Object.keys(PLAYBOOK);
            expect(errorTypes.length).toBeGreaterThan(0);

            errorTypes.forEach(type => {
                const entry = PLAYBOOK[type];
                expect(entry.primary).toBeDefined();
                expect(entry.fallback).toBeDefined();
                expect(entry.max_attempts).toBeGreaterThan(0);
            });
        });

        test('all actions should be safe', () => {
            const safeActions = ['retry', 'reinstall', 'clear_cache', 'restart_service', 'update_env', 'notify'];
            
            Object.values(PLAYBOOK).forEach(entry => {
                expect(safeActions).toContain(entry.primary);
                entry.fallback.forEach(action => {
                    expect(safeActions).toContain(action);
                });
            });
        });
    });

    describe('Real-World Scenarios', () => {
        test('high-frequency error type handling', () => {
            // Simulate 100 similar errors
            const results = [];
            for (let i = 0; i < 100; i++) {
                const analysis = heuristicClassification('npm ERR! ERR! error');
                results.push(analysis);
            }

            // All should be classified same way
            const types = results.map(r => r.type);
            expect(new Set(types).size).toBe(1);
            expect(types[0]).toBe('dependency_issue');
        });

        test('mixed severity handling', () => {
            const mockExecutions = [
                { type: 'flaky_test', conf: 0.9, retries: 0, expected: true },
                { type: 'permission_error', conf: 0.9, retries: 0, expected: true },  // high severity, 0.9 >= 0.85 = allowed
                { type: 'dependency_issue', conf: 0.85, retries: 0, expected: true },
                { type: 'code_error', conf: 0.8, retries: 0, expected: false }  // high severity, 0.8 < 0.85 = blocked
            ];

            mockExecutions.forEach(exec => {
                const result = shouldExecuteAction(exec.conf, exec.type, exec.retries);
                expect(result.allowed).toBe(exec.expected);
            });
        });
    });
});
