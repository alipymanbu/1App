import { resolve } from 'path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  oxc: false,
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': resolve('src/shared'),
      '@renderer': resolve('src/renderer/src')
    }
  },
  test: {
    name: 'renderer',
    globals: true,
    environment: 'jsdom',
    include: ['tests/unit/renderer/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/setup/renderer.ts'],
    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage/renderer',
      include: ['src/renderer/src/**/*.{ts,tsx}'],
      exclude: ['src/renderer/src/main.tsx', 'src/renderer/src/styles/**'],
      reporter: ['text', 'lcov', 'html'],
      thresholds: {
        statements: 75,
        branches: 65,
        functions: 80,
        lines: 78
      }
    }
  }
})
