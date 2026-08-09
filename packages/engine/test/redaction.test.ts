/**
 * The security test.
 *
 * Everything else in this suite checks that the game plays correctly. This one
 * checks that it plays *fairly* — that no client is ever handed information the
 * design says they should not have. It walks a complete game and inspects the
 * serialised payload every seat would actually receive at every step.
 */
import { describe, expect, it } from 'vitest'
import { project } from '../src/project.ts'
import { lobbyOf } from './harness.ts'

describe('projection redaction', () => {
  it('never leaks authorship before a matchup is revealed', () => {
    const g = lobbyOf(6)
    g.dispatch({ type: 'game.start', seatId: g.host })
    g.everyoneWrites()

    const leaks: string[] = []

    while (g.state.phase !== 'winner') {
      const matchup = g.state.matchups[g.state.matchupIndex]

      if (g.state.phase === 'voting' && matchup) {
        const authors = [matchup.a.seatId, matchup.b.seatId]
        const authorNames = authors.map((id) => g.state.seats.find((s) => s.id === id)!.name)

        for (const viewer of [null, ...g.state.seats.map((s) => s.id)]) {
          const wire = JSON.stringify(project(g.state, viewer, g.now))

          // The answer texts in this harness embed their author's seat id, so
          // a leak of "who wrote what" shows up as the id appearing beside the
          // text. Check the ids and the names independently.
          for (const id of authors) {
            // The author's own view legitimately contains their own seat id in
            // `you`, so only flag the *other* author.
            if (id === viewer) continue
            if (wire.includes(`"authorSeatId":"${id}"`)) leaks.push(`authorSeatId ${id}`)
          }
          for (const name of authorNames) {
            if (wire.includes(`"authorName":"${name}"`)) leaks.push(`authorName ${name}`)
          }
        }
      }

      g.tick()
    }

    expect(leaks).toEqual([])
  })

  it('gives a player only their own prompt during writing', () => {
    const g = lobbyOf(5)
    g.dispatch({ type: 'game.start', seatId: g.host })

    const allPrompts = g.state.matchups.map((m) => m.promptText)

    for (const s of g.state.seats) {
      const view = project(g.state, s.id, g.now)
      expect(view.phase.name).toBe('writing')
      if (view.phase.name !== 'writing') return

      const mine = view.phase.assignment?.promptText
      expect(mine).toBeTruthy()

      // Exactly one prompt reaches them, and it is one of theirs.
      const wire = JSON.stringify(view)
      const visible = allPrompts.filter((p) => wire.includes(p))
      expect(visible).toEqual([mine])
    }
  })

  it('gives the stage no prompt text at all during writing', () => {
    const g = lobbyOf(4)
    g.dispatch({ type: 'game.start', seatId: g.host })
    const view = project(g.state, null, g.now)
    const wire = JSON.stringify(view)
    for (const m of g.state.matchups) expect(wire).not.toContain(m.promptText)
  })

  it('does not tell a voter how anyone else voted', () => {
    const g = lobbyOf(5)
    g.dispatch({ type: 'game.start', seatId: g.host })
    g.everyoneWrites()

    const matchup = g.state.matchups[g.state.matchupIndex]!
    const voters = g.state.seats.filter(
      (s) => s.id !== matchup.a.seatId && s.id !== matchup.b.seatId,
    )
    g.dispatch({ type: 'vote.cast', seatId: voters[0]!.id, side: 'a' })

    // The seat list legitimately names everyone in the room — that is how the
    // lobby and scoreboard render. What must not travel is *how* they voted, so
    // look at the phase payload, which is where a vote map would have to live.
    const phaseWire = JSON.stringify(project(g.state, voters[1]!.id, g.now).phase)
    expect(phaseWire).not.toContain(voters[0]!.id)
    expect(phaseWire).toContain('"votesIn":1')
  })

  it('marks the two authors as sitting out, and nobody else', () => {
    const g = lobbyOf(5)
    g.dispatch({ type: 'game.start', seatId: g.host })
    g.everyoneWrites()

    const matchup = g.state.matchups[g.state.matchupIndex]!
    for (const s of g.state.seats) {
      const view = project(g.state, s.id, g.now)
      if (view.phase.name !== 'voting') throw new Error('expected voting')
      const isAuthor = s.id === matchup.a.seatId || s.id === matchup.b.seatId
      expect(view.phase.youMayVote).toBe(!isAuthor)
      expect(view.phase.yourSide !== null).toBe(isAuthor)
    }
  })

  it('reveals authorship once, and only once, the reveal starts', () => {
    const g = lobbyOf(4)
    g.dispatch({ type: 'game.start', seatId: g.host })
    g.everyoneWrites()
    g.everyoneVotes('a')
    g.runUntilPhaseChanges()

    expect(g.state.phase).toBe('reveal')
    const view = project(g.state, null, g.now)
    if (view.phase.name !== 'reveal') throw new Error('expected reveal')
    expect(view.phase.a.authorName).toBeTruthy()
    expect(view.phase.b.authorName).toBeTruthy()
  })
})
