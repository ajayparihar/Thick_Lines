/**
 * ================================================================================
 * JEST TESTING CONFIGURATION
 * ================================================================================
 * 
 * Comprehensive testing setup for the Thick Lines drawing application.
 * Configured for testing HTML5 Canvas applications with DOM manipulation,
 * event handling, and complex UI interactions.
 * 
 * TESTING ENVIRONMENT:
 * - jsdom: Simulates browser environment for DOM testing
 * - Canvas API mocking for graphics operations testing
 * - Event system simulation for interaction testing
 * - Memory management and cleanup validation
 * 
 * COVERAGE STRATEGY:
 * - Focused on main application file (app.js)
 * - Excludes test files and dependencies from coverage
 * - Multiple report formats for different stakeholders
 * 
 * PERFORMANCE CONSIDERATIONS:
 * - Extended timeout (10s) for complex canvas operations
 * - Proper cleanup between tests to prevent memory leaks
 * - Efficient mocking to avoid unnecessary computation
 */

module.exports = {
  // TEST ENVIRONMENT CONFIGURATION
  // jsdom provides a DOM implementation for Node.js testing
  // Essential for testing Canvas API and DOM manipulation
  testEnvironment: 'jsdom',
  
  // SETUP CONFIGURATION
  // Runs after the test framework is installed in the environment
  // Contains comprehensive mocks for Canvas API and DOM elements
  setupFilesAfterEnv: ['<rootDir>/test/setup.js'],
  
  // TEST FILE DISCOVERY
  // Matches all test files in the test directory structure
  // Supports both .test.js and .spec.js naming conventions
  testMatch: [
    '<rootDir>/test/**/*.test.js',  // Standard test files
    '<rootDir>/test/**/*.spec.js'  // Specification test files
  ],
  
  // CODE COVERAGE COLLECTION
  // Analyzes code coverage for main application file only
  // Excludes dependencies and test files from coverage metrics
  collectCoverageFrom: [
    'app.js',              // Main application file
    '!**/node_modules/**', // Exclude external dependencies
    '!**/test/**'          // Exclude test files themselves
  ],
  
  // COVERAGE OUTPUT CONFIGURATION
  // Generates coverage reports in multiple formats
  coverageDirectory: 'coverage',  // Output directory for coverage reports
  
  // COVERAGE REPORT FORMATS
  // Multiple formats serve different purposes:
  // - text: Console output for CI/CD pipelines
  // - lcov: Industry standard format for CI integration
  // - html: Interactive browser-based coverage exploration
  coverageReporters: [
    'text',  // Terminal/console output
    'lcov',  // LCOV format for CI/CD integration
    'html'   // Interactive HTML reports
  ],
  
  // MODULE NAME MAPPING
  // Maps CSS imports to identity-obj-proxy for style testing
  // Prevents CSS import errors in the Node.js test environment
  moduleNameMapper: {
    '\\.(css|less|scss)$': 'identity-obj-proxy'  // Mock CSS imports
  },
  
  // GLOBAL BROWSER API AVAILABILITY
  // Makes browser APIs available in the Node.js test environment
  // Required for testing Canvas-based applications
  globals: {
    'window': true,                    // Window object for DOM testing
    'document': true,                  // Document object for DOM manipulation
    'navigator': true,                 // Navigator object for feature detection
    'HTMLElement': true,               // HTML element constructors
    'HTMLCanvasElement': true,         // Canvas element for drawing tests
    'CanvasRenderingContext2D': true   // 2D context for graphics testing
  },
  
  // PERFORMANCE AND TIMEOUT SETTINGS
  // Extended timeout accommodates complex Canvas operations and animations
  // Prevents test failures due to legitimate processing time
  testTimeout: 10000,  // 10 second timeout for complex operations
  
  // VERBOSE OUTPUT
  // Provides detailed test execution information
  // Helpful for debugging test failures and performance analysis
  verbose: true  // Detailed test output
};
