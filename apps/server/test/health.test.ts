import { expect, it } from 'vitest'
import { Rooms } from '../src/rooms.ts'

it('counts connected rooms once and excludes empty or destroyed rooms', () => {
  const rooms = new Rooms()
  const first = rooms.create()
  rooms.create()
  expect(rooms.size).toBe(2)
  expect(rooms.activeRoomCount).toBe(0)
  const stage = { seatId: null, isStage: true, send: () => {} }
  const otherStage = { ...stage }
  first.add(stage)
  first.add(otherStage)
  expect(rooms.activeRoomCount).toBe(1)
  first.remove(stage)
  expect(rooms.activeRoomCount).toBe(1)
  first.remove(otherStage)
  expect(rooms.activeRoomCount).toBe(0)
  first.add(stage)
  rooms.destroy(first)
  expect(rooms.activeRoomCount).toBe(0)
  expect(rooms.size).toBe(1)
})
