module.exports = {
    testEnvironment: 'node',
    collectCoverageFrom: [
        'services/**/*.js',
        'utils/**/*.js',
        'config/**/*.js',
        '!**/node_modules/**',
    ],
    coverageThreshold: {
        global: {
            branches: 70,
            functions: 75,
            lines: 75,
            statements: 75
        }
    },
    testMatch: [
        '**/test/**/*.test.js'
    ],
    transformIgnorePatterns: [
        'node_modules/(?!(chalk|ansi-styles|supports-color)/)'
    ],
    verbose: true,
    testTimeout: 10000
};
