describe('stage sound', () => {
  it('requires opt-in, receives live cues, and supports mute and volume', () => {
    cy.viewport(1280, 720)
    cy.visit('/stage', {
      onBeforeLoad(win) {
        cy.spy(win.AudioContext.prototype, 'createOscillator').as('oscillator')
      },
    })
    cy.readRoomCode().then((code) => {
      cy.get('[data-testid="sound-toggle"]').should('have.attr', 'aria-label', 'Enable sound')
      cy.task('bots:seat', { code, count: 1 })
      cy.get('@oscillator').should('not.have.been.called')
      cy.get('[data-testid="sound-toggle"]').click().should('have.attr', 'aria-pressed', 'true')
      cy.get('@oscillator').should('have.been.calledOnce')
      // Wait for the enable-preview cue to finish, outside the 80 ms burst window.
      cy.get('@oscillator').should((spy) => {
        const node = (
          spy as unknown as { getCall: (index: number) => { returnValue: OscillatorNode } }
        ).getCall(0).returnValue
        expect(node.context.currentTime).to.be.greaterThan(0.2)
      })
      cy.task('bots:seat', { code, count: 1, skip: ['Priya'] })
      cy.get('@oscillator').should('have.been.calledTwice')
      cy.get('[data-testid="sound-volume"]').should('be.visible')
      cy.screenshot('stage-sound-enabled')
      cy.get('[data-testid="sound-toggle"]').click().should('have.attr', 'aria-pressed', 'false')
      cy.task('bots:seat', { code, count: 1, skip: ['Priya', 'Tom'] })
      cy.contains('Ansh').should('be.visible')
      cy.get('@oscillator').should('have.been.calledTwice')
      cy.reload()
      cy.get('[data-testid="sound-toggle"]').should('have.attr', 'aria-label', 'Enable sound')
    })
  })

  it('does not expose sound controls on phones', () => {
    cy.visit('/play')
    cy.get('[data-testid="sound-toggle"]').should('not.exist')
  })
})
