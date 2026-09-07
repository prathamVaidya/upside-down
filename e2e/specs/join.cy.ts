/**
 * The first thirty seconds.
 *
 * "Can a person who has never played submit their first answer without being
 * told how?" is one of the questions the brief says this product is judged on,
 * and it starts here — with somebody handed a phone and a link.
 */
describe('joining a room', () => {
  it('lets a stranger in with a code and a name', () => {
    cy.task<string>('room:open').then((code) => {
      cy.visit('/play')
      cy.phase('join')

      cy.contains('the code on the TV').should('be.visible')
      // Nothing to press until both fields are filled — the one control on the
      // screen should never be a dead end.
      cy.get('[data-testid="join"]').should('be.disabled')

      cy.get('[data-testid="code-input"]').type(code)
      cy.get('[data-testid="join"]').should('be.disabled')
      cy.get('[data-testid="name-input"]').type('Cypress')
      cy.get('[data-testid="join"]').should('not.be.disabled').click()

      cy.phase('lobby')
      cy.contains('Cypress').should('be.visible')
      cy.contains(`room ${code}`).should('be.visible')
    })
  })

  it('pre-fills the code from the QR deep link', () => {
    cy.task<string>('room:open').then((code) => {
      cy.visit(`/r/${code}`)
      cy.get('[data-testid="code-input"]').should('have.value', code)

      // Which means the only thing left to do is say who you are.
      cy.get('[data-testid="name-input"]').type('Scanner')
      cy.get('[data-testid="join"]').click()
      cy.phase('lobby')
    })
  })

  it('says so plainly when the code is not a room', () => {
    cy.visit('/play')
    cy.get('[data-testid="code-input"]').type('ZZZZ')
    cy.get('[data-testid="name-input"]').type('Lost')
    cy.get('[data-testid="join"]').click()

    // In the game's voice, and still on the join screen so they can retype.
    cy.contains(/isn't a room/i).should('be.visible')
    cy.phase('join')
  })

  it('refuses a name somebody already took', () => {
    cy.task<string>('room:open').then((code) => {
      cy.task('bots:seat', { code, count: 1 })
      cy.visit(`/r/${code}`)
      cy.get('[data-testid="name-input"]').type('Priya')
      cy.get('[data-testid="join"]').click()

      cy.contains(/taken/i).should('be.visible')
      cy.phase('join')
    })
  })

  it('gives the host the start control and nobody else', () => {
    cy.task<string>('room:open').then((code) => {
      // The browser arrives first, so the browser is host.
      cy.visit(`/r/${code}`)
      cy.joinRoom(code, 'Cypress')

      // Not enough people yet, so the control exists but refuses.
      cy.get('[data-testid="start"]').should('be.disabled')
      cy.contains(/the game needs 3/i).should('be.visible')

      cy.task('bots:seat', { code, count: 2 })
      cy.get('[data-testid="start"]').should('not.be.disabled')
      cy.contains('only you can press this').should('be.visible')
    })
  })

  it('seats a late arrival as audience, who votes but never writes', () => {
    cy.task<string>('room:open').then((code) => {
      cy.task('room:watch', code)
      cy.task('bots:seat', { code, count: 3 })
      cy.task('bots:start', code)

      cy.visit(`/r/${code}`)
      cy.joinRoom(code, 'Latecomer')

      // Whichever phase they landed on, the server seated them as audience.
      cy.roomView(code).then((v) => {
        const seats = v.seats
        expect(seats.find((s) => s.name === 'Latecomer')?.kind).to.equal('audience')
      })

      // They are never asked to write — not now, and not for the rest of the
      // round while the writers are still going.
      cy.get('[data-testid="answer"]').should('not.exist')
      cy.phase('voting')
      cy.get('[data-testid="answer"]').should('not.exist')

      // But they do get a ballot, labelled so they know why they never wrote.
      cy.get('[data-testid="audience-badge"]').should('be.visible')
      cy.get('[data-testid="choice-a"]').should('not.be.disabled')
    })
  })
})
