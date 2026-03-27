const { getAction, getPlaybookEntry, getExplanation, PLAYBOOK } = require('../../services/playbook');

describe('Playbook Service', () => {
    describe('getAction', () => {
        test('should return retry for flaky_test with confidence > 0.7', () => {
            const action = getAction('flaky_test', { confidence: 0.9, retryCount: 0 });
            expect(action).toBe('retry');
        });

        test('should return reinstall for dependency_issue', () => {
            const action = getAction('dependency_issue', { confidence: 0.85, retryCount: 0 });
            expect(action).toBe('reinstall');
        });

        test('should return retry for env_issue', () => {
            const action = getAction('env_issue', { confidence: 0.8, retryCount: 0 });
            expect(action).toBe('retry');
        });

        test('should return notify when max retries reached', () => {
            const action = getAction('flaky_test', { confidence: 0.9, retryCount: 2 });
            expect(action).toBe('notify');
        });

        test('should return notify for unknown error type', () => {
            const action = getAction('unknown_error', { confidence: 0.9, retryCount: 0 });
            expect(action).toBe('notify');
        });

        test('should handle code_error by returning notify', () => {
            const action = getAction('code_error', { confidence: 0.95, retryCount: 0 });
            expect(action).toBe('notify');
        });

        test('should handle permission_error by returning notify', () => {
            const action = getAction('permission_error', { confidence: 0.95, retryCount: 0 });
            expect(action).toBe('notify');
        });

        test('should handle timeout with retry', () => {
            const action = getAction('timeout', { confidence: 0.85, retryCount: 0 });
            expect(action).toBe('retry');
        });

        test('should handle rate_limit with retry', () => {
            const action = getAction('rate_limit', { confidence: 0.9, retryCount: 0 });
            expect(action).toBe('retry');
        });
    });

    describe('getPlaybookEntry', () => {
        test('should return playbook entry for known error type', () => {
            const entry = getPlaybookEntry('flaky_test');
            expect(entry).toBeDefined();
            expect(entry.primary).toBe('retry');
            expect(entry.maxAttempts).toBe(2);
        });

        test('should return null for unknown error type', () => {
            const entry = getPlaybookEntry('unknown');
            expect(entry).toBeNull();
        });

        test('should have fallback actions', () => {
            const entry = getPlaybookEntry('dependency_issue');
            expect(entry.fallback).toBeDefined();
            expect(Array.isArray(entry.fallback)).toBe(true);
            expect(entry.fallback.length).toBeGreaterThan(0);
        });
    });

    describe('getExplanation', () => {
        test('should return explanation object with all required fields', () => {
            const explanation = getExplanation('flaky_test', 'retry', 0.9);
            expect(explanation).toBeDefined();
            expect(explanation.errorType).toBe('flaky_test');
            expect(explanation.selectedAction).toBe('retry');
            expect(explanation.confidence).toBe(0.9);
            expect(explanation.explanation).toBeDefined();
            expect(typeof explanation.explanation).toBe('string');
        });

        test('should provide meaningful explanations', () => {
            const explanation = getExplanation('dependency_issue', 'reinstall', 0.87);
            expect(explanation.explanation).toContain('reinstall');
        });
    });

    describe('PLAYBOOK constant', () => {
        test('should have all expected error types', () => {
            expect(PLAYBOOK.flaky_test).toBeDefined();
            expect(PLAYBOOK.dependency_issue).toBeDefined();
            expect(PLAYBOOK.env_issue).toBeDefined();
            expect(PLAYBOOK.code_error).toBeDefined();
        });

        test('should have consistent structure', () => {
            Object.values(PLAYBOOK).forEach(entry => {
                expect(entry.primary).toBeDefined();
                expect(entry.fallback).toBeDefined();
                expect(Array.isArray(entry.fallback)).toBe(true);
                expect(entry.description).toBeDefined();
                expect(entry.max_attempts).toBeDefined();
            });
        });

        test('should have valid max_attempts', () => {
            Object.values(PLAYBOOK).forEach(entry => {
                expect(entry.max_attempts).toBeGreaterThan(0);
                expect(entry.max_attempts).toBeLessThanOrEqual(3);
            });
        });
    });

    describe('Error Type Coverage', () => {
        test('should support 7 main error types', () => {
            const errorTypes = Object.keys(PLAYBOOK);
            expect(errorTypes.length).toBe(7);
        });

        test('all error types should have valid actions', () => {
            const validActions = ['retry', 'reinstall', 'clear_cache', 'restart_service', 'update_env', 'notify'];
            
            Object.entries(PLAYBOOK).forEach(([type, entry]) => {
                expect(validActions).toContain(entry.primary);
                entry.fallback.forEach(action => {
                    expect(validActions).toContain(action);
                });
            });
        });
    });
});
