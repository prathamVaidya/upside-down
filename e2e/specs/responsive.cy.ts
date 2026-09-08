import type { ClientView } from '@ud/protocol'

type Sample = { label: string; view: ClientView }
type Samples = { phones: Sample[]; stages: Sample[] }

/** Real engine projections, held steady so layout assertions aren't racing deadlines. */
function visitSample(path: string, view: ClientView) {
  cy.visit(path, {
    onBeforeLoad(win) {
      class Socket extends win.EventTarget {
        static OPEN = 1
        readyState = 0
        constructor() {
          super()
          win.setTimeout(() => {
            if (this.readyState === 3) return
            this.readyState = 1
            this.dispatchEvent(new win.Event('open'))
            for (const msg of [
              { t: 'welcome', code: view.code, seatId: view.you?.id ?? null, seatToken: null },
              { t: 'view', seq: 1, view: { ...view, phaseEndsAt: Date.now() + 60000 } },
            ])
              this.dispatchEvent(new win.MessageEvent('message', { data: JSON.stringify(msg) }))
          }, 0)
        }
        send() {}
        close() {
          this.readyState = 3
        }
      }
      win.WebSocket = Socket as unknown as typeof WebSocket
    },
  })
}

function fitsViewport() {
  cy.document().should((doc) => {
    expect(doc.documentElement.scrollWidth, 'no horizontal page overflow').to.be.at.most(
      doc.documentElement.clientWidth + 1,
    )
  })
}

describe('responsive surfaces', () => {
  for (const [width, height] of [
    [320, 568],
    [1440, 900],
  ]) {
    it(`keeps every phone phase usable at ${width}px`, () => {
      cy.viewport(width!, height!)
      cy.task<Samples>('screens:samples').then(({ phones }) => {
        for (const { label, view } of phones) {
          // Stress the ballot with a maximum-length unbroken answer.
          if (view.phase.name === 'finaleVoting')
            for (const entry of view.phase.entries) entry.text = 'W'.repeat(100)
          visitSample('/play', view)
          cy.get('.phone')
            .should('be.visible')
            .and(($phone) => {
              expect($phone.outerWidth()).to.be.at.most(600)
            })
          fitsViewport()
          cy.get('.phone').then(($phone) => {
            $phone.find('button').each((_index, button) => {
              const rect = button.getBoundingClientRect()
              expect(rect.left, `${label} control left`).to.be.at.least(0)
              expect(rect.right, `${label} control right`).to.be.at.most(width! + 1)
            })
          })
          if (label === 'setup') cy.screenshot(`setup-${width}`, { capture: 'fullPage' })
          if (view.phase.name === 'finaleVoting') {
            cy.get('[data-testid="vote-plus"]').last().scrollIntoView().should('be.visible')
            cy.scrollTo('top')
            cy.screenshot(`finale-${width}`, { capture: 'fullPage' })
          }
        }
      })
    })
  }

  it('keeps stage answers readable on narrow and short displays', () => {
    cy.task<Samples>('screens:samples').then(({ stages }) => {
      for (const [width, height] of [
        [390, 844],
        [1024, 600],
      ]) {
        cy.viewport(width!, height!)
        for (const { view } of stages) {
          visitSample('/stage', view)
          cy.get('[data-testid="stage"]').should('be.visible')
          fitsViewport()
          if (view.phase.name === 'finaleVoting')
            cy.screenshot(`stage-finale-${width}`, { capture: 'fullPage' })
        }
      }
    })
  })

  it('centers desktop joining and recovers an expired stage room', () => {
    cy.viewport(1440, 900)
    cy.visit('/play')
    cy.get('.phone').should(($phone) => {
      const rect = $phone[0]!.getBoundingClientRect()
      expect(rect.width).to.equal(600)
      expect(rect.left).to.equal(420)
    })
    cy.screenshot('join-desktop')
    cy.visit('/stage', {
      onBeforeLoad(win) {
        win.localStorage.setItem('ud.code', 'ZZZZ')
      },
    })
    cy.get('[data-testid="room-closed"]').should('be.visible')
    cy.contains('button', 'Create a new room').click()
    cy.get('[data-testid="room-code"]').should('be.visible')
  })

  it('respects reduced motion on the stage and roast slider', () => {
    cy.then(() =>
      Cypress.automation('remote:debugger:protocol', {
        command: 'Emulation.setEmulatedMedia',
        params: { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] },
      }),
    )
    cy.task<Samples>('screens:samples').then(({ stages, phones }) => {
      visitSample('/stage', stages[0]!.view)
      cy.get('.ud-anim-bob').should('have.css', 'animation-name', 'none')
      visitSample('/play', phones.find((sample) => sample.label === 'setup')!.view)
      cy.get('.roast__travel').should('have.css', 'transition-duration', '0s')
    })
  })

  afterEach(() => {
    cy.then(() =>
      Cypress.automation('remote:debugger:protocol', {
        command: 'Emulation.setEmulatedMedia',
        params: { features: [] },
      }),
    )
  })
})
