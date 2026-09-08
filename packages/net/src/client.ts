import type { ClientMsg, ClientView, ErrorCode, ServerMsg, SoundCue } from '@ud/protocol'
import { PROTOCOL_VERSION } from '@ud/protocol'

export type Status = 'connecting' | 'open' | 'dropped'

export type RoomSnapshot = {
  status: Status
  view: ClientView | null
  code: string | null
  seatId: string | null
  error: { code: ErrorCode; message: string } | null
  /** Add to `Date.now()` to get server time. */
  offsetMs: number
  /** The server asked us to reload — usually a deploy changed the protocol. */
  mustReload: string | null
  roomClosed: string | null
}

export type Role = 'stage' | 'phone'

const RECONNECT_STEPS = [400, 800, 1600, 3000, 5000]

/**
 * The client half of the wire.
 *
 * Deliberately not a state library: the server is the store. This holds the
 * latest `ClientView` and re-broadcasts it, and the only local state it keeps
 * is the stuff a socket cannot rediscover on its own — the seat token that
 * makes reconnection work, and the measured clock offset.
 */
export class RoomClient {
  private ws: WebSocket | null = null
  private listeners = new Set<() => void>()
  private snap: RoomSnapshot
  private attempt = 0
  private closed = false
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private pingTimer: ReturnType<typeof setInterval> | null = null
  private bestRtt = Number.POSITIVE_INFINITY
  private pendingName: string | null = null

  constructor(
    private url: string,
    private role: Role,
  ) {
    this.snap = {
      status: 'connecting',
      view: null,
      code: null,
      seatId: null,
      error: null,
      offsetMs: 0,
      mustReload: null,
      roomClosed: null,
    }
  }

  // ---- React glue -------------------------------------------------------

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  snapshot = (): RoomSnapshot => this.snap

  private patch(next: Partial<RoomSnapshot>): void {
    this.snap = { ...this.snap, ...next }
    for (const fn of this.listeners) fn()
  }

  // ---- Storage ----------------------------------------------------------
  //
  // The stage remembers its room across a refresh, because a television that
  // forgets the code when someone bumps the laptop is a disaster. A phone
  // remembers its seat token for the session, which is what makes "your seat is
  // safe" true rather than reassuring.

  private get storedCode(): string | null {
    try {
      return localStorage.getItem('ud.code')
    } catch {
      return null
    }
  }
  private set storedCode(code: string | null) {
    try {
      if (code) localStorage.setItem('ud.code', code)
      else localStorage.removeItem('ud.code')
    } catch {
      /* private mode, or storage disabled — the game still works, just forgetfully */
    }
  }

  private seatToken(code: string): string | null {
    try {
      return sessionStorage.getItem(`ud.seat.${code}`)
    } catch {
      return null
    }
  }
  private storeSeat(code: string, token: string): void {
    try {
      sessionStorage.setItem(`ud.seat.${code}`, token)
    } catch {
      /* ignore */
    }
  }
  forgetSeat(code: string): void {
    try {
      sessionStorage.removeItem(`ud.seat.${code}`)
    } catch {
      /* ignore */
    }
  }

  // ---- Lifecycle --------------------------------------------------------

  connect(): void {
    if (this.snap.mustReload || this.snap.roomClosed || this.ws) return
    this.closed = false
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.reconnectTimer = null
    this.patch({ status: this.snap.view ? 'dropped' : 'connecting' })

    const ws = new WebSocket(this.url)
    this.ws = ws

    ws.addEventListener('open', () => {
      if (this.ws !== ws || this.closed) return
      this.attempt = 0
      this.patch({ status: 'open' })
      this.startClockSync()
      this.greet()
    })

    ws.addEventListener('message', (ev) => {
      if (this.ws !== ws || this.closed) return
      this.receive(JSON.parse(String(ev.data)) as ServerMsg)
    })

    ws.addEventListener('close', () => {
      if (this.ws !== ws) return
      this.ws = null
      this.stopClockSync()
      if (this.closed) return
      this.patch({ status: 'dropped' })
      const delay = RECONNECT_STEPS[Math.min(this.attempt++, RECONNECT_STEPS.length - 1)]!
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null
        if (!this.closed) this.connect()
      }, delay)
    })

    ws.addEventListener('error', () => ws.close())
  }

  close(): void {
    this.closed = true
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.reconnectTimer = null
    this.stopClockSync()
    const ws = this.ws
    this.ws = null
    ws?.close()
  }

  /**
   * Say who we are the moment the socket opens — including after a silent
   * reconnect, which is the case that actually matters. A phone that dropped
   * mid-round resumes onto its existing seat without the player doing anything.
   */
  private greet(): void {
    if (this.role === 'stage') {
      const code = this.snap.code ?? this.storedCode
      if (code) this.raw({ t: 'stage.attach', v: PROTOCOL_VERSION, code })
      else this.raw({ t: 'stage.create', v: PROTOCOL_VERSION })
      return
    }

    const code = this.snap.code ?? this.storedCode
    const token = code ? this.seatToken(code) : null
    if (code && token) {
      this.raw({ t: 'phone.resume', v: PROTOCOL_VERSION, code, seatToken: token })
    } else if (code && this.pendingName) {
      this.raw({
        t: 'phone.join',
        v: PROTOCOL_VERSION,
        code,
        name: this.pendingName,
        kind: 'player',
      })
    }
  }

  private receive(msg: ServerMsg): void {
    switch (msg.t) {
      case 'room.closed':
        if (this.snap.code) this.forgetSeat(this.snap.code)
        this.storedCode = null
        this.pendingName = null
        this.close()
        this.patch({ roomClosed: msg.reason, code: null, seatId: null, view: null, error: null })
        break
      case 'welcome':
        this.storedCode = msg.code
        if (msg.seatToken) this.storeSeat(msg.code, msg.seatToken)
        this.pendingName = null
        this.patch({ code: msg.code, seatId: msg.seatId, error: null })
        break

      case 'view':
        this.patch({ view: msg.view, status: 'open' })
        break

      case 'pong': {
        const rtt = Date.now() - msg.t0
        // Keep the least-delayed sample; a single fast round trip is a better
        // estimate than the average of a noisy phone connection.
        if (rtt < this.bestRtt) {
          this.bestRtt = rtt
          this.patch({ offsetMs: msg.tServer + rtt / 2 - Date.now() })
        }
        break
      }

      case 'error':
        this.patch({ error: { code: msg.code, message: msg.message } })
        // A seat the server does not recognise is worse than useless — drop it
        // so the next attempt starts clean rather than looping on a dead token.
        if (msg.code === 'SEAT_NOT_FOUND' || msg.code === 'ROOM_NOT_FOUND') {
          const code = this.snap.code ?? this.storedCode
          if (code) this.forgetSeat(code)
          this.storedCode = null
          this.pendingName = null
          this.patch({ code: null, seatId: null, view: null })
        }
        break

      case 'reload':
        this.patch({ mustReload: msg.reason })
        this.close()
        break

      case 'sound':
        this.onSound?.(msg.cue)
        break
    }
  }

  /** Set by the stage; the phone stays silent, it is a remote control. */
  onSound: ((cue: SoundCue) => void) | null = null

  private startClockSync(): void {
    this.ping()
    this.stopClockSync()
    this.pingTimer = setInterval(() => this.ping(), 30_000)
  }
  private stopClockSync(): void {
    if (this.pingTimer) clearInterval(this.pingTimer)
    this.pingTimer = null
  }
  private ping(): void {
    this.raw({ t: 'ping', t0: Date.now() })
  }

  private raw(msg: ClientMsg): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg))
  }

  // ---- Actions ----------------------------------------------------------

  send(msg: ClientMsg): void {
    this.raw(msg)
  }

  join(code: string, name: string): void {
    const upper = code.trim().toUpperCase()
    this.pendingName = name
    this.patch({ code: upper, error: null })
    this.raw({ t: 'phone.join', v: PROTOCOL_VERSION, code: upper, name, kind: 'player' })
  }

  clearError(): void {
    this.patch({ error: null })
  }
}

/** `/ws` on whatever host served the page, so dev proxying just works. */
export function defaultSocketUrl(): string {
  const { protocol, host } = window.location
  return `${protocol === 'https:' ? 'wss' : 'ws'}://${host}/ws`
}
