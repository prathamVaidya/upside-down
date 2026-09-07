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
