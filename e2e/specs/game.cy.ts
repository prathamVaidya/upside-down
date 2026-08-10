/**
 * A whole game, played through a real browser.
 *
 * The bot harness already proves the protocol works; this proves the *interface*
 * does — that a person tapping real controls on a real phone can get from the
 * join screen to a winner without anything getting stuck.
 */
describe('playing a game on the phone', () => {
  it('goes from join to winner, tapping only what a player would tap', () => {
    cy.task<string>('room:open').then((code) => {
      cy.task('room:watch', code)

      // The browser joins first, so the browser is host and presses start.
      cy.visit(`/r/${code}`)
      cy.joinRoom(code, 'Cypress')
      cy.task('bots:seat', { code, count: 3 })

      cy.contains('4 in').should('be.visible')
      cy.get('[data-testid="start"]').click()

      cy.phase('writing')
      cy.playUntilGameOver()

      // The phone's last word is your own score, not the verdict — that lives
      // on the television, which is the whole point of the two surfaces.
      cy.contains(/points/).should('be.visible')

      cy.roomView(code).then((v) => {
        expect(v.phase.name).to.equal('winner')
        expect(v.phase.rows).to.have.length(4)
        expect(v.round).to.equal(3)
      })

      cy.task('room:errors', code).should('deep.equal', [])
    })
  })

  it('shows the author the sitting-out screen during their own matchup', () => {
    cy.task<string>('room:open').then((code) => {
      cy.visit(`/r/${code}`)
      cy.joinRoom(code, 'Cypress')
      cy.task('bots:seat', { code, count: 3 })
      cy.get('[data-testid="start"]').click()

      // Write both answers, so we are guaranteed to be an author in two of the
      // four matchups that follow.
      cy.phase('writing')
      cy.get('[data-testid="answer"]').type('I brought my mum')
      cy.get('[data-testid="submit"]').click()
      cy.get('[data-testid="answer"]').type('Describe YOUR weaknesses first')
      cy.get('[data-testid="submit"]').click()

      cy.phase('voting')

      // Somewhere in this round we hit our own matchup. When we do, there is no
      // ballot — just our own answer and an instruction to look up.
      let sawOwnMatchup = false
      const check = (remaining: number) => {
        if (remaining === 0) return
        cy.get('body').then(($body) => {
          if ($body.attr('data-phase') === 'winner') return
          if ($body.attr('data-phase') === 'voting') {
            if ($body.text().includes('The room is voting on your answer right now')) {
              sawOwnMatchup = true
              cy.get('[data-testid="choice-a"]').should('not.exist')
              cy.get('[data-testid="choice-b"]').should('not.exist')
              return
            }
            if ($body.find('[data-testid="choice-a"]:not(:disabled)').length > 0) {
              cy.get('[data-testid="choice-a"]').click()
            }
          }
          cy.wait(120)
          check(remaining - 1)
        })
      }
      check(120)

      cy.then(() => expect(sawOwnMatchup, 'reached our own matchup').to.be.true)
    })
  })

  it('does not put another player’s answer in front of us while we write', () => {
    cy.task<string>('room:open').then((code) => {
      cy.visit(`/r/${code}`)
      cy.joinRoom(code, 'Cypress')
      cy.task('bots:seat', { code, count: 3 })
      cy.get('[data-testid="start"]').click()
      cy.phase('writing')

      // Bots answer instantly and identifiably. If the writing screen ever
      // showed somebody else's work, their text would be on this page.
      cy.get('body').should('not.contain.text', 'says thing')
    })
  })
})
