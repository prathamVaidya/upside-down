import './commands.ts'

/**
 * Every spec starts with an empty browser and ends with every bot socket shut.
 *
 * Seat tokens live in `sessionStorage` and the stage remembers its room code in
 * `localStorage` — both are load-bearing (they are what makes reconnection
 * work), so a test that inherits them from the previous spec is testing the
 * wrong thing.
 */
beforeEach(() => {
  cy.clearLocalStorage()
  cy.window().then((win) => win.sessionStorage.clear())
})

afterEach(() => {
  cy.task('room:close')
})

// A dropped WebSocket during teardown is not a test failure — the client is
// supposed to survive that, and it has its own spec.
Cypress.on('uncaught:exception', (err) => {
  if (/WebSocket|socket/i.test(err.message)) return false
  return true
})
