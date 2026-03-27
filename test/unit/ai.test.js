const { heuristicClassification } = require('../../utils/llm-reasoning');
const { enrichFromKnownIssues } = require('../../services/brightdata');

describe('AI Classification - Heuristic Analysis', () => {
    describe('heuristicClassification', () => {
        test('should classify flaky test errors', () => {
            const logs = `
            Test failed: AssertionError expected 5 to equal 10
            Timeout waiting for response
            The test sometimes passes, sometimes fails
            `;
            
            const result = heuristicClassification(logs);
            expect(result.type).toBe('flaky_test');
            expect(result.confidence).toBeGreaterThan(0.5);
        });

        test('should classify dependency errors', () => {
            const logs = `
            npm ERR! 404 Not Found - GET https://registry.npmjs.org/package
            npm ERR! ModuleNotFoundError: Cannot find module 'express'
            `;
            
            const result = heuristicClassification(logs);
            expect(result.type).toBe('dependency_issue');
            expect(result.confidence).toBeGreaterThan(0.5);
        });

        test('should classify environment errors', () => {
            const logs = `
            ECONNRESET: Connection reset by peer
            ENOTFOUND: getaddrinfo ENOTFOUND api.example.com
            Connection refused to database
            `;
            
            const result = heuristicClassification(logs);
            expect(result.type).toBe('env_issue');
            expect(result.confidence).toBeGreaterThan(0.5);
        });

        test('should classify rate limit errors', () => {
            const logs = `
            HTTP 429: Too Many Requests
            Rate limit exceeded. Retry after 60 seconds
            Quota exceeded for API calls
            `;
            
            const result = heuristicClassification(logs);
            expect(result.type).toBe('rate_limit');
            expect(result.confidence).toBeGreaterThan(0.5);
        });

        test('should classify timeout errors', () => {
            const logs = `
            Request timeout after 30 seconds
            Operation timed out waiting for response
            ETIMEDOUT: connection establishment timed out
            `;
            
            const result = heuristicClassification(logs);
            expect(result.type).toBe('timeout');
            expect(result.confidence).toBeGreaterThan(0.5);
        });

        test('should classify permission errors', () => {
            const logs = `
            Permission denied: EACCES
            Unauthorized access: 401
            Forbidden resource: 403
            `;
            
            const result = heuristicClassification(logs);
            expect(result.type).toBe('permission_error');
            expect(result.confidence).toBeGreaterThan(0.5);
        });

        test('should classify code errors', () => {
            const logs = `
            SyntaxError: Unexpected token }
            TypeError: Cannot read property of undefined
            ReferenceError: variable is not defined
            `;
            
            const result = heuristicClassification(logs);
            expect(result.type).toBe('code_error');
            expect(result.confidence).toBeGreaterThan(0.5);
        });

        test('should return complete analysis result', () => {
            const logs = 'npm ERR! 404 package not found';
            const result = heuristicClassification(logs);
            
            expect(result).toHaveProperty('error_pattern');
            expect(result).toHaveProperty('root_cause');
            expect(result).toHaveProperty('type');
            expect(result).toHaveProperty('confidence');
            expect(result).toHaveProperty('reasoning');
            expect(result).toHaveProperty('suggested_action');
            expect(result).toHaveProperty('severity');
            expect(result).toHaveProperty('is_actionable');
            expect(result).toHaveProperty('source');
        });

        test('should mark as actionable when high confidence', () => {
            const logs = 'npm ERR! 404 package not found';
            const result = heuristicClassification(logs);
            
            if (result.confidence > 0.15) {
                expect(result.is_actionable).toBe(true);
            }
        });

        test('should handle unknown errors', () => {
            const logs = 'Build failed for unknown reasons';
            const result = heuristicClassification(logs);
            
            expect(result.type).toBeDefined();
            expect(result.confidence).toBeGreaterThan(0);
            expect(result.confidence).toBeLessThanOrEqual(1);
        });

        test('should prioritize strongest patterns', () => {
            const npmLog = 'npm ERR! 404 package';
            const syntaxLog = 'SyntaxError at line 5';
            
            const result1 = heuristicClassification(npmLog);
            const result2 = heuristicClassification(syntaxLog);
            
            expect(result1.type).toBe('dependency_issue');
            expect(result2.type).toBe('code_error');
        });

        test('should indicate severity levels', () => {
            const lowSeverity = 'Test randomly fails, timing issue';
            const highSeverity = 'SyntaxError: invalid code';
            
            const result1 = heuristicClassification(lowSeverity);
            const result2 = heuristicClassification(highSeverity);
            
            expect(['low', 'medium', 'high']).toContain(result1.severity);
            expect(['low', 'medium', 'high']).toContain(result2.severity);
        });
    });

    describe('enrichFromKnownIssues', () => {
        test('should enrich with known npm issues', () => {
            const keyword = 'npm ERR! 404';
            const enrichment = enrichFromKnownIssues(keyword);
            
            expect(enrichment.source).toBe('heuristic');
            expect(enrichment.known_issues).toBeDefined();
        });

        test('should identify multiple matching patterns', () => {
            const keyword = 'npm ERR! 404 Not Found in registry';
            const enrichment = enrichFromKnownIssues(keyword);
            
            expect(Array.isArray(enrichment.known_issues)).toBe(true);
            expect(enrichment.known_issues.length).toBeGreaterThan(0);
        });

        test('should return consistent enrichment structure', () => {
            const enrichment = enrichFromKnownIssues('test error');
            
            expect(enrichment).toHaveProperty('source');
            expect(enrichment).toHaveProperty('known_issues');
            expect(enrichment).toHaveProperty('external_signals');
            expect(enrichment).toHaveProperty('timestamp');
        });

        test('should handle network-related keywords', () => {
            const keywords = ['ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT', 'Connection refused'];
            
            keywords.forEach(keyword => {
                const enrichment = enrichFromKnownIssues(keyword);
                expect(enrichment.known_issues).toBeDefined();
            });
        });
    });

    describe('Classification Accuracy', () => {
        test('should achieve high accuracy on clear error patterns', () => {
            const testCases = [
                { logs: 'npm ERR! ERR!', expectedType: 'dependency_issue' },
                { logs: 'ECONNRESET', expectedType: 'env_issue' },
                { logs: 'AssertionError', expectedType: 'flaky_test' },
                { logs: '429 Too Many Requests', expectedType: 'rate_limit' },
                { logs: 'Permission denied', expectedType: 'permission_error' }
            ];

            testCases.forEach(testCase => {
                const result = heuristicClassification(testCase.logs);
                expect(result.type).toBe(testCase.expectedType);
            });
        });

        test('should assign confidence scores realistically', () => {
            const logs = 'npm ERR! 404 package not found';
            const result = heuristicClassification(logs);
            
            // Clear pattern should have decent confidence
            expect(result.confidence).toBeGreaterThan(0.7);
            expect(result.confidence).toBeLessThanOrEqual(0.95);
        });
    });

    describe('Error Type Coverage', () => {
        test('should recognize all 7 error types', () => {
            const testPatterns = {
                flaky_test: 'test random timeout',
                dependency_issue: 'npm ERR!',
                env_issue: 'ECONNRESET',
                timeout: 'request timeout',
                rate_limit: '429 Too Many',
                permission_error: 'Permission denied',
                code_error: 'SyntaxError'
            };

            Object.entries(testPatterns).forEach(([expectedType, pattern]) => {
                const result = heuristicClassification(pattern);
                expect(result.type).toBe(expectedType);
            });
        });
    });
});
