/**
 * Synthetic players, over the same socket a phone uses.
 *
 * Shared by the CLI harness and the Cypress tasks so there is exactly one
 * implementation of "a player who is not a person". When Cypress drives one
 * surface in a real browser, these fill the other seats — a party game needs
 * four participants before it will do anything at all, and spinning up four
 * browsers to get there would be slower and prove less.
 */

import type { ClientView, ServerMsg } from '@ud/protocol'
import { PROTOCOL_VERSION } from '@ud/protocol'

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export const NAMES = ['Priya', 'Tom', 'Ansh', 'Lena', 'Mo', 'Kit', 'Rae', 'Sol']

/** A connected socket that tracks the latest view. */
export class Peer {
  ws: WebSocket
  view: ClientView | null = null
  seatId: string | null = null
  seatToken: string | null = null
  code: string | null = null
  errors: string[] = []

  constructor(public url: string) {
    this.ws = new WebSocket(url)
    this.ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(String(ev.data)) as ServerMsg
      switch (msg.t) {
        case 'welcome':
          this.code = msg.code
          this.seatId = msg.seatId
          this.seatToken = msg.seatToken
          break
        case 'view':
          this.view = msg.view
          break
        case 'error':
          this.errors.push(`${msg.code}: ${msg.message}`)
          break
        case 'reload':
          this.errors.push(`reload: ${msg.reason}`)
          break
      }
    })
  }

  open(): Promise<void> {
    if (this.ws.readyState === WebSocket.OPEN) return Promise.resolve()
    return new Promise((resolve, reject) => {
      this.ws.addEventListener('open', () => resolve(), { once: true })
      this.ws.addEventListener('error', () => reject(new Error('socket failed')), { once: true })
    })
  }

  send(msg: unknown): void {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg))
  }

  close(): void {
    this.ws.close()
  }

  /** Wait for a view satisfying `predicate`, or give up loudly. */
  async until(label: string, predicate: (v: ClientView) => boolean, timeoutMs = 30_000) {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      if (this.view && predicate(this.view)) return this.view
      await sleep(20)
    }
    throw new Error(
      `timed out waiting for ${label} (last phase: ${this.view?.phase.name ?? 'none'})`,
    )
  }
}

/** A player who writes something and votes for whatever it feels like. */
export class Bot extends Peer {
  private written = new Set<string>()
  private voted = new Set<string>()

  /**
   * How long this bot pretends to think before acting.
   *
   * Zero is right for the CLI harness, where the point is to play a whole game
   * as fast as possible. It is wrong for a browser test: an instant bot ends
   * the writing phase before anything can observe it, so a test waiting to see
   * "writing" on the television waits forever for a phase that lasted four
   * milliseconds. A few hundred milliseconds also happens to be a better
   * impression of a person.
   */
  constructor(
    url: string,
    public name: string,
    private thinkMs = 0,
  ) {
    super(url)
    this.ws.addEventListener('message', () => this.act())
  }

  private later(fn: () => void): void {
    if (this.thinkMs <= 0) fn()
    else setTimeout(fn, this.thinkMs + Math.random() * this.thinkMs)
  }

  private act(): void {
    const view = this.view
    if (!view) return

    if (view.phase.name === 'writing' && view.phase.assignment) {
      const { slot } = view.phase.assignment
      // Keyed by round as well as slot. Keying on the slot alone meant a bot
      // wrote in round 1 and then believed it had already answered slots 0 and
      // 1 forever — so every later round timed out and auto-filled, and the
      // integration test was quietly exercising the fallback path instead of
      // the writing one.
      const key = `${view.round}:${slot}`
      if (!this.written.has(key)) {
        // Claim it before the delay, or the next view arrives and we claim it
        // again.
        this.written.add(key)
        this.later(() =>
          this.send({ t: 'answer.submit', slot, text: `${this.name} says thing ${slot}` }),
        )
      }
    }

    if (view.phase.name === 'voting' && view.phase.youMayVote && view.phase.yourVote === null) {
      const key = `${view.round}:${view.phase.matchupNumber}`
      if (!this.voted.has(key)) {
        this.voted.add(key)
        this.later(() => this.send({ t: 'vote.cast', side: Math.random() < 0.5 ? 'a' : 'b' }))
      }
    }

    if (view.phase.name === 'finaleVoting' && view.phase.votesLeft > 0) {
      // One vote per view, not all three at once: the server sends a fresh view
      // after each, so spending them one at a time is what a thumb on a stepper
      // actually does — and it exercises the running `votesLeft` count.
      const ballot = view.phase.entries.filter((e) => !e.isYours)
      const pick = ballot[Math.floor(Math.random() * ballot.length)]
      if (pick) this.send({ t: 'finale.vote', entrySeatId: pick.id, delta: 1 })
    }
  }
}

/** Open a room the way a television does, and return its code. */
export async function openRoom(url: string): Promise<{ stage: Peer; code: string }> {
  const stage = new Peer(url)
  await stage.open()
  stage.send({ t: 'stage.create', v: PROTOCOL_VERSION })
  await stage.until('a room code', (_v) => stage.code !== null)
  return { stage, code: stage.code! }
}

/** Attach to a room somebody else opened — a real browser, for instance. */
export async function watchRoom(url: string, code: string): Promise<Peer> {
  const stage = new Peer(url)
  await stage.open()
  stage.send({ t: 'stage.attach', v: PROTOCOL_VERSION, code })
  await stage.until('the room', (v) => v.code === code)
  return stage
}

/** Seat `names.length` bots in an existing room and let them play. */
export async function seatBots(
  url: string,
  code: string,
  names: string[],
  thinkMs = 0,
): Promise<Bot[]> {
  const bots: Bot[] = []
  for (const name of names) {
    const bot = new Bot(url, name, thinkMs)
    await bot.open()
    bot.send({ t: 'phone.join', v: PROTOCOL_VERSION, code, name, kind: 'player' })
    await bot.until(`${name} to be seated`, (v) => v.you !== null)
    bots.push(bot)
  }
  return bots
}
