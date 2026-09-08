/**
 * The Node half of the browser tests.
 *
 * Cypress gives one browser context per test, but this game refuses to do
 * anything with fewer than three players and a television. So the browser plays
 * one seat for real and these tasks supply the rest over the same WebSocket a
 * phone uses — the room genuinely has four participants, they simply are not
 * all rendered.
 *
 * Nothing here reaches into the server's internals. A bot connects to `/ws` and
 * sends the same messages a phone does, so anything these tests prove is true
 * of real clients too.
 */
import type { ClientView } from '@ud/protocol'
import { samplePhases } from '../packages/engine/test/drive.ts'
import {
  type Bot,
  NAMES,
  openRoom,
  type Peer,
  seatBots,
  watchRoom,
} from '../tools/botgame/src/bot.ts'

type Room = { stage: Peer | null; bots: Bot[] }

const rooms = new Map<string, Room>()

const roomOf = (code: string): Room => {
  const room = rooms.get(code) ?? { stage: null, bots: [] }
  rooms.set(code, room)
  return room
}

export function makeTasks(wsUrl: string) {
  return {
    'screens:samples'() {
      const samples = [...samplePhases(8), ...samplePhases(8, true)]
      const phones = samples.map((sample, i) => ({
        label: `${sample.phase}-${i}`,
        view: sample.seats[0]!.view,
      }))
      const voting = samples.find((sample) => sample.phase === 'voting')!
      const voter = voting.seats.find(
        ({ view }) => view.phase.name === 'voting' && !view.phase.yourSide,
      )!
      phones.push({ label: 'voting-ballot', view: voter.view })
      const lobby = samples[0]!.seats[0]!.view
      if (lobby.phase.name === 'lobby')
        phones.push({
          label: 'setup',
          view: { ...lobby, phase: { ...lobby.phase, settingsOpen: true } },
        })
      return {
        phones,
        stages: samples.map((sample, i) => ({ label: `${sample.phase}-${i}`, view: sample.stage })),
      }
    },
    async 'bots:settings'({
      code,
      region,
      level,
      open,
    }: {
      code: string
      region: 'global' | 'in' | 'uk' | 'us'
      level: 1 | 2 | 3
      open: boolean
    }): Promise<null> {
      const host = roomOf(code).bots.find((b) => b.view?.you?.isHost)
      if (!host) throw new Error('no bot is host')
      host.send({ t: 'settings.set', region, level })
      host.send({ t: 'settings.open', open })
      return null
    },
    /** Open a room headlessly, as a television would, and hand back the code. */
    async 'room:open'(): Promise<string> {
      const { stage, code } = await openRoom(wsUrl)
      roomOf(code).stage = stage
      return code
    },

    /** Watch a room the browser opened, so assertions can read server truth. */
    async 'room:watch'(code: string): Promise<null> {
      roomOf(code).stage = await watchRoom(wsUrl, code)
      return null
    },

    /**
     * Seat bots and let them play. `skip` keeps a name free for whoever the
     * browser is pretending to be.
     */
    async 'bots:seat'({
      code,
      count,
      skip = [],
      thinkMs = 0,
    }: {
      code: string
      count: number
      skip?: string[]
      thinkMs?: number
    }): Promise<string[]> {
      const names = NAMES.filter((n) => !skip.includes(n)).slice(0, count)
      // Instant by default, because most specs only want to get somewhere.
      // Pass `thinkMs` when the spec needs to *watch* a phase: an instant room
      // finishes writing before a browser can look at it, and a test waiting to
      // see "writing" on the television waits forever for a phase that lasted
      // four milliseconds.
      const bots = await seatBots(wsUrl, code, names, thinkMs)
      roomOf(code).bots.push(...bots)
      return names
    },

    /** The host's start button, pressed by a bot when the browser is not host. */
    async 'bots:start'(code: string): Promise<null> {
      const host = roomOf(code).bots.find((b) => b.view?.you?.isHost)
      if (!host) throw new Error('no bot is host — did the browser join first?')
      host.send({ t: 'game.start' })
      return null
    },

    /** The room as the server sees it, for assertions the DOM cannot make. */
    async 'room:view'(code: string): Promise<ClientView | null> {
      return roomOf(code).stage?.view ?? null
    },

    /** Errors any bot collected — a silent protocol failure would show up here. */
    async 'room:errors'(code: string): Promise<string[]> {
      const room = roomOf(code)
      return [...(room.stage?.errors ?? []), ...room.bots.flatMap((b) => b.errors)]
    },

    /** Close every socket. Called after each test so rooms do not pile up. */
    async 'room:close'(): Promise<null> {
      for (const room of rooms.values()) {
        room.stage?.close()
        for (const bot of room.bots) bot.close()
      }
      rooms.clear()
      return null
    },
  }
}
