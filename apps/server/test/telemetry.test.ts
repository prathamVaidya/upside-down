import { afterEach, expect, it, vi } from 'vitest'
import { Room } from '../src/room.ts'
import { createTelemetry, telemetry } from '../src/telemetry.ts'

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

it('does nothing without credentials', async () => {
  const fetcher = vi.fn()
  const sink = createTelemetry({ fetcher })
  sink.emit({ event: 'test' })
  await sink.close()
  expect(fetcher).not.toHaveBeenCalled()
  expect(sink.stats().queued).toBe(0)
})

it('batches enriched events with a bounded queue and drains on shutdown', async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ failed: 0 }))
  const sink = createTelemetry({ token: 'secret', dataset: 'game', fetcher, version: 'release' })
  for (let i = 0; i < 550; i++) sink.emit({ event: 'game.start', room_code: 'COMB' })
  expect(sink.stats()).toMatchObject({ queued: 500, dropped: 50 })
  await sink.close()
  expect(fetcher).toHaveBeenCalledTimes(5)
  const [url, request] = fetcher.mock.calls[0]!
  expect(url).toBe('https://us-east-1.aws.edge.axiom.co/v1/ingest/game')
  expect(JSON.parse(request.body)[0]).toMatchObject({
    event: 'game.start',
    deployment: 'release',
    schema_version: 1,
  })
  expect(request.body).not.toContain('secret')
})

it('swallows delivery failures and counts lost events without retries', async () => {
  const fetcher = vi.fn().mockRejectedValue(new Error('offline'))
  const sink = createTelemetry({ token: 'secret', dataset: 'game', fetcher })
  sink.emit({ event: 'test' })
  await expect(sink.close()).resolves.toBeUndefined()
  expect(sink.stats()).toMatchObject({ queued: 0, dropped: 1 })
  expect(sink.stats()).toMatchObject({ failedBatches: 1, lastSuccessAt: null })
  expect(fetcher).toHaveBeenCalledTimes(1)
})

it('surfaces partial ingestion failures and subsequent recovery', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ failed: 1 }))
    .mockResolvedValueOnce(Response.json({ failed: 0 }))
  const sink = createTelemetry({ token: 'secret', dataset: 'game', fetcher })
  sink.emit({ event: 'test' })
  await sink.flush()
  expect(sink.stats()).toMatchObject({ dropped: 1, failedBatches: 1, lastSuccessAt: null })
  sink.emit({ event: 'test' })
  await sink.close()
  expect(sink.stats()).toMatchObject({
    queued: 0,
    dropped: 1,
    failedBatches: 1,
    lastSuccessAt: expect.any(String),
  })
})

it('emits contextual room events without tokens, names, answers, or full state', () => {
  vi.useFakeTimers()
  const emit = vi.spyOn(telemetry, 'emit')
  const room = new Room('COMB')
  room.dispatch({
    type: 'seat.join',
    seatId: 'a',
    token: 'private-token',
    name: 'Private Name',
    kind: 'player',
  })
  room.dispatch({ type: 'answer.submit', seatId: 'a', slot: 0, text: 'private answer' })
  room.dispatch({ type: 'deadline', token: -1 })
  room.destroy()
  expect(emit).toHaveBeenCalledWith(
    expect.objectContaining({
      event: 'seat.join',
      room_code: 'COMB',
      player_count: 1,
      outcome: 'ok',
    }),
  )
  expect(emit).toHaveBeenCalledWith(
    expect.objectContaining({ event: 'deadline', outcome: 'ignored' }),
  )
  const payloads = JSON.stringify(emit.mock.calls)
  for (const secret of ['private-token', 'Private Name', 'private answer', '"seats"'])
    expect(payloads).not.toContain(secret)
})
