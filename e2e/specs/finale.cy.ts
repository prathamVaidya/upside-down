/**
 * The finale ballot on a phone.
 *
 * Three votes across up to seven answers, one-handed, while the room is
 * shouting. The rules that matter here are the ones a player could otherwise
 * break by accident: never more than three, never on your own answer, and
 * always reversible.
 */
describe('the finale ballot', () => {
  /** Get a browser player into the finale with bots filling the room. */
  const reachFinale = (players: number, fn: (code: string) => void) => {
    cy.task<string>('room:open').then((code) => {
      cy.task('room:watch', code)
      cy.visit(`/r/${code}`)
      cy.joinRoom(code, 'Cypress')
      cy.task('bots:seat', { code, count: players - 1 })
      cy.get('[data-testid="start"]').click()

      // Rounds 1 and 2 are not what this spec is about, so play them on
      // autopilot until the ballot appears.
      const advance = (remaining: number) => {
        if (remaining === 0) throw new Error('never reached the finale')
        cy.get('body').then(($body) => {
          const phase = $body.attr('data-phase')
          if (phase === 'finaleVoting') return
          if (phase === 'writing' && $body.find('[data-testid="answer"]').length) {
            cy.get('[data-testid="answer"]').type('something')
            cy.get('[data-testid="submit"]').click()
          } else if (
            phase === 'voting' &&
            $body.find('[data-testid="choice-a"]:not(:disabled)').length
          ) {
            cy.get('[data-testid="choice-a"]').click()
          } else {
            cy.wait(150)
          }
          advance(remaining - 1)
        })
      }
      advance(300)
      cy.phase('finaleVoting')
      fn(code)
    })
  }

  it('offers every answer except your own', () => {
    reachFinale(4, () => {
      // Four players, so three answers to judge — yours is not among them.
      cy.get('[data-testid="ballot-row"]').should('have.length', 3)
      cy.contains('votes left').should('be.visible')
    })
  })

  it('spends exactly three votes and then stops', () => {
    reachFinale(4, () => {
      cy.get('[data-testid="vote-plus"]').first().click()
      cy.get('[data-testid="vote-plus"]').first().click()
      cy.get('[data-testid="vote-plus"]').first().click()

      cy.get('[data-testid="ballot-row"]')
        .first()
        .find('[data-testid="vote-count"]')
        .should('have.text', '3')

      // Out of votes: every plus on the ballot goes dead, not just this row's.
      cy.get('[data-testid="vote-plus"]').should('be.disabled')
      cy.contains('all spent').should('be.visible')
    })
  })

  it('takes votes back off again', () => {
    reachFinale(4, () => {
      const row = () => cy.get('[data-testid="ballot-row"]').first()

      // Minus is dead until there is something to take back.
      row().find('[data-testid="vote-minus"]').should('be.disabled')

      row().find('[data-testid="vote-plus"]').click()
      row().find('[data-testid="vote-count"]').should('have.text', '1')

      row().find('[data-testid="vote-minus"]').click()
      row().find('[data-testid="vote-count"]').should('have.text', '0')
      row().find('[data-testid="vote-minus"]').should('be.disabled')

      // And the votes went back into the pool rather than vanishing.
      cy.get('[data-testid="vote-plus"]').first().should('not.be.disabled')
    })
  })

  it('spreads votes across several answers', () => {
    reachFinale(5, () => {
      cy.get('[data-testid="ballot-row"]').should('have.length', 4)

      cy.get('[data-testid="ballot-row"]').eq(0).find('[data-testid="vote-plus"]').click()
      cy.get('[data-testid="ballot-row"]').eq(0).find('[data-testid="vote-plus"]').click()
      cy.get('[data-testid="ballot-row"]').eq(1).find('[data-testid="vote-plus"]').click()

      cy.get('[data-testid="ballot-row"]')
        .eq(0)
        .find('[data-testid="vote-count"]')
        .should('have.text', '2')
      cy.get('[data-testid="ballot-row"]')
        .eq(1)
        .find('[data-testid="vote-count"]')
        .should('have.text', '1')
      cy.get('[data-testid="vote-plus"]').should('be.disabled')
    })
  })

  it('reaches a winner after the finale, with the votes counted', () => {
    reachFinale(4, (code) => {
      cy.get('[data-testid="vote-plus"]').first().click()
      cy.get('[data-testid="vote-plus"]').first().click()
      cy.get('[data-testid="vote-plus"]').first().click()

      cy.phase('winner', { timeout: 60_000 })

      cy.roomView(code).then((v) => {
        expect(v.phase.name).to.equal('winner')
        expect(v.phase.championScore).to.be.greaterThan(0)
      })
      cy.task('room:errors', code).should('deep.equal', [])
    })
  })
})
