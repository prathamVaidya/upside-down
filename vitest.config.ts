import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url))

export default defineConfig({
  // No react plugin here on purpose: Fast Refresh is a dev-server concern, and
  // pulling it in drags a second copy of Vite into the test runner. esbuild's
  // automatic JSX is all these render tests need.
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: {
      '@ud/protocol/validate': r('./packages/protocol/src/validate.ts'),
      '@ud/protocol': r('./packages/protocol/src/index.ts'),
      '@ud/engine': r('./packages/engine/src/index.ts'),
      '@ud/content': r('./packages/content/src/index.ts'),
      '@ud/clay': r('./packages/clay/src/index.ts'),
      '@ud/net': r('./packages/net/src/index.ts'),
    },
  },
  test: {
    include: [
      'packages/*/test/**/*.test.{ts,tsx}',
      'packages/*/src/**/*.test.{ts,tsx}',
      'apps/*/test/**/*.test.{ts,tsx}',
    ],
  },
})
