/** Opt-in diagnostic: sends synthetic data to the configured PostHog project. */
describe('live PostHog smoke', { retries: 0 }, () => {
  it('accepts error and replay uploads after consent', function () {
    if (!Cypress.env('liveTelemetry')) this.skip()
    cy.on('uncaught:exception', (error) => {
      if (error.message.includes('Synthetic telemetry smoke test')) return false
    })
    const uploads: { path: string; status: number }[] = []
    const scripts: string[] = []
    let requests = 0
    cy.intercept({ url: /https:\/\/[^/]+\.posthog\.com\// }, (req) => {
      requests++
      const path = new URL(req.url).pathname.replace(/\/array\/[^/]+\//, '/array/[token]/')
      req.on('response', (res) => {
        if (path.endsWith('.js') && res.statusCode === 200) scripts.push(path)
        if (req.method === 'POST') uploads.push({ path, status: res.statusCode })
      })
    })
    cy.visit('/play', {
      onBeforeLoad(win) {
        // This intentional live check starts opted out, then explicitly enables uploads.
        win.localStorage.setItem('ud.diagnostics.v2', 'no')
        // PostHog intentionally drops headless/WebDriver traffic. Simulate a normal
        // browser only in this explicitly opted-in synthetic ingestion check.
        Object.defineProperty(win.navigator, 'webdriver', { value: false })
        Object.defineProperty(win.navigator, 'userAgent', {
          value:
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
        })
        Object.defineProperty(win.navigator, 'userAgentData', { value: undefined })
      },
    })
    cy.get('.diagnostics summary').click()
    cy.then(() => expect(requests, 'no PostHog before consent').to.equal(0))
    cy.contains('button', 'Enable diagnostics').click()
    cy.wrap(null, { timeout: 30000 }).should(() => {
      expect(
        scripts.some((path) => /exception/.test(path)),
        'error recorder loaded',
      ).to.equal(true)
      expect(
        scripts.some((path) => /recorder/.test(path)),
        'session recorder loaded',
      ).to.equal(true)
    })
    cy.get('[data-testid="name-input"]').type('SmokeTest')
    cy.get('[data-testid="code-input"]').type('TEST')
    cy.window().then((win) => {
      const error = new win.Error('Synthetic telemetry smoke test')
      win.dispatchEvent(new win.ErrorEvent('error', { error, message: error.message }))
    })
    cy.wrap(null, { timeout: 15000 }).should(() => {
      expect(
        uploads.some((r) => /\/e\/?$/.test(r.path) && r.status >= 200 && r.status < 300),
        'error upload accepted',
      ).to.equal(true)
      expect(
        uploads.some((r) => /\/s\/?$/.test(r.path) && r.status >= 200 && r.status < 300),
        'replay upload accepted',
      ).to.equal(true)
    })
    cy.contains('button', 'Turn off diagnostics').click()
    cy.then(() => cy.log(JSON.stringify({ uploads, scripts })))
  })
})
