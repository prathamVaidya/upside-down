describe('landing page', () => {
  it('creates a room from the main action', () => {
    cy.visit('/')
    cy.get('[data-testid="create-room"]').should('be.visible').click()
    cy.location('pathname').should('eq', '/stage')
    cy.stagePhase('lobby')
    cy.readRoomCode().should('match', /^[A-Z]{4}$/)
    cy.readRoomCode().then((firstCode) => {
      cy.visit('/')
      cy.get('[data-testid="create-room"]').click()
      cy.readRoomCode().should('not.eq', firstCode)
    })
  })

  it('takes invited players to the phone app', () => {
    cy.visit('/')
    cy.get('[data-testid="join-room"]').click()
    cy.location('pathname').should('eq', '/play')
    cy.get('[data-testid="code-input"]').should('be.visible')
  })
})
