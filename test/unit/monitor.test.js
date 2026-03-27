const {
    trackExecution,
    getProjectMetrics,
    getSuccessRate,
    getRecentHistory,
    getPipelinePattern
} = require('../../services/monitor');

describe('Monitor Service - Analytics & Tracking', () => {
    beforeEach(() => {
        // Clear any previous state
        jest.clearAllMocks();
    });

    describe('trackExecution', () => {
        test('should track execution with all details', () => {
            const data = {
                status: 'resolved',
                errorType: 'flaky_test',
                action: 'retry',
                confidence: 0.92
            };

            trackExecution('pipeline-123', 'project-456', data);
            const metrics = getProjectMetrics('project-456');
            
            expect(metrics).toBeDefined();
            expect(metrics.total_failures).toBe(1);
        });

        test('should increment resolved counter on success', () => {
            const data1 = { status: 'resolved', errorType: 'flaky_test' };
            const data2 = { status: 'resolved', errorType: 'dependency_issue' };
            
            trackExecution('p1', 'proj-1', data1);
            trackExecution('p2', 'proj-1', data2);
            
            const metrics = getProjectMetrics('proj-1');
            expect(metrics.resolved_auto).toBe(2);
        });

        test('should track by error type', () => {
            const data = { status: 'resolved', errorType: 'flaky_test' };
            trackExecution('p1', 'proj-1', data);
            
            const metrics = getProjectMetrics('proj-1');
            expect(metrics.by_type.flaky_test).toBe(1);
        });

        test('should track different statuses', () => {
            trackExecution('p1', 'proj-1', { status: 'resolved' });
            trackExecution('p2', 'proj-1', { status: 'failed' });
            trackExecution('p3', 'proj-1', { status: 'manual_review' });
            
            const metrics = getProjectMetrics('proj-1');
            expect(metrics.total_failures).toBe(3);
            expect(metrics.resolved_auto).toBe(1);
            expect(metrics.failed_auto).toBe(1);
            expect(metrics.manual_reviews).toBe(1);
        });
    });

    describe('getProjectMetrics', () => {
        test('should return null for unknown project', () => {
            const metrics = getProjectMetrics('unknown-proj');
            expect(metrics).toBeNull();
        });

        test('should return complete metrics structure', () => {
            trackExecution('p1', 'proj-1', { status: 'resolved', errorType: 'flaky_test' });
            const metrics = getProjectMetrics('proj-1');
            
            expect(metrics).toHaveProperty('total_failures');
            expect(metrics).toHaveProperty('resolved_auto');
            expect(metrics).toHaveProperty('failed_auto');
            expect(metrics).toHaveProperty('manual_reviews');
            expect(metrics).toHaveProperty('by_type');
        });

        test('should accumulate metrics', () => {
            for (let i = 0; i < 5; i++) {
                trackExecution(`p${i}`, 'test-proj', { status: 'resolved', errorType: 'flaky_test' });
            }
            
            const metrics = getProjectMetrics('test-proj');
            expect(metrics.resolved_auto).toBe(5);
        });
    });

    describe('getSuccessRate', () => {
        test('should calculate success rate correctly', () => {
            trackExecution('p1', 'proj-2', { status: 'resolved' });
            trackExecution('p2', 'proj-2', { status: 'resolved' });
            trackExecution('p3', 'proj-2', { status: 'failed' });
            
            const rate = getSuccessRate('proj-2');
            expect(parseFloat(rate)).toBeCloseTo(66.67, 1);
        });

        test('should return 0 for unknown project', () => {
            const rate = getSuccessRate('unknown');
            expect(rate).toBe(0);
        });

        test('should handle 100% success rate', () => {
            trackExecution('p1', 'proj-3', { status: 'resolved' });
            trackExecution('p2', 'proj-3', { status: 'resolved' });
            
            const rate = getSuccessRate('proj-3');
            expect(rate).toBe('100.00');
        });

        test('should return percentage string', () => {
            trackExecution('p1', 'proj-4', { status: 'resolved' });
            const rate = getSuccessRate('proj-4');
            
            expect(typeof rate).toBe('string');
            expect(rate).toMatch(/\d+\.\d{2}/); // Format: XX.XX
        });
    });

    describe('getRecentHistory', () => {
        test('should return recent executions', () => {
            trackExecution('p1', 'proj-5', { status: 'resolved' });
            trackExecution('p2', 'proj-5', { status: 'failed' });
            trackExecution('p3', 'proj-5', { status: 'resolved' });
            
            const history = getRecentHistory('p3', 10);
            expect(Array.isArray(history)).toBe(true);
        });

        test('should limit results by count', () => {
            for (let i = 0; i < 20; i++) {
                trackExecution(`p${i}`, 'proj-6', { status: 'resolved' });
            }
            
            const history = getRecentHistory('proj-6', 5);
            expect(history.length).toBeLessThanOrEqual(5);
        });

        test('should include timestamp in history', () => {
            trackExecution('p1', 'proj-7', { status: 'resolved' });
            const history = getRecentHistory('p1');
            
            expect(history[0]).toHaveProperty('timestamp');
        });

        test('should return empty array for unknown execution', () => {
            const history = getRecentHistory('unknown-pipeline');
            expect(Array.isArray(history)).toBe(true);
        });
    });

    describe('getPipelinePattern', () => {
        test('should identify error patterns in project', () => {
            trackExecution('p1', 'proj-8', { status: 'resolved', errorType: 'flaky_test' });
            trackExecution('p2', 'proj-8', { status: 'resolved', errorType: 'flaky_test' });
            trackExecution('p3', 'proj-8', { status: 'resolved', errorType: 'dependency_issue' });
            
            const patterns = getPipelinePattern('proj-8');
            expect(patterns.flaky_test).toBe(2);
            expect(patterns.dependency_issue).toBe(1);
        });

        test('should identify most common error type', () => {
            for (let i = 0; i < 10; i++) {
                trackExecution(`p${i}`, 'proj-9', { status: 'resolved', errorType: 'flaky_test' });
            }
            for (let i = 10; i < 12; i++) {
                trackExecution(`p${i}`, 'proj-9', { status: 'resolved', errorType: 'env_issue' });
            }
            
            const patterns = getPipelinePattern('proj-9');
            expect(patterns.flaky_test).toBe(10);
            expect(patterns.env_issue).toBe(2);
        });

        test('should return empty object for new project', () => {
            const patterns = getPipelinePattern('brand-new-proj');
            expect(typeof patterns).toBe('object');
        });
    });

    describe('Real-World Analytics Scenarios', () => {
        test('should track project with mixed outcomes', () => {
            const outcomes = [
                { status: 'resolved', errorType: 'flaky_test' },
                { status: 'resolved', errorType: 'flaky_test' },
                { status: 'failed', errorType: 'dependency_issue' },
                { status: 'resolved', errorType: 'env_issue' },
                { status: 'manual_review', errorType: 'code_error' }
            ];

            outcomes.forEach((outcome, idx) => {
                trackExecution(`pipeline-${idx}`, 'real-proj', outcome);
            });

            const metrics = getProjectMetrics('real-proj');
            expect(metrics.total_failures).toBe(5);
            expect(metrics.resolved_auto).toBe(3);
            expect(metrics.failed_auto).toBe(1);
            expect(metrics.manual_reviews).toBe(1);
        });

        test('should track high-volume project', () => {
            for (let i = 0; i < 100; i++) {
                const errorType = i % 2 === 0 ? 'flaky_test' : 'env_issue';
                const status = i % 3 === 0 ? 'failed' : 'resolved';
                trackExecution(`p${i}`, 'high-volume', { status, errorType });
            }

            const metrics = getProjectMetrics('high-volume');
            const rate = getSuccessRate('high-volume');
            
            expect(metrics.total_failures).toBe(100);
            expect(parseFloat(rate)).toBeGreaterThan(0);
            expect(parseFloat(rate)).toBeLessThanOrEqual(100);
        });
    });
});
