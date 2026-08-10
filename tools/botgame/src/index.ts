/**
 * A full game, played by synthetic players over real sockets.
 *
 * The unit tests prove the rules; this proves the plumbing — the socket
 * boundary, the timers, the reconnect path and the projection, all of which
 * live outside the pure reducer and so cannot be covered by folding events over
 * state. It is the integration test, and it runs in CI.
 *
 *   bun run bots                    five players, one round
 *   bun run bots -- --players 8 --rounds 3 --drop
 */
import { type ClientView, PROTOCOL_VERSION, type ServerMsg } from '@ud/protocol'

type Args = {
  players: number
  rounds: number
  drop: boolean
  verbose: boolean
  code: string | null
}

function parseArgs(argv: string[]): Args {
  const get = (flag: string, fallback: number) => {
    const i = argv.indexOf(flag)
    return i === -1 ? fallback : Number(argv[i + 1] ?? fallback)
  }
  const codeIdx = argv.indexOf('--code')
  return {
    players: get('--players', 5),
    rounds: get('--rounds', 1),
    drop: argv.includes('--drop'),
    verbose: argv.includes('--verbose'),
    // Join a room a real browser already opened, instead of making one. Handy
    // for filling seats while you watch the actual stage on a screen.
    code: codeIdx === -1 ? null : ((argv[codeIdx + 1] ?? null)?.toUpperCase() ?? null),
  }
}

const NAMES = ['Priya', 'Tom', 'Ansh', 'Lena', 'Mo', 'Kit', 'Rae', 'Sol']
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

class Peer {
  ws: WebSocket
  view: ClientView | null = null
  seatId: string | null = null
  seatToken: string | null = null
  code: string | null = null
  errors: string[] = []
  private onView: (view: ClientView) => void

  constructor(url: string, onView: (view: ClientView) => void = () => {}) {
    this.ws = new WebSocket(url)
    this.onView = onView
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
          this.onView(msg.view)
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
    this.ws.send(JSON.stringify(msg))
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

/** A player who writes something and votes for whatever is on the left. */
class Bot extends Peer {
  private written = new Set<number>()
  private voted = new Set<string>()

  constructor(
    url: string,
    public name: string,
  ) {
    super(url)
    this.ws.addEventListener('message', () => this.act())
  }

  private act(): void {
    const view = this.view
    if (!view) return

    if (view.phase.name === 'writing' && view.phase.assignment) {
      const { slot } = view.phase.assignment
      if (!this.written.has(slot)) {
        this.written.add(slot)
        this.send({ t: 'answer.submit', slot, text: `${this.name} says thing ${slot}` })
      }
    }

    if (view.phase.name === 'voting' && view.phase.youMayVote && view.phase.yourVote === null) {
      const key = `${view.round}:${view.phase.matchupNumber}`
      if (!this.voted.has(key)) {
        this.voted.add(key)
        this.send({ t: 'vote.cast', side: Math.random() < 0.5 ? 'a' : 'b' })
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

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const url = process.env.UD_URL ?? 'ws://localhost:3000/ws'
  const started = Date.now()

  console.log(`bot game · ${args.players} players · ${args.rounds} round(s) · ${url}`)

  // The television opens the room — unless a real browser already did.
  const stage = new Peer(url)
  await stage.open()
  if (args.code) {
    stage.send({ t: 'stage.attach', v: PROTOCOL_VERSION, code: args.code })
  } else {
    stage.send({ t: 'stage.create', v: PROTOCOL_VERSION })
  }
  await stage.until('a room code', () => stage.code !== null)
  const code = stage.code!
  console.log(`  room ${code}`)

  // Phones arrive.
  const bots: Bot[] = []
  for (let i = 0; i < args.players; i++) {
    const bot = new Bot(url, NAMES[i] ?? `Bot${i}`)
    await bot.open()
    bot.send({ t: 'phone.join', v: PROTOCOL_VERSION, code, name: bot.name, kind: 'player' })
    await bot.until(`${bot.name} to be seated`, (v) => v.you !== null)
    bots.push(bot)
  }

  const host = bots.find((b) => b.view?.you?.isHost)
  if (!host) throw new Error('nobody ended up as host')
  console.log(`  host is ${host.name}, ${bots.length} seated`)

  await stage.until(
    'a full lobby',
    (v) => v.phase.name === 'lobby' && v.seats.length === args.players,
  )

  host.send({ t: 'game.start' })
  // Not "wait for writing" — bots submit the instant they see a prompt, so with
  // fast clocks the room can be past it before this poll next looks.
  await stage.until('the game to start', (v) => v.phase.name !== 'lobby')
  console.log('  playing…')

  // Optional: drop somebody mid-game and bring them back on their seat token,
  // which is the path mockup 2m describes.
  if (args.drop) {
    const victim = bots.find((b) => !b.view?.you?.isHost)!
    const token = victim.seatToken!
    await sleep(300)
    victim.close()
    console.log(`  ${victim.name} dropped`)
    await sleep(300)
    const returning = new Bot(url, victim.name)
    await returning.open()
    returning.send({ t: 'phone.resume', v: PROTOCOL_VERSION, code, seatToken: token })
    await returning.until(`${victim.name} to get their seat back`, (v) => v.you !== null)
    if (returning.view?.you?.name !== victim.name) throw new Error('came back as somebody else')
    bots[bots.indexOf(victim)] = returning
    console.log(`  ${victim.name} rejoined the same seat`)
  }

  if (args.verbose) {
    let last = ''
    setInterval(() => {
      const phase = stage.view?.phase.name ?? '?'
      const label = `${stage.view?.round}:${phase}`
      if (label !== last) {
        last = label
        console.log(`    → ${label}`)
      }
    }, 50).unref?.()
  }

  const final = await stage.until('a winner', (v) => v.phase.name === 'winner', 120_000)
  if (final.phase.name !== 'winner') throw new Error('unreachable')

  const elapsed = ((Date.now() - started) / 1000).toFixed(1)
  console.log(`  winner: ${final.phase.championName} on ${final.phase.championScore}`)
  console.log(`  rounds played: ${final.round}`)

  // The scoring numbers are guesses until somebody plays this for real, so
  // print the spread — a finale that always overturns the board, or never
  // does, shows up here long before it shows up at a party.
  const rows = final.phase.rows
  const top = rows[0]?.score ?? 0
  console.log('  final scores:')
  for (const row of rows) {
    const bar = '█'.repeat(Math.round((row.score / Math.max(1, top)) * 24))
    console.log(`    ${row.name.padEnd(6)} ${String(row.score).padStart(6)}  ${bar}`)
  }
  console.log(`    finale swing: ${rows[0]?.delta ?? 0} of the winner's ${top}`)

  // Nobody should have collected an error along the way.
  const errors = [stage, ...bots].flatMap((p) => p.errors)
  if (errors.length > 0) {
    console.error(`\n  errors reported by clients:\n${errors.map((e) => `    ${e}`).join('\n')}`)
    process.exit(1)
  }

  if (final.phase.rows.length !== args.players) {
    console.error(`  expected ${args.players} on the scoreboard, got ${final.phase.rows.length}`)
    process.exit(1)
  }

  console.log(`\nbot game ok in ${elapsed}s`)
  for (const b of bots) b.close()
  stage.close()
  process.exit(0)
}

main().catch((err) => {
  console.error(`\nbot game failed: ${err.message}`)
  process.exit(1)
})
