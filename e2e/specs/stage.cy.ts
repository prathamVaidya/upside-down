/**
 * The television, in a browser the size of one.
 *
 * The stage takes no input at all, so these are observation tests: the room
 * code has to be readable, players have to appear as they arrive, and every
 * phase has to render something rather than going blank.
 */
describe('the stage', () => {
  beforeEach(() => {
    // A laptop lid flipped round, roughly. Deliberately not 16:9 — the brief
    // says not to assume it.
    cy.viewport(1280, 800)
  })

  it('shows a room code and fills with players as they arrive', () => {
    cy.visit('/stage')
    cy.stagePhase('lobby')

    cy.readRoomCode().then((code) => {
      expect(code).to.match(/^[A-Z]{4}$/)

      cy.contains('and type it in').should('be.visible')
      cy.contains(/of 3 needed/).should('be.visible')

      // The other way in. It has to carry this room's code, or it is a
      // picture of a link to somebody else's game.
      cy.get('svg[role="img"]')
        .filter(`[aria-label*="${code}"]`)
        .should('be.visible')
        .and('have.attr', 'aria-label', `scan to join room ${code}`)

      cy.task<string[]>('bots:seat', { code, count: 3 }).then((names) => {
        for (const name of names) cy.contains(name).should('be.visible')
        cy.contains(/the host can start/).should('be.visible')
      })
    })
  })

  it('walks the whole game without a blank screen', () => {
    cy.visit('/stage')
    cy.stagePhase('lobby')

    cy.readRoomCode().then((code) => {
      cy.task('bots:seat', { code, count: 4, thinkMs: 500 })
      cy.task('bots:start', code)

      // Waited for in order rather than polled. A poll loop deep enough to
      // cover a three-round game queues hundreds of Cypress commands and the
      // run slows to a crawl under its own log; a retrying wait per phase is
      // one command each and cannot miss a transition it is already watching
      // for.
      const arc = [
        'writing',
        'voting',
        'reveal',
        'scoreboard',
        'finaleVoting',
        'finaleReveal',
        'winner',
      ]

      for (const phase of arc) {
        cy.stagePhase(phase, { timeout: 60_000 })
        // Whatever it is showing, it is showing something. A blank television
        // mid-party is the failure this is really guarding against.
        cy.get('[data-testid="stage"]').should(($stage) => {
          expect($stage.text().trim(), `${phase} renders something`).to.not.equal('')
        })
      }

      cy.contains('is the funniest').should('be.visible')
    })
  })

  it('keeps eight finale answers on one screen', () => {
    cy.visit('/stage')
    cy.stagePhase('lobby')

    cy.readRoomCode().then((code) => {
      cy.task('bots:seat', { code, count: 8 })
      cy.task('bots:start', code)

      cy.stagePhase('finaleVoting', { timeout: 90_000 })
      cy.contains('THE FINALE').should('be.visible')

      cy.get('.finale-card').should('have.length', 8)
      // The hardest layout in the game: eight cards, and none of them may be
      // pushed off the bottom of the television.
      cy.get('.finale-card').each(($card) => {
        const rect = $card[0]!.getBoundingClientRect()
        expect(rect.bottom).to.be.at.most(Cypress.config('viewportHeight'))
        expect(rect.height).to.be.greaterThan(40)
      })
      // The television never scrolls — everything has to fit.
      cy.get('[data-testid="stage"]').should('have.css', 'overflow', 'hidden')
    })
  })

  it('never shows an author before the reveal', () => {
    cy.visit('/stage')
    cy.stagePhase('lobby')

    cy.readRoomCode().then((code) => {
      cy.task<string[]>('bots:seat', { code, count: 4, thinkMs: 500 }).then((names) => {
        cy.task('bots:start', code)
        cy.stagePhase('voting', { timeout: 60_000 })

        // Both answers are up. Neither is attributed, and the screen says so.
        cy.contains('authors hidden until reveal').should('be.visible')
        cy.get('.slabs').should(($slabs) => {
          const text = $slabs.text()
          for (const name of names) expect(text).to.not.contain(name)
        })

        // And once the reveal lands, they are named.
        cy.stagePhase('reveal')
        cy.get('.slabs').should(($slabs) => {
          const text = $slabs.text()
          expect(
            names.some((n) => text.includes(n)),
            'an author is named',
          ).to.be.true
        })
      })
    })
  })
})
