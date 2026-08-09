// @vitest-environment jsdom
/**
 * Every stage screen, rendered against state a real game produced.
 *
 * There is no browser in CI, so this is the substitute: it will not catch a
 * layout that looks wrong, but it does catch the things that actually break a
 * party — a screen that throws on a phase it was not expecting, or a component
 * reading a field the projection stopped sending.
 */

import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { samplePhases } from '../../../packages/engine/test/drive.ts'
import { Idle } from '../src/screens/Idle.tsx'
import { Reveal } from '../src/screens/Reveal.tsx'
import { Scoreboard } from '../src/screens/Scoreboard.tsx'
import { Voting } from '../src/screens/Voting.tsx'
import { Winner } from '../src/screens/Winner.tsx'
import { Writing } from '../src/screens/Writing.tsx'

const samples = samplePhases(5)
const sample = (phase: string) => {
  const found = samples.find((s) => s.phase === phase)
  if (!found) throw new Error(`the game never reached ${phase}`)
  return found
}

describe('stage screens', () => {
  it('reaches every phase the stage can render', () => {
    expect(samples.map((s) => s.phase)).toEqual([
      'lobby',
      'writing',
      'voting',
      'reveal',
      'scoreboard',
      'winner',
    ])
  })

  it('renders the idle screen with a legible code and the players', () => {
    const { stage } = sample('lobby')
    if (stage.phase.name !== 'lobby') throw new Error('wrong phase')
    const html = renderToString(<Idle view={stage} phase={stage.phase} />)
    for (const letter of stage.code.split('')) expect(html).toContain(letter)
    for (const seat of stage.seats) expect(html).toContain(seat.name)
  })

  it('renders the writing screen without leaking a prompt to the television', () => {
    const { stage } = sample('writing')
    if (stage.phase.name !== 'writing') throw new Error('wrong phase')
    const html = renderToString(<Writing view={stage} phase={stage.phase} offsetMs={0} />)
    expect(html).toContain('Everyone is writing')
    expect(html).toContain('done')
  })

  it('renders voting with both answers and no author anywhere', () => {
    const { stage } = sample('voting')
    if (stage.phase.name !== 'voting') throw new Error('wrong phase')
    const html = renderToString(<Voting view={stage} phase={stage.phase} offsetMs={0} />)
    expect(html).toContain(stage.phase.promptText)
    expect(html).toContain(stage.phase.a.text)
    expect(html).toContain(stage.phase.b.text)
    // The seat that wrote answer A is not named on this screen, because the
    // server never told the stage who it was.
    for (const seat of stage.seats) expect(html).not.toContain(`${seat.name} ·`)
  })

  it('renders the reveal with authors, points and the flip classes', () => {
    const { stage } = sample('reveal')
    if (stage.phase.name !== 'reveal') throw new Error('wrong phase')
    const html = renderToString(<Reveal view={stage} phase={stage.phase} />)
    expect(html).toContain(stage.phase.a.authorName)
    expect(html).toContain(stage.phase.b.authorName)
    // The signature element: one side flips up, the other stays inverted.
    expect(html).toContain('ud-anim-winflip')
    expect(html).toContain('ud-anim-loseflip')
  })

  it('celebrates a clean sweep', () => {
    const { stage } = sample('reveal')
    if (stage.phase.name !== 'reveal') throw new Error('wrong phase')
    expect(stage.phase.sweep).toBe(true)
    expect(renderToString(<Reveal view={stage} phase={stage.phase} />)).toContain('CLEAN SWEEP')
  })

  it('renders the scoreboard with everyone on it', () => {
    const { stage } = sample('scoreboard')
    if (stage.phase.name !== 'scoreboard') throw new Error('wrong phase')
    const html = renderToString(<Scoreboard view={stage} phase={stage.phase} />)
    for (const row of stage.phase.rows) expect(html).toContain(row.name)
  })

  it('renders the winner', () => {
    const { stage } = sample('winner')
    if (stage.phase.name !== 'winner') throw new Error('wrong phase')
    const html = renderToString(<Winner view={stage} phase={stage.phase} />)
    expect(html).toContain(stage.phase.championName)
    expect(html).toContain('is the funniest')
  })
})
