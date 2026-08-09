import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@ud/protocol': r('../../packages/protocol/src/index.ts'),
      '@ud/clay': r('../../packages/clay/src/index.ts'),
      '@ud/net': r('../../packages/net/src/index.ts'),
    },
  },
  server: {
    proxy: { '/ws': { target: 'ws://localhost:3000', ws: true } },
  },
  build: {
    outDir: r('../server/public/phone'),
    emptyOutDir: true,
  },
})
