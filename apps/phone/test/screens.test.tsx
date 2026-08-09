// @vitest-environment jsdom
/**
 * Every phone screen, rendered against the view that seat actually receives.
 *
 * The important assertions here are the negative ones. A player must not be
 * able to read another player's prompt out of their own payload, and the two
 * authors of a matchup must get the sitting-out screen rather than a ballot.
 */

import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { samplePhases } from '../../../packages/engine/test/drive.ts'
import { Join } from '../src/screens/Join.tsx'
import { Lobby } from '../src/screens/Lobby.tsx'
import { Vote } from '../src/screens/Vote.tsx'
import { Waiting } from '../src/screens/Waiting.tsx'
import { Write } from '../src/screens/Write.tsx'

const samples = samplePhases(5)
const sample = (phase: string) => {
  const found = samples.find((s) => s.phase === phase)
  if (!found) throw new Error(`the game never reached ${phase}`)
  return found
}

describe('phone screens', () => {
  it('renders the join screen a stranger sees first', () => {
    const html = renderToString(<Join initialCode="MINT" error={null} onJoin={() => {}} />)
    expect(html).toContain('the code on the TV')
    expect(html).toContain('get in')
    expect(html).toContain('MINT')
  })

  it('shows the host a start control and everyone else an excuse', () => {
    const { seats } = sample('lobby')
    const hostSeat = seats.find((s) => s.view.you?.isHost)!
    const guest = seats.find((s) => !s.view.you?.isHost)!

    if (hostSeat.view.phase.name !== 'lobby') throw new Error('wrong phase')
    const hostHtml = renderToString(
      <Lobby view={hostSeat.view} phase={hostSeat.view.phase} onStart={() => {}} />,
    )
    expect(hostHtml).toContain('start the game')

    if (guest.view.phase.name !== 'lobby') throw new Error('wrong phase')
    const guestHtml = renderToString(
      <Lobby view={guest.view} phase={guest.view.phase} onStart={() => {}} />,
    )
    expect(guestHtml).not.toContain('start the game')
    expect(guestHtml).toContain('the host starts it')
  })

  it('gives each writer their own prompt and nobody else’s', () => {
    const { seats, stage } = sample('writing')
    if (stage.phase.name !== 'writing') throw new Error('wrong phase')

    for (const { view } of seats) {
      if (view.phase.name !== 'writing') throw new Error('wrong phase')
      const mine = view.phase.assignment
      expect(mine).not.toBeNull()

      const html = renderToString(
        <Write view={view} phase={view.phase} offsetMs={0} onSubmit={() => {}} />,
      )
      expect(html).toContain(mine!.promptText)
      // renderToString escapes the apostrophe.
      expect(html).toContain('that&#x27;s my answer')
    }
  })

  it('gives voters two targets and authors the sitting-out screen', () => {
    const { seats } = sample('voting')
    let voters = 0
    let authors = 0

    for (const { view } of seats) {
      if (view.phase.name !== 'voting') throw new Error('wrong phase')
      const html = renderToString(
        <Vote view={view} phase={view.phase} offsetMs={0} onVote={() => {}} />,
      )

      if (view.phase.yourSide) {
        authors++
        expect(html).toContain('The room is voting on your answer right now')
        expect(html).not.toContain('no takebacks')
      } else {
        voters++
        expect(html).toContain('no takebacks')
        expect(html).toContain(view.phase.a.text)
        expect(html).toContain(view.phase.b.text)
      }
    }

    // Exactly two people sit out their own matchup, every time.
    expect(authors).toBe(2)
    expect(voters).toBe(seats.length - 2)
  })

  it('keeps the waiting screen alive rather than blank', () => {
    const { seats } = sample('reveal')
    const html = renderToString(
      <Waiting view={seats[0]!.view} line="Look up" sub="this is the good bit" />,
    )
    expect(html).toContain('Look up')
    expect(html).toContain('the telly is doing the work now')
  })
})
