import { afterEach, expect, it, vi } from 'vitest'
import { startServer } from '../src/index.ts'
import { telemetry } from '../src/telemetry.ts'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

it('exposes safe telemetry health and records socket boundaries without raw content', async () => {
  vi.useFakeTimers()
  const emit = vi.spyOn(telemetry, 'emit').mockImplementation(() => {})
  const serve = vi.fn().mockReturnValue({ port: 3000 })
  vi.stubGlobal('Bun', { serve })
  const { rooms } = startServer()
  const options = serve.mock.calls[0]![0]
  const response = options.fetch(new Request('http://localhost/health'), {})
  expect(await response.json()).toMatchObject({
    ok: true,
    activeRoomCount: 0,
    telemetry: {
      queued: expect.any(Number),
      dropped: expect.any(Number),
      failedBatches: expect.any(Number),
    },
  })
  expect(response.headers.get('cache-control')).toBe('no-store')
  const client = { connectionId: 'test-pipe', seatId: null, isStage: false, send: vi.fn() }
  const ws = { data: { client, room: null }, send: vi.fn() }
  options.websocket.open(ws)
  options.websocket.message(ws, 'private malformed payload')
  expect(emit).toHaveBeenCalledWith(
    expect.objectContaining({
      event: 'socket.rejected',
      error_code: 'BAD_MESSAGE',
      connection_id: 'test-pipe',
    }),
  )
  ws.send.mockImplementation(() => {
    throw new Error('private transport message')
  })
  client.send({ t: 'pong', t0: 0, tServer: 0 })
  expect(emit).toHaveBeenCalledWith(
    expect.objectContaining({ event: 'socket.send_failed', error_code: 'SOCKET_SEND_FAILED' }),
  )
  options.websocket.close(ws, 1006, 'private close reason')
  expect(emit).toHaveBeenCalledWith(
    expect.objectContaining({ event: 'connection.closed', close_code: 1006 }),
  )
  expect(emit).toHaveBeenCalledWith(expect.objectContaining({ event: 'server.started' }))
  expect(JSON.stringify(emit.mock.calls)).not.toContain('private')
  rooms.close()
})
