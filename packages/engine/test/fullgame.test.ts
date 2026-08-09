import { describe, expect, it } from 'vitest'
import { project } from '../src/project.ts'
import { Game, lobbyOf } from './harness.ts'

describe('a whole game', () => {
  it('runs lobby to winner with everybody playing along', () => {
    const g = lobbyOf(5)
    expect(g.state.phase).toBe('lobby')

    g.dispatch({ type: 'game.start', seatId: g.host })
    expect(g.state.phase).toBe('writing')

    g.everyoneWrites()
    // Everyone finished early, so writing ends without waiting out the clock.
    expect(g.state.phase).toBe('voting')

    let guard = 0
    while (g.state.phase !== 'winner') {
      if (guard++ > 200) throw new Error('game never ended')
      if (g.state.phase === 'voting') g.everyoneVotes('split')
      g.tick()
    }

    const view = project(g.state, null, g.now)
    if (view.phase.name !== 'winner') throw new Error('expected winner')
    expect(view.phase.championName).toBeTruthy()
    expect(view.phase.rows).toHaveLength(5)
    expect(view.phaseEndsAt).toBeNull()
  })

  it('plays three rounds when configured for three', () => {
    const g = lobbyOf(4, { roundCount: 3 })
    g.dispatch({ type: 'game.start', seatId: g.host })

    let guard = 0
    while (g.state.phase !== 'winner') {
      if (guard++ > 400) throw new Error('game never ended')
      if (g.state.phase === 'writing') {
        g.everyoneWrites()
      } else {
        // Voting still needs its settle timer to fire after the last vote, so
        // every non-writing branch has to advance the clock.
        if (g.state.phase === 'voting') g.everyoneVotes('split')
        g.tick()
      }
    }

    expect(g.state.round).toBe(3)
  })

  it('doubles the points in round two', () => {
    const g = lobbyOf(4, { roundCount: 2 })
    g.dispatch({ type: 'game.start', seatId: g.host })
    g.everyoneWrites()

    // One vote in round one.
    const first = g.state.matchups[0]!
    const voter = g.state.seats.find((s) => s.id !== first.a.seatId && s.id !== first.b.seatId)!
    g.dispatch({ type: 'vote.cast', seatId: voter.id, side: 'a' })
    g.runUntilPhaseChanges()
    expect(g.state.matchups[0]!.points.a).toBe(200)

    // Fast-forward to round two and do the same.
    let guard = 0
    while (g.state.round !== 2 || g.state.phase !== 'voting') {
      if (guard++ > 200) throw new Error('never reached round two voting')
      if (g.state.phase === 'writing') g.everyoneWrites()
      else g.tick()
    }

    const second = g.state.matchups[g.state.matchupIndex]!
    const voter2 = g.state.seats.find((s) => s.id !== second.a.seatId && s.id !== second.b.seatId)!
    g.dispatch({ type: 'vote.cast', seatId: voter2.id, side: 'a' })
    g.runUntilPhaseChanges()
    expect(g.state.matchups[g.state.matchupIndex]!.points.a).toBe(400)
  })

  it('is deterministic — same seed, same game', () => {
    const play = (seed: number) => {
      const g = new Game({}, seed)
      for (const n of ['Priya', 'Tom', 'Ansh', 'Lena']) g.join(n)
      g.dispatch({ type: 'game.start', seatId: g.host })
      return g.state.matchups.map((m) => `${m.promptId}:${m.a.seatId}:${m.b.seatId}`)
    }
    expect(play(99)).toEqual(play(99))
    expect(play(99)).not.toEqual(play(100))
  })
})

describe('the clock', () => {
  it('auto-fills anyone who wrote nothing, and lets it compete', () => {
    const g = lobbyOf(4)
    g.dispatch({ type: 'game.start', seatId: g.host })

    // Only one person writes anything at all.
    const [firstSeat, list] = Object.entries(g.state.assignments)[0]!
    g.dispatch({ type: 'answer.submit', seatId: firstSeat, slot: 0, text: 'I brought my mum' })
    expect(list).toHaveLength(2)

    g.runUntilPhaseChanges()
    expect(g.state.phase).toBe('voting')

    const filled = g.state.matchups.flatMap((m) => [m.a, m.b]).filter((a) => a.fallback)
    expect(filled.length).toBe(7)
    for (const answer of filled) {
      expect(answer.submitted).toBe(true)
      expect(answer.text.length).toBeGreaterThan(0)
    }

    // A fallback is a real answer — it is in the matchup and it can be voted for.
    const view = project(g.state, null, g.now)
    if (view.phase.name !== 'voting') throw new Error('expected voting')
    expect(view.phase.a.text.length).toBeGreaterThan(0)
    expect(view.phase.b.text.length).toBeGreaterThan(0)
  })

  it('ignores a deadline left over from a phase it no longer owns', () => {
    const g = lobbyOf(4)
    g.dispatch({ type: 'game.start', seatId: g.host })

    // The writing deadline is in flight. Everyone finishes early, which moves
    // the room to voting and should make that timer inert.
    const stale = g.timers.find((t) => t.event.type === 'deadline')!
    g.everyoneWrites()
    expect(g.state.phase).toBe('voting')

    g.dispatch(stale.event)
    expect(g.state.phase).toBe('voting')
    expect(g.state.matchupIndex).toBe(0)
  })

  it('cuts voting short once everyone has voted', () => {
    const g = lobbyOf(5)
    g.dispatch({ type: 'game.start', seatId: g.host })
    g.everyoneWrites()

    const fullClock = g.state.phaseEndsAt!
    g.everyoneVotes('a')
    // The clock has been pulled in to a short settle rather than left running.
    expect(g.state.phaseEndsAt).toBeLessThan(fullClock)
    expect(g.state.phase).toBe('voting')

    g.tick()
    expect(g.state.phase).toBe('reveal')
  })
})

describe('scoring', () => {
  it('calls it a sweep when every vote goes one way, with a bonus', () => {
    const g = lobbyOf(5)
    g.dispatch({ type: 'game.start', seatId: g.host })
    g.everyoneWrites()
    g.everyoneVotes('a')
    g.runUntilPhaseChanges()

    const m = g.state.matchups[0]!
    expect(m.sweep).toBe(true)
    // Three eligible voters at five players, all backing A: 3×200 + 400.
    expect(m.points.a).toBe(1000)
    expect(m.points.b).toBe(0)
  })

  it('does not call a split a sweep', () => {
    const g = lobbyOf(6)
    g.dispatch({ type: 'game.start', seatId: g.host })
    g.everyoneWrites()
    g.everyoneVotes('split')
    g.runUntilPhaseChanges()
    expect(g.state.matchups[0]!.sweep).toBe(false)
  })

  it('hangs the loser upside down and leaves a tie alone', () => {
    const g = lobbyOf(5)
    g.dispatch({ type: 'game.start', seatId: g.host })
    g.everyoneWrites()
    g.everyoneVotes('a')
    g.runUntilPhaseChanges()

    const m = g.state.matchups[0]!
    const loser = g.state.seats.find((s) => s.id === m.b.seatId)!
    const winner = g.state.seats.find((s) => s.id === m.a.seatId)!
    expect(loser.lostLast).toBe(true)
    expect(winner.lostLast).toBe(false)

    const view = project(g.state, null, g.now)
    expect(view.phase.name).toBe('reveal')
  })
})

describe('seats', () => {
  it('refuses a duplicate name', () => {
    const g = lobbyOf(3)
    g.join('Priya')
    expect(g.rejects.at(-1)?.code).toBe('NAME_TAKEN')
    expect(g.state.seats).toHaveLength(3)
  })

  it('seats a late arrival as audience, who votes but never writes', () => {
    const g = lobbyOf(4)
    g.dispatch({ type: 'game.start', seatId: g.host })
    const late = g.join('Kit')

    const seat = g.state.seats.find((s) => s.id === late)!
    expect(seat.kind).toBe('audience')
    expect(g.state.assignments[late]).toBeUndefined()

    g.everyoneWrites()
    const view = project(g.state, late, g.now)
    if (view.phase.name !== 'voting') throw new Error('expected voting')
    expect(view.phase.youMayVote).toBe(true)
  })

  it('overflows past the player cap into the audience', () => {
    const g = lobbyOf(8)
    const extra = g.join('Zed')
    expect(g.state.seats.find((s) => s.id === extra)!.kind).toBe('audience')
  })

  it('will not start below the minimum', () => {
    const g = lobbyOf(2)
    g.dispatch({ type: 'game.start', seatId: g.host })
    expect(g.state.phase).toBe('lobby')
    expect(g.rejects.at(-1)?.code).toBe('GAME_IN_PROGRESS')
  })

  it('only lets the host start and set the room', () => {
    const g = lobbyOf(4)
    const notHost = g.state.seats.find((s) => s.id !== g.host)!.id
    g.dispatch({ type: 'game.start', seatId: notHost })
    expect(g.state.phase).toBe('lobby')
    expect(g.rejects.at(-1)?.code).toBe('NOT_HOST')

    g.dispatch({ type: 'settings.set', seatId: notHost, region: 'uk', level: 3 })
    expect(g.state.settings.region).toBe('global')
  })

  it('hands the room to somebody else when the host drops for good', () => {
    const g = lobbyOf(4)
    const oldHost = g.host
    g.dispatch({ type: 'seat.disconnect', seatId: oldHost })
    expect(g.state.hostSeatId).toBe(oldHost)

    g.runUntilHostCheck()
    expect(g.state.hostSeatId).not.toBe(oldHost)
    expect(g.state.hostSeatId).toBeTruthy()
  })

  it('keeps the room with a host who comes straight back', () => {
    const g = lobbyOf(4)
    const oldHost = g.host
    g.dispatch({ type: 'seat.disconnect', seatId: oldHost })
    g.dispatch({ type: 'seat.resume', seatId: oldHost })
    g.runUntilHostCheck()
    expect(g.state.hostSeatId).toBe(oldHost)
  })
})

describe('votes', () => {
  it('will not let an author vote on their own matchup', () => {
    const g = lobbyOf(5)
    g.dispatch({ type: 'game.start', seatId: g.host })
    g.everyoneWrites()

    const m = g.state.matchups[0]!
    g.dispatch({ type: 'vote.cast', seatId: m.a.seatId, side: 'a' })
    expect(Object.keys(g.state.matchups[0]!.votes)).toHaveLength(0)
  })

  it('has no takebacks', () => {
    const g = lobbyOf(5)
    g.dispatch({ type: 'game.start', seatId: g.host })
    g.everyoneWrites()

    const m = g.state.matchups[0]!
    const voter = g.state.seats.find((s) => s.id !== m.a.seatId && s.id !== m.b.seatId)!
    g.dispatch({ type: 'vote.cast', seatId: voter.id, side: 'a' })
    g.dispatch({ type: 'vote.cast', seatId: voter.id, side: 'b' })
    expect(g.state.matchups[0]!.votes[voter.id]).toBe('a')
  })
})
