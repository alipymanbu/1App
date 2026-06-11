import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve('src/shared'),
      '@renderer': resolve('src/renderer/src')
    }
  },
  test: {
    globals: true,
    testTimeout: 15000,
    include: ['tests/unit/main/**/*.test.ts', 'tests/unit/platforms/**/*.test.ts'],
    setupFiles: ['tests/setup/node.ts'],
    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage/main',
      include: [
        'src/main/**/*.ts',
        'src/preload/**/*.ts',
        'src/shared/**/*.ts'
      ],
      exclude: [
        'src/main/index.ts',
        'src/main/settings.ts',
        'src/main/platforms/**',
        'src/shared/types.ts'
      ],
      reporter: ['text', 'lcov', 'html'],
      thresholds: {
        statements: 0,
        branches: 0,
        functions: 0,
        lines: 0
      }
    }
  }
})
