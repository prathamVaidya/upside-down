import { DEFAULT_CONFIG, eligibleVoters } from '@ud/engine'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { Room } from '../src/room.ts'
import { Rooms } from '../src/rooms.ts'
import { telemetry } from '../src/telemetry.ts'

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

function game(count = 4, config = DEFAULT_CONFIG) {
  const room = new Room('COMB', config)
  for (let i = 0; i < count; i++)
    room.dispatch({
      type: 'seat.join',
      seatId: `p${i}`,
      token: `secret-token-${i}`,
      name: `Private Name ${i}`,
      kind: 'player',
    })
  room.dispatch({ type: 'game.start', seatId: 'p0' })
  return room
}

function deadline(room: Room) {
  vi.setSystemTime(room.state.phaseEndsAt!)
  room.dispatch({ type: 'deadline', token: room.state.timerToken })
}

it('covers a whole three-round game, scoring, sweeps, finale, and missing inputs exactly once', () => {
  const emit = vi.spyOn(telemetry, 'emit').mockImplementation(() => {})
  const room = game()
  for (let steps = 0; !room.state.ended && steps < 100; steps++) {
    if (room.state.phase === 'voting') {
      for (const voter of eligibleVoters(
        room.state,
        room.state.matchups[room.state.matchupIndex]!,
      )) {
        room.dispatch({ type: 'vote.cast', seatId: voter.id, side: 'a' })
      }
    }
    deadline(room)
  }
  expect(room.state.ended).toBe(true)
  const events = emit.mock.calls.map(([e]) => e)
  const of = (name: string) => events.filter((e) => e.event === name)
  expect(of('round.started')).toHaveLength(3)
  expect(of('round.completed')).toHaveLength(3)
  expect(of('matchup.result')).toHaveLength(8)
  expect(of('matchup.result')[0]).toMatchObject({
    votes_a: 2,
    votes_b: 0,
    sweep: true,
    points_a: 800,
  })
  expect(of('writing.completed').map((e) => e.fallback_count)).toEqual([8, 8, 4])
  expect(of('voting.completed').at(-1)).toMatchObject({ reason: 'timeout', missing_votes: 12 })
  expect(of('voting.completed')[0]).toMatchObject({
    reason: 'all_eligible_votes_cast',
    missing_votes: 0,
  })
  expect(of('finale.result')).toHaveLength(1)
  expect(of('finale.result')[0]?.entries).toHaveLength(4)
  expect(of('game.completed')).toHaveLength(1)
  expect(of('game.completed')[0]).toMatchObject({
    reason: 'all_rounds_completed',
    scores: expect.any(Array),
    game_duration_ms: expect.any(Number),
  })
  const count = events.length
  room.dispatch({ type: 'deadline', token: -1 })
  expect(emit.mock.calls).toHaveLength(count + 1)
  room.destroy()
  expect(emit.mock.calls.some(([e]) => e.event === 'game.aborted')).toBe(false)
  const payload = JSON.stringify(emit.mock.calls)
  expect(payload).not.toContain('secret-token')
  expect(payload).not.toContain('Private Name')
  expect(payload).not.toContain('promptText')
  for (const text of room.state.usedFallbacks) expect(payload).not.toContain(text)
})

it('distinguishes early submitted writing from fallback timeout', () => {
  const emit = vi.spyOn(telemetry, 'emit').mockImplementation(() => {})
  const room = game()
  for (const [seatId, assignments] of Object.entries(room.state.assignments)) {
    assignments.forEach((_, slot) => {
      room.dispatch({ type: 'answer.submit', seatId, slot, text: 'private answer' })
    })
  }
  expect(emit).toHaveBeenCalledWith(
    expect.objectContaining({
      event: 'writing.completed',
      fallback_count: 0,
      reason: 'all_submitted',
    }),
  )
  expect(JSON.stringify(emit.mock.calls)).not.toContain('private answer')
  room.destroy()
})

it('records actual host changes, ignores a resumed host check, and explains early endings', () => {
  const emit = vi.spyOn(telemetry, 'emit').mockImplementation(() => {})
  const room = game(3)
  room.dispatch({ type: 'seat.disconnect', seatId: 'p0' })
  room.dispatch({ type: 'seat.resume', seatId: 'p0' })
  room.dispatch({ type: 'host.check', seatId: 'p0' })
  expect(emit.mock.calls.filter(([e]) => e.event === 'host.changed')).toHaveLength(1)
  room.dispatch({ type: 'seat.disconnect', seatId: 'p0' })
  room.dispatch({ type: 'host.check', seatId: 'p0' })
  expect(emit).toHaveBeenCalledWith(
    expect.objectContaining({
      event: 'host.changed',
      previous_host_id: 'p0',
      host_id: 'p1',
      reason: 'transferred',
    }),
  )
  for (let i = 0; !room.state.ended && i < 30; i++) deadline(room)
  expect(emit).toHaveBeenCalledWith(
    expect.objectContaining({ event: 'game.ended_early', reason: 'insufficient_players' }),
  )
  expect(emit.mock.calls.some(([e]) => e.event === 'game.completed')).toBe(false)
  room.destroy()
})

it('correlates connections without storing arbitrary close messages', () => {
  const emit = vi.spyOn(telemetry, 'emit').mockImplementation(() => {})
  const room = game()
  const client = { connectionId: 'conn-1', seatId: 'p0', isStage: false, send: () => {} }
  room.add(client)
  room.remove(client, 1006)
  expect(emit).toHaveBeenCalledWith(
    expect.objectContaining({
      event: 'connection.detached',
      actor_id: 'p0',
      connection_id: 'conn-1',
      connection_type: 'phone',
      close_code: 1006,
    }),
  )
  room.destroy('Destroyed by host', 'host')
  room.destroy()
  expect(emit.mock.calls.filter(([e]) => e.event === 'game.aborted')).toHaveLength(1)
  expect(emit).toHaveBeenCalledWith(
    expect.objectContaining({ event: 'game.aborted', reason: 'host' }),
  )
})

it('distinguishes idle expiry, maximum age, and shutdown; clears rooms and timers', () => {
  const emit = vi.spyOn(telemetry, 'emit').mockImplementation(() => {})
  const rooms = new Rooms()
  rooms.create()
  rooms.sweep(Date.now() + 11 * 60_000)
  expect(emit).toHaveBeenCalledWith(
    expect.objectContaining({ event: 'room.closed', reason: 'idle_timeout' }),
  )
  const old = rooms.create()
  old.add({ seatId: null, isStage: true, send: () => {} })
  rooms.sweep(Date.now() + 121 * 60_000)
  expect(emit).toHaveBeenCalledWith(
    expect.objectContaining({ event: 'room.closed', reason: 'max_age' }),
  )
  const active = rooms.create()
  for (let i = 0; i < 3; i++)
    active.dispatch({
      type: 'seat.join',
      seatId: `p${i}`,
      token: 'private',
      name: `Name ${i}`,
      kind: 'player',
    })
  active.dispatch({ type: 'game.start', seatId: 'p0' })
  rooms.startSweeper()
  rooms.close()
  expect(rooms.size).toBe(0)
  expect(vi.getTimerCount()).toBe(0)
  expect(emit).toHaveBeenCalledWith(
    expect.objectContaining({ event: 'game.aborted', reason: 'server_shutdown' }),
  )
})
