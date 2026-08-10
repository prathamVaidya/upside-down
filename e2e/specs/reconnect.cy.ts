/**
 * "You dropped. the game kept going. your seat is safe."
 *
 * Mockup 2m treats losing the connection as a normal state rather than an
 * error, and a party is exactly where it happens — somebody locks their phone,
 * walks into the kitchen, takes a call. The seat token in `sessionStorage` is
 * what makes the promise true, so it is worth proving in a real browser rather
 * than only over a socket.
 */
describe('dropping and coming back', () => {
  it('puts you back in the same seat after a reload', () => {
    cy.task<string>('room:open').then((code) => {
      cy.task('room:watch', code)
      cy.visit(`/r/${code}`)
      cy.joinRoom(code, 'Cypress')
      cy.task('bots:seat', { code, count: 3 })
      cy.get('[data-testid="start"]').click()
      cy.phase('writing')

      cy.get('[data-testid="answer"]').type('written before the reload')
      cy.get('[data-testid="submit"]').click()

      // A reload is the bluntest version of dropping: the socket dies and the
      // page starts from nothing but what it kept in storage.
      cy.reload()

      // Straight back into the game without retyping a code. The phone does not
      // show you your own name mid-round — it is a remote control, not a
      // profile — so "am I still me" is a question for the server.
      cy.get('body', { timeout: 30_000 }).should(($body) => {
        expect($body.attr('data-phase'), 'back in the game, not on the join screen').to.not.equal(
          'join',
        )
      })

      cy.roomViewUntil(
        code,
        (v) => v.seats.some((s) => s.name === 'Cypress' && s.connected),
        'the server to see us back on our seat',
      ).then((v) => {
        // One seat, not a second one created by the reload.
        expect(v.seats.filter((s) => s.name === 'Cypress')).to.have.length(1)
      })
    })
  })

  it('keeps the score you had before you dropped', () => {
    cy.task<string>('room:open').then((code) => {
      cy.task('room:watch', code)
      cy.visit(`/r/${code}`)
      cy.joinRoom(code, 'Cypress')
      cy.task('bots:seat', { code, count: 3 })
      cy.get('[data-testid="start"]').click()

      // Mid-game, not after it. Dropping once the winner is up proves nothing —
      // the interesting case is walking out of the room with points banked and
      // a round still to play.
      cy.playUntil('scoreboard')

      cy.roomView(code).then((v) => {
        const before = v.seats.find((s) => s.name === 'Cypress')!.score
        expect(before, 'scored something in round one').to.be.greaterThan(0)

        cy.reload()

        cy.roomViewUntil(
          code,
          (after) => after.seats.some((s) => s.name === 'Cypress' && s.connected),
          'our seat to come back',
        ).then((after) => {
          const now = after.seats.find((s) => s.name === 'Cypress')!.score
          expect(now, 'score survived the reload').to.equal(before)
        })
      })
    })
  })

  it('sends you back to the join screen if the room is gone', () => {
    cy.task<string>('room:open').then((code) => {
      cy.visit(`/r/${code}`)
      cy.joinRoom(code, 'Cypress')

      // Pretend we are holding a seat token for a room that no longer exists —
      // exactly what a phone left open overnight would have.
      cy.window().then((win) => {
        win.sessionStorage.setItem('ud.seat.ZZZZ', 'dead-token-that-is-long-enough')
        win.localStorage.setItem('ud.code', 'ZZZZ')
      })
      cy.reload()

      // Calm, and back to something you can act on — not an error page.
      cy.phase('join')
      cy.get('[data-testid="code-input"]').should('exist')
    })
  })

  it('lets the television reattach to its own room on refresh', () => {
    cy.viewport(1280, 800)
    cy.visit('/stage')
    cy.stagePhase('lobby')

    cy.readRoomCode().then((code) => {
      cy.task('bots:seat', { code, count: 3 })
      cy.contains('Priya').should('be.visible')

      // Somebody bumps the laptop. The code must not change — people have
      // already typed it into their phones.
      cy.reload()
      cy.stagePhase('lobby')
      cy.readRoomCode().should('equal', code)
      cy.contains('Priya').should('be.visible')
    })
  })
})
