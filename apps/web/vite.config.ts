import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import { defineConfig } from 'vite'

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url))

/**
 * Make the dev server route exactly like the Bun server does.
 *
 * Vite's default SPA fallback hands the *same* app to every unmatched path, so
 * without this `/stage` quietly serves the phone and the two surfaces look
 * identical. Development and production must agree on what lives at which URL,
 * or you debug the wrong screen.
 */
function routes(): Plugin {
  return {
    name: 'ud-routes',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const path = (req.url ?? '/').split('?')[0] ?? '/'
        // The television.
        if (path === '/stage' || path === '/stage/') req.url = '/stage/index.html'
        // The QR-code deep link: the phone, with the code pre-filled.
        else if (/^\/r\/[A-Za-z]{4}\/?$/.test(path)) req.url = '/index.html'
        next()
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), routes()],
  resolve: {
    alias: {
      '@ud/protocol': r('../../packages/protocol/src/index.ts'),
      '@ud/clay': r('../../packages/clay/src/index.ts'),
      '@ud/net': r('../../packages/net/src/index.ts'),
    },
  },
  server: {
    port: 5173,
    // The Bun server holds the rooms; Vite only serves the client.
    proxy: { '/ws': { target: 'ws://localhost:3000', ws: true } },
  },
  build: {
    outDir: r('../server/public'),
    emptyOutDir: true,
    rollupOptions: {
      // Two documents, one bundle graph. Each surface gets its own <head> — the
      // phone needs `maximum-scale=1` so iOS does not zoom when the keyboard
      // opens, which would be wrong on a television — while React and the clay
      // system are emitted once and shared between them.
      input: {
        phone: r('./index.html'),
        stage: r('./stage/index.html'),
      },
    },
  },
})
