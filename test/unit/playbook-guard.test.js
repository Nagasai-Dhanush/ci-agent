const {
    isSafeAction,
    isPowerfulAction,
    shouldExecuteAction,
    validateAction,
    getActionCooldown,
    getExplanationTemplate,
    SAFETY_LIMITS,
    ERROR_TYPE_SEVERITY
} = require('../../config/playbook-guard');

describe('Playbook Guard - Safety Guardrails', () => {
    describe('isSafeAction', () => {
        test('should identify safe actions', () => {
            expect(isSafeAction('retry')).toBe(true);
            expect(isSafeAction('reinstall')).toBe(true);
            expect(isSafeAction('clear_cache')).toBe(true);
            expect(isSafeAction('restart_service')).toBe(true);
            expect(isSafeAction('update_env')).toBe(true);
            expect(isSafeAction('notify')).toBe(true);
        });

        test('should reject unsafe actions', () => {
            expect(isSafeAction('bad_action')).toBe(false);
            expect(isSafeAction('delete_branch')).toBe(false);
            expect(isSafeAction('modify_code')).toBe(false);
        });
    });

    describe('isPowerfulAction', () => {
        test('should identify powerful actions', () => {
            expect(isPowerfulAction('modify_code')).toBe(true);
            expect(isPowerfulAction('delete_branches')).toBe(true);
            expect(isPowerfulAction('alter_permissions')).toBe(true);
            expect(isPowerfulAction('modify_production')).toBe(true);
        });

        test('should reject safe actions', () => {
            expect(isPowerfulAction('retry')).toBe(false);
            expect(isPowerfulAction('reinstall')).toBe(false);
        });
    });

    describe('shouldExecuteAction', () => {
        test('should allow high confidence action', () => {
            const result = shouldExecuteAction(0.95, 'flaky_test', 0);
            expect(result.allowed).toBe(true);
        });

        test('should reject low confidence action', () => {
            const result = shouldExecuteAction(0.5, 'flaky_test', 0);
            expect(result.allowed).toBe(false);
            expect(result.reason).toBe('Low confidence');
        });

        test('should enforce max retries limit', () => {
            const result = shouldExecuteAction(0.9, 'flaky_test', 5);
            expect(result.allowed).toBe(false);
            expect(result.reason).toBe('Max retries reached');
        });

        test('should require higher confidence for high severity errors', () => {
            const result = shouldExecuteAction(0.80, 'permission_error', 0);
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('0.85');
        });

        test('should allow lower confidence for low severity errors', () => {
            const result = shouldExecuteAction(0.75, 'flaky_test', 0);
            expect(result.allowed).toBe(true);
        });
    });

    describe('validateAction', () => {
        test('should validate retry for flaky_test', () => {
            const result = validateAction('retry', 'flaky_test');
            expect(result.valid).toBe(true);
        });

        test('should validate reinstall for dependency_issue', () => {
            const result = validateAction('reinstall', 'dependency_issue');
            expect(result.valid).toBe(true);
        });

        test('should reject invalid action', () => {
            const result = validateAction('bad_action', 'flaky_test');
            expect(result.valid).toBe(false);
            expect(result.reason).toContain('not in safe list');
        });

        test('should reject wrong action for error type', () => {
            const result = validateAction('reinstall', 'flaky_test');
            expect(result.valid).toBe(false);
            expect(result.reason).toContain('not allowed');
        });

        test('should allow notify for any error type', () => {
            const result = validateAction('notify', 'code_error');
            expect(result.valid).toBe(true);
        });
    });

    describe('getActionCooldown', () => {
        test('should return cooldown for known actions', () => {
            const cooldown = getActionCooldown('retry');
            expect(cooldown).toBeGreaterThan(0);
            expect(cooldown).toBe(10000); // 10 seconds
        });

        test('should return default cooldown for unknown actions', () => {
            const cooldown = getActionCooldown('unknown');
            expect(cooldown).toBe(5000); // Default
        });

        test('should have reasonable cooldown values', () => {
            Object.keys(SAFETY_LIMITS).forEach(() => {
                const cooldown = getActionCooldown('retry');
                expect(cooldown).toBeGreaterThan(0);
                expect(cooldown).toBeLessThan(60000); // Less than 1 minute
            });
        });
    });

    describe('getExplanationTemplate', () => {
        test('should provide templates for all combinations', () => {
            const template = getExplanationTemplate('flaky_test', 'retry', 0.9);
            expect(template).toBeDefined();
            expect(typeof template).toBe('string');
            expect(template.length).toBeGreaterThan(0);
        });

        test('should have meaningful templates', () => {
            const template = getExplanationTemplate('dependency_issue', 'reinstall', 0.9);
            expect(template.toLowerCase()).toContain('reinsta');
        });
    });

    describe('SAFETY_LIMITS constant', () => {
        test('should define all required limits', () => {
            expect(SAFETY_LIMITS.max_retries_per_pipeline).toBeDefined();
            expect(SAFETY_LIMITS.min_confidence_for_action).toBeDefined();
            expect(SAFETY_LIMITS.timeout_per_action).toBeDefined();
        });

        test('should have reasonable values', () => {
            expect(SAFETY_LIMITS.max_retries_per_pipeline).toEqual(2);
            expect(SAFETY_LIMITS.min_confidence_for_action).toEqual(0.75);
            expect(SAFETY_LIMITS.timeout_per_action).toBeGreaterThan(0);
        });
    });

    describe('ERROR_TYPE_SEVERITY constant', () => {
        test('should classify all error types', () => {
            expect(ERROR_TYPE_SEVERITY.flaky_test).toBe('low');
            expect(ERROR_TYPE_SEVERITY.dependency_issue).toBe('medium');
            expect(ERROR_TYPE_SEVERITY.code_error).toBe('high');
            expect(ERROR_TYPE_SEVERITY.permission_error).toBe('high');
        });

        test('should only use valid severity levels', () => {
            const validSeverities = ['low', 'medium', 'high'];
            Object.values(ERROR_TYPE_SEVERITY).forEach(severity => {
                expect(validSeverities).toContain(severity);
            });
        });
    });

    describe('Integration - Safety Rules', () => {
        test('high severity + low confidence should block execution', () => {
            const validate = validateAction('retry', 'permission_error');
            const shouldExec = shouldExecuteAction(0.70, 'permission_error', 0);
            
            expect(shouldExec.allowed).toBe(false);
        });

        test('low severity + high confidence should allow execution', () => {
            const validate = validateAction('retry', 'flaky_test');
            const shouldExec = shouldExecuteAction(0.95, 'flaky_test', 0);
            
            expect(validate.valid).toBe(true);
            expect(shouldExec.allowed).toBe(true);
        });

        test('max retries should override confidence', () => {
            const shouldExec = shouldExecuteAction(0.99, 'flaky_test', 3);
            expect(shouldExec.allowed).toBe(false);
        });
    });
});
