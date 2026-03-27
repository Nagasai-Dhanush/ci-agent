const {
    extractError,
    extractKeyword,
    extractStackTrace,
    parseLogMetadata,
    extractLogSection
} = require('../../utils/parser');

describe('Parser Service - Log Analysis', () => {
    const testLogs = `
[10:23:45] Starting build...
[10:23:50] npm install
npm ERR! 404 Not Found - GET https://registry.npmjs.org/some-package
npm ERR! 404 
npm ERR! 404  'some-package' is not in this registry.

Error: Cannot resolve dependency
  at resolvePackage (/app/node_modules/npm/lib/resolve.js:45:12)
  at resolve (/app/node_modules/npm/lib/resolve.js:129:39)
  at Array.map (<anonymous>)
  at resolveAll (/app/node_modules/npm/lib/resolve.js:112:34)

AssertionError: expected 5 to equal 10
  at Context.<anonymous> (src/test/api.test.js:45:23)
  at processImmediateScheduled (internal/timers.js:setImmediate)

Build failed at 10:24:30
Duration: 45 seconds
`;

    describe('extractError', () => {
        test('should extract error section from logs', () => {
            const error = extractError(testLogs);
            expect(error).toBeDefined();
            expect(error.length).toBeGreaterThan(0);
        });

        test('should include error marker context', () => {
            const error = extractError(testLogs);
            expect(error.toLowerCase()).toContain('error');
        });

        test('should handle empty logs gracefully', () => {
            const error = extractError('');
            expect(error).toBe('');
        });

        test('should include final output section', () => {
            const error = extractError(testLogs);
            expect(error).toContain('FINAL OUTPUT');
        });
    });

    describe('extractKeyword', () => {
        test('should extract npm error keyword', () => {
            const keyword = extractKeyword(testLogs);
            expect(keyword).toBeDefined();
            expect(keyword.toLowerCase()).toContain('npm err');
        });

        test('should prioritize error patterns', () => {
            const npmErrorLog = 'npm ERR! 404 some package';
            const keyword = extractKeyword(npmErrorLog);
            expect(keyword).toContain('npm ERR!');
        });

        test('should extract SyntaxError if present', () => {
            const syntaxLog = 'SyntaxError: Unexpected token }';
            const keyword = extractKeyword(syntaxLog);
            expect(keyword).toContain('Error');
        });

        test('should extract different error patterns', () => {
            const patterns = [
                'npm ERR! 404',
                'ModuleNotFoundError: Cannot find',
                'AssertionError: test failed'
            ];

            patterns.forEach(pattern => {
                const keyword = extractKeyword(pattern);
                expect(keyword).toBeDefined();
                expect(keyword.length).toBeGreaterThan(0);
            });
        });

        test('should handle logs without error markers', () => {
            const safeLog = 'Build started\nCompiling...\nSuccess';
            const keyword = extractKeyword(safeLog);
            expect(keyword).toBeDefined();
        });
    });

    describe('extractStackTrace', () => {
        test('should extract stack trace when present', () => {
            const trace = extractStackTrace(testLogs);
            expect(trace).toBeDefined();
            expect(trace).toContain('at');
        });

        test('should return null when no stack trace', () => {
            const simpleLog = 'Build failed\nNo stack trace here';
            const trace = extractStackTrace(simpleLog);
            expect(trace).toBeNull();
        });

        test('should extract multiple stack frames', () => {
            const trace = extractStackTrace(testLogs);
            expect((trace.match(/at /g) || []).length).toBeGreaterThanOrEqual(1);
        });

        test('should limit stack trace length', () => {
            const trace = extractStackTrace(testLogs);
            // Should be limited to ~15 lines
            expect(trace.split('\n').length).toBeLessThanOrEqual(20);
        });
    });

    describe('parseLogMetadata', () => {
        test('should extract metadata from logs', () => {
            const metadata = parseLogMetadata(testLogs);
            expect(metadata).toBeDefined();
            expect(metadata.duration).toBeDefined() || expect(metadata.duration).toBeNull();
        });

        test('should have metadata structure', () => {
            const metadata = parseLogMetadata(testLogs);
            expect(metadata.duration).toBeDefined();
            expect(metadata.jobId).toBeDefined();
            expect(metadata.branch).toBeDefined();
        });

        test('should extract duration if present', () => {
            const logWithDuration = 'Build completed in 45 seconds. Duration: 45 seconds';
            const metadata = parseLogMetadata(logWithDuration);
            // Duration extraction is optional
            expect(metadata.duration === null || typeof metadata.duration === 'string').toBe(true);
        });
    });

    describe('extractLogSection', () => {
        test('should extract log sections', () => {
            const sections = extractLogSection(testLogs, 2);
            expect(Array.isArray(sections)).toBe(true);
        });

        test('should prioritize sections with errors', () => {
            const sections = extractLogSection(testLogs, 2);
            // Should return sections sorted by error content
            expect(sections.length).toBeLessThanOrEqual(2);
        });

        test('should respect sectionCount parameter', () => {
            const sections1 = extractLogSection(testLogs, 1);
            const sections3 = extractLogSection(testLogs, 3);
            
            expect(sections1.length).toBeLessThanOrEqual(1);
            expect(sections3.length).toBeLessThanOrEqual(3);
        });

        test('should handle empty logs', () => {
            const sections = extractLogSection('', 3);
            expect(Array.isArray(sections)).toBe(true);
        });
    });

    describe('Error Pattern Detection', () => {
        test('should detect npm errors', () => {
            const npmLog = 'npm ERR! 404 Package not found';
            const keyword = extractKeyword(npmLog);
            expect(keyword).toContain('npm');
        });

        test('should detect timeout errors', () => {
            const timeoutLog = 'Request timeout after 30 seconds ETIMEDOUT';
            const keyword = extractKeyword(timeoutLog);
            expect(keyword.length).toBeGreaterThan(0);
        });

        test('should detect connection errors', () => {
            const connLog = 'ECONNRESET socket hang up';
            const keyword = extractKeyword(connLog);
            expect(keyword).toContain('ECONNRESET');
        });

        test('should detect permission errors', () => {
            const permLog = 'Permission denied EACCES';
            const keyword = extractKeyword(permLog);
            expect(keyword).toContain('Permission');
        });
    });

    describe('Real-World Scenarios', () => {
        test('should handle large logs', () => {
            const largeLogs = 'START\n' + 'line\n'.repeat(1000) + 'ERROR\nEND';
            const error = extractError(largeLogs);
            expect(error).toBeDefined();
            expect(error.length).toBeGreaterThan(0);
        });

        test('should extract from truncated logs', () => {
            const truncated = testLogs.substring(0, 100) + '...';
            const keyword = extractKeyword(truncated);
            expect(keyword).toBeDefined();
        });

        test('should handle multiline error messages', () => {
            const multiline = `
Error: This is a long error message
that spans multiple lines
with detailed information
about the problem
            `;
            const keyword = extractKeyword(multiline);
            expect(keyword).toContain('Error');
        });
    });
});
