// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { RoomClient } from '../src/client.ts'

class Socket extends EventTarget {
  static OPEN = 1
  static instances: Socket[] = []
  readyState = 0
  send = vi.fn()
  close = vi.fn()
  constructor() {
    super()
    Socket.instances.push(this)
  }
  open() {
    this.readyState = Socket.OPEN
    this.dispatchEvent(new Event('open'))
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
  Socket.instances = []
  localStorage.clear()
  sessionStorage.clear()
})

it('reopens after effect cleanup and ignores late events from the old socket', () => {
  vi.useFakeTimers()
  vi.stubGlobal('WebSocket', Socket)
  const client = new RoomClient('ws://localhost/ws', 'stage')
  client.connect()
  const first = Socket.instances[0]!
  client.close()
  client.connect()
  const second = Socket.instances[1]!
  second.open()
  first.open()
  first.dispatchEvent(new Event('close'))
  first.dispatchEvent(
    new MessageEvent('message', { data: JSON.stringify({ t: 'reload', reason: 'stale' }) }),
  )
  expect(client.snapshot().status).toBe('open')
  expect(client.snapshot().mustReload).toBeNull()
  expect(second.send.mock.calls.map(([value]) => JSON.parse(value).t)).toEqual([
    'ping',
    'stage.create',
  ])
  vi.advanceTimersByTime(30_000)
  expect(Socket.instances).toHaveLength(2)
  expect(second.send).toHaveBeenCalledTimes(3)
  client.close()
  expect(vi.getTimerCount()).toBe(0)
})

it('cancels a pending retry when closed and permits a later explicit connection', () => {
  vi.useFakeTimers()
  vi.stubGlobal('WebSocket', Socket)
  const client = new RoomClient('ws://localhost/ws', 'phone')
  client.connect()
  Socket.instances[0]!.dispatchEvent(new Event('close'))
  client.close()
  vi.advanceTimersByTime(5000)
  expect(Socket.instances).toHaveLength(1)
  client.connect()
  client.connect()
  expect(Socket.instances).toHaveLength(2)
  client.close()
})

it('clears a stale stored seat when resume fails before welcome', () => {
  vi.stubGlobal('WebSocket', Socket)
  localStorage.setItem('ud.code', 'GRUB')
  sessionStorage.setItem('ud.seat.GRUB', 'old-token')
  const client = new RoomClient('ws://localhost/ws', 'phone')
  client.connect()
  Socket.instances[0]!.open()
  Socket.instances[0]!.dispatchEvent(
    new MessageEvent('message', {
      data: JSON.stringify({ t: 'error', code: 'ROOM_NOT_FOUND', message: 'Room expired.' }),
    }),
  )
  expect(sessionStorage.getItem('ud.seat.GRUB')).toBeNull()
  expect(localStorage.getItem('ud.code')).toBeNull()
  expect(client.snapshot().view).toBeNull()
  client.close()
})

it.each(['phone', 'stage'] as const)(
  'forgets a destroyed room and stops reconnecting on %s',
  (role) => {
    vi.useFakeTimers()
    vi.stubGlobal('WebSocket', Socket)
    const client = new RoomClient('ws://localhost/ws', role)
    client.connect()
    const socket = Socket.instances[0]!
    socket.open()
    const receive = (msg: unknown) =>
      socket.dispatchEvent(
        new MessageEvent('message', {
          data: JSON.stringify(msg),
        }),
      )
    receive({ t: 'welcome', code: 'GRUB', seatId: 'host', seatToken: 'secret' })
    receive({ t: 'room.closed', reason: 'The host destroyed this room.' })
    expect(client.snapshot()).toMatchObject({
      view: null,
      code: null,
      seatId: null,
      roomClosed: 'The host destroyed this room.',
    })
    expect(localStorage.getItem('ud.code')).toBeNull()
    expect(sessionStorage.getItem('ud.seat.GRUB')).toBeNull()
    expect(socket.close).toHaveBeenCalledOnce()
    socket.dispatchEvent(new Event('close'))
    client.connect()
    vi.advanceTimersByTime(60_000)
    expect(Socket.instances).toHaveLength(1)
    expect(vi.getTimerCount()).toBe(0)
  },
)
