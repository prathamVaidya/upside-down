describe('destroying a room', () => {
  it('requires confirmation and makes the old room unavailable', () => {
    cy.task<string>('room:open').then((code) => {
      cy.visit(`/r/${code}`)
      cy.joinRoom(code, 'Host')
      cy.window().then((win) => {
        const confirm = cy.stub(win, 'confirm').as('confirm')
        confirm.onFirstCall().returns(false)
        confirm.onSecondCall().returns(true)
      })
      cy.get('[data-testid="destroy-room"]').click()
      cy.phase('lobby')
      cy.get('[data-testid="room-closed"]').should('not.exist')
      cy.task('bots:seat', { code, count: 2 })
      cy.get('[data-testid="start"]').click()
      cy.phase('writing')
      cy.get('[data-testid="destroy-room"]').click()
      cy.get('[data-testid="room-closed"]').should('be.visible')
      cy.get('@confirm').should('have.been.calledTwice')
      cy.get('@confirm').should('have.been.calledWithMatch', 'cannot be undone')
      cy.visit(`/r/${code}`)
      cy.get('[data-testid="name-input"]').type('Late')
      cy.get('[data-testid="join"]').click()
      cy.contains(/isn't a room/).should('be.visible')
    })
  })

  it('does not show the control to a guest', () => {
    cy.task<string>('room:open').then((code) => {
      cy.task('bots:seat', { code, count: 1 })
      cy.visit(`/r/${code}`)
      cy.joinRoom(code, 'Guest')
      cy.get('[data-testid="destroy-room"]').should('not.exist')
    })
  })
})
