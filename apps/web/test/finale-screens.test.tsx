// @vitest-environment jsdom
/**
 * The finale screens, at the size that actually worries us.
 *
 * Eight answers is the hardest layout in the game, so the fixtures run at eight
 * rather than the comfortable four the other screen tests use.
 */
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { samplePhases } from '../../../packages/engine/test/drive.ts'
import { FinaleVote } from '../src/phone/screens/FinaleVote.tsx'
import { Write } from '../src/phone/screens/Write.tsx'
import { FinaleReveal, FinaleVoting } from '../src/stage/screens/Finale.tsx'

const samples = samplePhases(8, true)
const sample = (phase: string) => {
  const found = samples.find((s) => s.phase === phase)
  if (!found) throw new Error(`the finale never reached ${phase}`)
  return found
}

describe('finale screens', () => {
  it('reaches the finale phases', () => {
    expect(samples.map((s) => s.phase)).toEqual([
      'lobby',
      'writing',
      'finaleVoting',
      'finaleReveal',
      'winner',
    ])
  })

  it('puts all eight answers on the television with no author named', () => {
    const { stage } = sample('finaleVoting')
    if (stage.phase.name !== 'finaleVoting') throw new Error('wrong phase')

    const html = renderToString(<FinaleVoting view={stage} phase={stage.phase} offsetMs={0} />)
    expect(stage.phase.entries).toHaveLength(8)
    for (const entry of stage.phase.entries) expect(html).toContain(entry.text)
    for (const seat of stage.seats) expect(html).not.toContain(`${seat.name} ·`)
    expect(html).toContain('THE FINALE')
    expect(html).toContain('authors hidden')
  })

  it('gives each phone a ballot without their own answer on it', () => {
    const { seats } = sample('finaleVoting')

    for (const { view } of seats) {
      if (view.phase.name !== 'finaleVoting') throw new Error('wrong phase')
      const mine = view.phase.entries.find((e) => e.isYours)
      const html = renderToString(
        <FinaleVote view={view} phase={view.phase} offsetMs={0} onVote={() => {}} />,
      )

      // Everyone else's answers are votable; yours is not on the page at all.
      for (const entry of view.phase.entries) {
        if (entry.isYours) expect(html).not.toContain(entry.text)
        else expect(html).toContain(entry.text)
      }
      expect(mine).toBeTruthy()
      expect(html).toContain('the finale')
    }
  })

  it('offers exactly three votes and a stepper per row', () => {
    const { seats } = sample('finaleVoting')
    const { view } = seats[0]!
    if (view.phase.name !== 'finaleVoting') throw new Error('wrong phase')

    const html = renderToString(
      <FinaleVote view={view} phase={view.phase} offsetMs={0} onVote={() => {}} />,
    )
    expect(view.phase.votesPerVoter).toBe(3)
    // Seven other answers, each with a minus and a plus.
    expect(html.split('take a vote off').length - 1).toBe(7)
    expect(html.split('put a vote on').length - 1).toBe(7)
  })

  it('names everyone at the finale reveal and awards points', () => {
    const { stage } = sample('finaleReveal')
    if (stage.phase.name !== 'finaleReveal') throw new Error('wrong phase')

    const html = renderToString(<FinaleReveal view={stage} phase={stage.phase} />)
    for (const entry of stage.phase.entries) expect(html).toContain(entry.authorName)
    expect(stage.phase.entries.some((e) => e.points > 0)).toBe(true)
    // Winners flip up, everybody else stays inverted.
    expect(html).toContain('ud-anim-winflip')
    expect(html).toContain('ud-anim-loseflip')
  })

  it('tells the phone it is writing for the finale, not a matchup', () => {
    const { seats } = sample('writing')
    const { view } = seats[0]!
    if (view.phase.name !== 'writing') throw new Error('wrong phase')

    expect(view.phase.isFinale).toBe(true)
    const html = renderToString(
      <Write view={view} phase={view.phase} offsetMs={0} onSubmit={() => {}} />,
    )
    expect(html).toContain('the finale')
    expect(html).not.toContain('prompt 1 of')
  })
})
