module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/test/setup.js'],
  testMatch: [
    '<rootDir>/test/**/*.test.js',
    '<rootDir>/test/**/*.spec.js'
  ],
  collectCoverageFrom: [
    'app.js',
    '!**/node_modules/**',
    '!**/test/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'lcov',
    'html'
  ],
  moduleNameMapper: {
    '\\.(css|less|scss)$': 'identity-obj-proxy'
  },
  globals: {
    'window': true,
    'document': true,
    'navigator': true,
    'HTMLElement': true,
    'HTMLCanvasElement': true,
    'CanvasRenderingContext2D': true
  },
  testTimeout: 10000,
  verbose: true
};
