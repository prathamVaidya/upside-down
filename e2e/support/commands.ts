/// <reference types="cypress" />

/**
 * Commands for driving a party game from one browser.
 *
 * The recurring problem is that phases advance on a *server* clock, so a test
 * cannot know which screen it will be looking at when it gets there. Bots
 * answer instantly, so by the time Cypress has typed one answer the room may
 * already be voting. Everything below is written to cope with arriving at a
 * phase late rather than assuming a fixed sequence.
 */

/** The slice of `ClientView` the specs actually assert on. */
export type RoomView = {
  code: string
  round: number
  roundCount: number
  phase: {
    name: string
    rows?: { name: string; score: number }[]
    championName?: string
    championScore?: number
  }
  seats: { id: string; name: string; kind: string; score: number; connected: boolean }[]
}

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * The room as the *server* sees it.
       *
       * Some guarantees cannot be checked from the DOM — that a seat survived a
       * reload with its score, that nobody's client reported an error — so the
       * specs read server truth through a headless watcher rather than
       * inferring it from pixels.
       */
      roomView(code: string): Chainable<RoomView>
      /**
       * Poll the server's view until `predicate` holds.
       *
       * `cy.task` does not retry the way `cy.get` does, so a one-shot read can
       * land in the gap between an action and the broadcast that reflects it —
       * a reconnect in particular is two round trips, and reading between them
       * sees a seat that is briefly still disconnected.
       */
      roomViewUntil(
        code: string,
        predicate: (view: RoomView) => boolean,
        label?: string,
      ): Chainable<RoomView>
      /** Play until a given phase is on screen, acting on whatever comes up. */
      playUntil(phase: string, options?: { maxSteps?: number }): Chainable<void>
      /** Wait for the phone to be on a given phase (via `body[data-phase]`). */
      phase(name: string, options?: { timeout?: number }): Chainable<void>
      /** Wait for the stage to be on a given phase. */
      stagePhase(name: string, options?: { timeout?: number }): Chainable<void>
      /** Join a room through the real join screen. */
      joinRoom(code: string, name: string): Chainable<void>
      /** Read the four-letter code off the television. */
      readRoomCode(): Chainable<string>
      /**
       * Play whatever screen is in front of us until the game ends: write when
       * asked, vote when offered, wait when sitting out.
       */
      playUntilGameOver(options?: { maxSteps?: number }): Chainable<void>
    }
  }
}

const PHASE_TIMEOUT = 30_000

Cypress.Commands.add('phase', (name: string, options = {}) => {
  cy.get('body', { timeout: options.timeout ?? PHASE_TIMEOUT }).should(
    'have.attr',
    'data-phase',
    name,
  )
})

Cypress.Commands.add('stagePhase', (name: string, options = {}) => {
  // Not `.stage`: the winner screen reuses that class for a full-bleed overlay
  // inside the root, so the selector would match two elements and error.
  cy.get('[data-testid="stage"]', { timeout: options.timeout ?? PHASE_TIMEOUT }).should(
    'have.attr',
    'data-phase',
    name,
  )
})

Cypress.Commands.add('roomView', (code: string) => {
  return cy.task<RoomView | null>('room:view', code).then((view) => {
    expect(view, 'a headless stage is watching this room — call cy.task("room:watch") first').to.not
      .be.null
    return view as RoomView
  })
})

Cypress.Commands.add(
  'roomViewUntil',
  (code: string, predicate: (view: RoomView) => boolean, label = 'the room to catch up') => {
    const poll = (remaining: number): Cypress.Chainable<RoomView> =>
      cy.task<RoomView | null>('room:view', code).then((view) => {
        if (view && predicate(view)) return cy.wrap(view, { log: false })
        if (remaining <= 1) {
          throw new Error(`timed out waiting for ${label}`)
        }
        cy.wait(200, { log: false })
        return poll(remaining - 1)
      })
    return poll(50)
  },
)

Cypress.Commands.add('readRoomCode', () => {
  return cy
    .get('[data-testid="room-code"]', { timeout: PHASE_TIMEOUT })
    .invoke('text')
    .then((text) => text.trim().toUpperCase())
})

Cypress.Commands.add('joinRoom', (code: string, name: string) => {
  cy.get('[data-testid="code-input"]').clear().type(code)
  cy.get('[data-testid="name-input"]').clear().type(name)
  cy.get('[data-testid="join"]').click()

  // Seated, not necessarily in a lobby. Someone joining mid-game lands as
  // audience on whatever phase the room is already on, and the whole point of
  // that path is that they are never turned away.
  cy.get('body', { timeout: PHASE_TIMEOUT }).should(($body) => {
    expect($body.attr('data-phase'), 'took a seat').to.not.equal('join')
  })
})

/**
 * One step of play, chosen from whatever is on screen.
 *
 * Written as recursion rather than a loop because Cypress commands are queued,
 * not awaited — a `for` loop would enqueue every iteration up front and decide
 * what to do before the previous step had happened.
 */
const IDLE_MS = 120

function step(remaining: number, target: string): void {
  if (remaining <= 0) throw new Error(`gave up before reaching "${target}"`)

  cy.get('body').then(($body) => {
    const phase = $body.attr('data-phase')
    if (phase === target || phase === 'winner') return

    // Every screen either offers something to press or does not. There is no
    // third case — but there are plenty of screens with nothing to press
    // (reveals, scoreboards, sitting out your own matchup), and burning through
    // the step budget on those is how this loop originally failed. So a step
    // that does not act must wait.
    let acted = false

    if (phase === 'writing' && $body.find('[data-testid="answer"]').length > 0) {
      cy.get('[data-testid="answer"]').type(`cypress answer ${remaining}`)
      cy.get('[data-testid="submit"]').click()
      acted = true
    } else if (phase === 'voting' && $body.find('[data-testid="choice-a"]:not(:disabled)').length) {
      cy.get('[data-testid="choice-a"]').click()
      acted = true
    } else if (
      phase === 'finaleVoting' &&
      $body.find('[data-testid="vote-plus"]:not(:disabled)').length > 0
    ) {
      cy.get('[data-testid="vote-plus"]:not(:disabled)').first().click()
      acted = true
    }

    if (!acted) cy.wait(IDLE_MS)
    step(remaining - 1, target)
  })
}

Cypress.Commands.add('playUntil', (phase: string, options = {}) => {
  step(options.maxSteps ?? 300, phase)
})

Cypress.Commands.add('playUntilGameOver', (options = {}) => {
  step(options.maxSteps ?? 300, 'winner')
  cy.phase('winner', { timeout: 90_000 })
})
