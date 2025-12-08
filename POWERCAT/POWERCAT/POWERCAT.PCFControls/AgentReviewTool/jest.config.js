/** @type {import('jest').Config} */
module.exports = {
  // Use ts-jest for TypeScript support
  preset: 'ts-jest',
  
  // Test environment for DOM testing
  testEnvironment: 'jsdom',
  
  // Root directories
  roots: ['<rootDir>/CopilotStudioAgentOptimizer'],
  
  // Test file patterns
  testMatch: [
    '**/__tests__/**/*.test.ts?(x)',
    '**/__tests__/**/*.spec.ts?(x)',
    '**/?(*.)+(spec|test).ts?(x)'
  ],
  
  // Module path mappings (align with tsconfig paths if any)
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '^@/(.*)$': '<rootDir>/CopilotStudioAgentOptimizer/$1'
  },
  
  // Setup files to run after test environment setup
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  
  // Transform files with ts-jest
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        jsx: 'react',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        moduleResolution: 'node',
        resolveJsonModule: true
      }
    }]
  },
  
  // Files to collect coverage from
  collectCoverageFrom: [
    'CopilotStudioAgentOptimizer/**/*.{ts,tsx}',
    '!CopilotStudioAgentOptimizer/**/*.d.ts',
    '!CopilotStudioAgentOptimizer/generated/**',
    '!CopilotStudioAgentOptimizer/__tests__/**',
    '!CopilotStudioAgentOptimizer/index.ts',
    '!**/*.config.{js,ts}',
    '!**/node_modules/**'
  ],
  
  // Coverage thresholds
  coverageThreshold: {
    global: {
      lines: 80,
      branches: 75,
      functions: 80,
      statements: 80
    }
  },
  
  // Coverage reporters
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  
  // Coverage directory
  coverageDirectory: '<rootDir>/coverage',
  
  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  
  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/out/',
    '/obj/',
    '\\.generated\\.',
    '/CopilotStudioAgentOptimizer/__tests__/fixtures/'
  ],
  
  // Verbose output
  verbose: true,
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Restore mocks between tests
  restoreMocks: true,
  
  // Maximum number of concurrent workers
  maxWorkers: '50%'
};
