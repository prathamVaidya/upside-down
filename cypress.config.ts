import { defineConfig } from 'cypress'
import { makeTasks } from './e2e/tasks.ts'

/**
 * Browser tests run against the *built* app served by the real Bun server, not
 * the Vite dev server. The production artefact and the production routing are
 * part of what is being tested — `/stage` serving the phone was a real bug once,
 * and it would not have shown up against a dev server with different routing.
 *
 * Start the server yourself, or use `bun run e2e`, which does it for you:
 *
 *   UD_E2E=1 PORT=3100 bun apps/server/src/index.ts
 */
const PORT = Number(process.env.UD_E2E_PORT ?? 3100)

export default defineConfig({
  e2e: {
    baseUrl: `http://localhost:${PORT}`,
    specPattern: 'e2e/specs/**/*.cy.ts',
    supportFile: 'e2e/support/e2e.ts',
    fixturesFolder: false,
    screenshotOnRunFailure: true,
    video: false,
    // A phone, because that is what most of these tests are pretending to be.
    // The stage spec resizes itself.
    viewportWidth: 390,
    viewportHeight: 844,
    // Phases are on server clocks; a slow CI box should not fail a spec that is
    // simply waiting for a reveal to finish.
    defaultCommandTimeout: 15_000,
    retries: { runMode: 1, openMode: 0 },
    setupNodeEvents(on, config) {
      on('task', makeTasks(`ws://localhost:${PORT}/ws`))
      return config
    },
  },
})
