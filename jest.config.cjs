module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
  // Skip tests that require ESM (import.meta.url) or ink-testing-library
  // The .tsx tests use ink-testing-library which requires ESM
  testPathIgnorePatterns: [
    '/node_modules/',
    'grid/',  // Uses vitest, not Jest
    'tests/unit/cli/ui/components.test.tsx',
    'tests/unit/cli/ui/charts.test.tsx',
    'tests/unit/cli/ui/views.test.tsx',
    'tests/unit/core/config/config.test.ts',
    'tests/unit/core/config/profile-precedence.test.ts',
    'tests/unit/sdk/ws/client.test.ts',
    'tests/unit/sdk/ws/trading-gateway.test.ts',
  ],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        jsx: 'react-jsx',
        module: 'CommonJS',
        moduleResolution: 'node',
        esModuleInterop: true,
        target: 'ES2022',
      },
    }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  maxWorkers: 1,
  testTimeout: 30000,
  forceExit: true,
  // Coverage focuses on the persistence layer, which backs daemon config
  // durability. Add strategy paths here as strategies gain test suites.
  collectCoverageFrom: [
    'src/core/persistence/**/*.ts',
    '!**/*.d.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 78,
      functions: 89,
      lines: 85,
      statements: 85,
    },
  },
  coverageReporters: ['text', 'text-summary', 'lcov', 'html'],
};

