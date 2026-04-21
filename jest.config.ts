import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({ dir: './' })

const config: Config = {
  coverageProvider: 'v8',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/.next/',
    '<rootDir>/e2e/',
  ],
  modulePathIgnorePatterns: ['<rootDir>/.next/standalone/'],
  collectCoverageFrom: [
    'app/api/attendance/confirm/route.ts',
    'components/attendance/ConfirmAttendance.tsx',
    'lib/confirmationCode.ts',
    'lib/rateLimiter.ts',
    '!**/*.d.ts',
    '!**/node_modules/**',
  ],
  coverageThreshold: {
    global: {
      branches: 10,
      functions: 15,
      lines: 35,
      statements: 35,
    },
  },
}

export default createJestConfig(config)
