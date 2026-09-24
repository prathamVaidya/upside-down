describe('optional diagnostics', () => {
  it('keeps telemetry absent in an unconfigured build', function () {
    if (Cypress.env('telemetry')) this.skip()
    cy.visit('/play')
    cy.get('.diagnostics').should('not.exist')
    cy.get('[data-testid="join"]').should('be.visible')
  })

  it('starts configured diagnostics by default and preserves opt-out across reload', function () {
    if (!Cypress.env('telemetry')) this.skip()
    let requests = 0
    cy.intercept('https://telemetry.invalid/**', (req) => {
      requests++
      if (new URL(req.url).pathname.endsWith('.js')) {
        req.reply({
          statusCode: 200,
          headers: { 'content-type': 'application/javascript' },
          body: '',
        })
        return
      }
      req.reply({ statusCode: 200, body: { sessionRecording: false, featureFlags: {} } })
    })
    cy.viewport(320, 568)
    cy.visit('/play')
    cy.get('.diagnostics summary').click()
    cy.contains('Diagnostics are on by default').should('be.visible')
    cy.screenshot('diagnostics-consent-320')
    cy.contains('button', 'Turn off diagnostics').should('have.attr', 'aria-pressed', 'true')
    cy.wrap(null).should(() => expect(requests).to.be.greaterThan(0))
    cy.contains('button', 'Turn off diagnostics').click()
    cy.contains('button', 'Enable diagnostics').should('have.attr', 'aria-pressed', 'false')
    cy.then(() => {
      requests = 0
    })
    cy.reload()
    cy.get('.diagnostics summary').click()
    cy.contains('button', 'Enable diagnostics').should('have.attr', 'aria-pressed', 'false')
    cy.then(() => expect(requests).to.equal(0))
  })
})
