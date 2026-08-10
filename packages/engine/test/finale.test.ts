import { describe, expect, it } from 'vitest'
import { finalePointsPerVote } from '../src/config.ts'
import { project } from '../src/project.ts'
import { finaleTally } from '../src/scoring.ts'
import { votesSpent } from '../src/state.ts'
import { finaleLobbyOf, lobbyOf } from './harness.ts'

describe('the finale', () => {
  it('gives everybody the same prompt and one answer each', () => {
    const g = finaleLobbyOf(6)
    g.dispatch({ type: 'game.start', seatId: g.host })

    expect(g.state.phase).toBe('writing')
    expect(g.state.matchups).toHaveLength(0)
    expect(g.state.finale?.entries).toHaveLength(6)

    // One prompt, one slot, for everyone.
    for (const list of Object.values(g.state.assignments)) {
      expect(list).toHaveLength(1)
      expect(list[0]!.kind).toBe('finale')
    }

    const prompts = new Set(
      g.state.seats.map((s) => {
        const view = project(g.state, s.id, g.now)
        if (view.phase.name !== 'writing') throw new Error('expected writing')
        return view.phase.assignment?.promptText
      }),
    )
    expect(prompts.size).toBe(1)
  })

  it('tells the phone it is the finale so the writing screen can say so', () => {
    const g = finaleLobbyOf(4)
    g.dispatch({ type: 'game.start', seatId: g.host })
    const view = project(g.state, g.host, g.now)
    if (view.phase.name !== 'writing') throw new Error('expected writing')
    expect(view.phase.isFinale).toBe(true)
    expect(view.phase.assignment?.of).toBe(1)
  })

  it('goes from writing straight to the finale ballot', () => {
    const g = finaleLobbyOf(5)
    g.dispatch({ type: 'game.start', seatId: g.host })
    g.everyoneWrites()
    expect(g.state.phase).toBe('finaleVoting')
  })

  it('keeps your own answer off your ballot, and only yours', () => {
    const g = finaleLobbyOf(6)
    g.dispatch({ type: 'game.start', seatId: g.host })
    g.everyoneWrites()

    for (const s of g.state.seats) {
      const view = project(g.state, s.id, g.now)
      if (view.phase.name !== 'finaleVoting') throw new Error('expected finaleVoting')
      const mine = view.phase.entries.filter((e) => e.isYours)
      expect(mine).toHaveLength(1)
      expect(view.phase.entries).toHaveLength(6)
    }
  })

  it('refuses a vote for your own answer', () => {
    const g = finaleLobbyOf(4)
    g.dispatch({ type: 'game.start', seatId: g.host })
    g.everyoneWrites()

    g.finaleVote(g.host, g.host, 1)
    expect(votesSpent(g.state.finale!, g.host)).toBe(0)
  })

  it('will not let anyone spend more than their three votes', () => {
    const g = finaleLobbyOf(5)
    g.dispatch({ type: 'game.start', seatId: g.host })
    g.everyoneWrites()

    const target = g.state.finale!.entries.find((e) => e.seatId !== g.host)!
    g.finaleVote(g.host, target.seatId, 10)
    expect(votesSpent(g.state.finale!, g.host)).toBe(3)
  })

  it('lets you stack all three on one answer, or spread them', () => {
    const g = finaleLobbyOf(5)
    g.dispatch({ type: 'game.start', seatId: g.host })
    g.everyoneWrites()

    const others = g.state.finale!.entries.filter((e) => e.seatId !== g.host)
    g.finaleVote(g.host, others[0]!.seatId, 2)
    g.finaleVote(g.host, others[1]!.seatId, 1)

    const spread = g.state.finale!.votes[g.host]!
    expect(spread[others[0]!.seatId]).toBe(2)
    expect(spread[others[1]!.seatId]).toBe(1)
    expect(votesSpent(g.state.finale!, g.host)).toBe(3)
  })

  it('takes votes back off, because the ballot has a minus as well as a plus', () => {
    const g = finaleLobbyOf(5)
    g.dispatch({ type: 'game.start', seatId: g.host })
    g.everyoneWrites()

    const target = g.state.finale!.entries.find((e) => e.seatId !== g.host)!
    g.finaleVote(g.host, target.seatId, 2)
    g.dispatch({ type: 'finale.vote', seatId: g.host, entrySeatId: target.seatId, delta: -1 })
    expect(votesSpent(g.state.finale!, g.host)).toBe(1)

    // And never below zero.
    g.dispatch({ type: 'finale.vote', seatId: g.host, entrySeatId: target.seatId, delta: -1 })
    g.dispatch({ type: 'finale.vote', seatId: g.host, entrySeatId: target.seatId, delta: -1 })
    expect(votesSpent(g.state.finale!, g.host)).toBe(0)
  })

  it('cuts the ballot short once everyone has spent everything', () => {
    const g = finaleLobbyOf(5)
    g.dispatch({ type: 'game.start', seatId: g.host })
    g.everyoneWrites()

    const full = g.state.phaseEndsAt!
    g.everyoneSpendsFinaleVotes()
    expect(g.state.phaseEndsAt).toBeLessThan(full)

    g.tick()
    expect(g.state.phase).toBe('finaleReveal')
  })

  it('pays out per vote and names everyone at the reveal', () => {
    const g = finaleLobbyOf(4)
    g.dispatch({ type: 'game.start', seatId: g.host })
    g.everyoneWrites()
    g.everyoneSpendsFinaleVotes()
    g.runUntilPhaseChanges()

    expect(g.state.phase).toBe('finaleReveal')
    // Four entries in round 1: 200 × (4 − 2) × 1 ÷ 3 votes = 133 a vote.
    const perVote = finalePointsPerVote(g.state.config, 4, 1)
    expect(perVote).toBe(133)
    const totals = finaleTally(g.state.finale!)
    for (const entry of g.state.finale!.entries) {
      expect(entry.points).toBeGreaterThanOrEqual((totals[entry.seatId] ?? 0) * perVote)
    }

    const view = project(g.state, null, g.now)
    if (view.phase.name !== 'finaleReveal') throw new Error('expected finaleReveal')
    expect(view.phase.entries).toHaveLength(4)
    for (const e of view.phase.entries) expect(e.authorName).toBeTruthy()
    // Sorted best first, so the television reads top-down.
    const votes = view.phase.entries.map((e) => e.votes)
    expect([...votes].sort((a, b) => b - a)).toEqual(votes)
  })

  it('hangs everyone who did not win the finale upside down', () => {
    const g = finaleLobbyOf(4)
    g.dispatch({ type: 'game.start', seatId: g.host })
    g.everyoneWrites()
    g.everyoneSpendsFinaleVotes()
    g.runUntilPhaseChanges()

    const totals = finaleTally(g.state.finale!)
    const best = Math.max(...Object.values(totals))
    for (const s of g.state.seats) {
      const won = (totals[s.id] ?? 0) === best
      expect(s.lostLast).toBe(!won)
    }
  })

  it('leaves everyone the right way up when the finale ties outright', () => {
    // Eight voters with three votes each spread perfectly evenly is a real
    // outcome, not a contrived one — and when nobody loses, nobody hangs.
    const g = finaleLobbyOf(8)
    g.dispatch({ type: 'game.start', seatId: g.host })
    g.everyoneWrites()

    const entries = g.state.finale!.entries
    for (const [i, voter] of g.state.seats.entries()) {
      const targets = entries.filter((e) => e.seatId !== voter.id)
      for (let v = 0; v < 3; v++) {
        g.finaleVote(voter.id, targets[(i + v) % targets.length]!.seatId, 1)
      }
    }
    g.runUntilPhaseChanges()

    expect(g.state.phase).toBe('finaleReveal')
    const votes = new Set(Object.values(finaleTally(g.state.finale!)))
    expect(votes.size).toBe(1)
    expect(g.state.seats.every((s) => !s.lostLast)).toBe(true)
    expect(g.state.finale!.sweptBy).toBeNull()
  })

  it('runs the reveal straight into the winner, with no extra scoreboard', () => {
    const g = finaleLobbyOf(4)
    g.dispatch({ type: 'game.start', seatId: g.host })
    g.everyoneWrites()
    g.everyoneSpendsFinaleVotes()
    g.runUntilPhaseChanges()
    g.runUntilPhaseChanges()
    expect(g.state.phase).toBe('winner')
  })

  it('auto-fills anyone who wrote nothing, and it still competes', () => {
    const g = finaleLobbyOf(4)
    g.dispatch({ type: 'game.start', seatId: g.host })
    g.runUntilPhaseChanges()

    expect(g.state.phase).toBe('finaleVoting')
    expect(g.state.finale!.entries.every((e) => e.submitted && e.fallback)).toBe(true)

    const view = project(g.state, g.host, g.now)
    if (view.phase.name !== 'finaleVoting') throw new Error('expected finaleVoting')
    for (const e of view.phase.entries) expect(e.text.length).toBeGreaterThan(0)
  })

  it('lets the audience vote in the finale even though they never wrote', () => {
    const g = finaleLobbyOf(4)
    const watcher = g.join('Kit', 'audience')
    g.dispatch({ type: 'game.start', seatId: g.host })
    g.everyoneWrites()

    expect(g.state.finale!.entries.some((e) => e.seatId === watcher)).toBe(false)

    const view = project(g.state, watcher, g.now)
    if (view.phase.name !== 'finaleVoting') throw new Error('expected finaleVoting')
    expect(view.phase.votesLeft).toBe(3)
    expect(view.phase.entries.every((e) => !e.isYours)).toBe(true)

    const target = g.state.finale!.entries[0]!
    g.finaleVote(watcher, target.seatId, 3)
    expect(votesSpent(g.state.finale!, watcher)).toBe(3)
  })
})

describe('a full three-round game', () => {
  it('plays two head-to-head rounds and finishes on the finale', () => {
    const g = lobbyOf(5, { roundCount: 3, finaleRound: 3 })
    g.dispatch({ type: 'game.start', seatId: g.host })

    const phases: string[] = []
    let guard = 0
    while (g.state.phase !== 'winner') {
      if (guard++ > 500) throw new Error('game never ended')
      if (phases.at(-1) !== `${g.state.round}:${g.state.phase}`) {
        phases.push(`${g.state.round}:${g.state.phase}`)
      }

      if (g.state.phase === 'writing') {
        g.everyoneWrites()
      } else {
        if (g.state.phase === 'voting') g.everyoneVotes('split')
        if (g.state.phase === 'finaleVoting') g.everyoneSpendsFinaleVotes()
        g.tick()
      }
    }

    expect(g.state.round).toBe(3)
    expect(phases).toContain('1:writing')
    expect(phases).toContain('2:voting')
    expect(phases).toContain('3:finaleVoting')
    expect(phases).toContain('3:finaleReveal')
    // The finale replaces the last scoreboard rather than adding one.
    expect(phases).not.toContain('3:scoreboard')

    const view = project(g.state, null, g.now)
    if (view.phase.name !== 'winner') throw new Error('expected winner')
    expect(view.phase.rows).toHaveLength(5)
    expect(view.phase.championScore).toBeGreaterThan(0)
  })
})
