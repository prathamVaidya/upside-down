/**
 * A full game, played by synthetic players over real sockets.
 *
 * The unit tests prove the rules; this proves the plumbing — the socket
 * boundary, the timers, the reconnect path and the projection, all of which
 * live outside the pure reducer and so cannot be covered by folding events over
 * state. It is the integration test, and it runs in CI.
 *
 *   bun run bots                    five players, whatever rounds the server has
 *   bun run bots -- --players 8 --drop --verbose
 *   bun run bots -- --code GRUB     fill seats in a room a browser already opened
 */
import { PROTOCOL_VERSION } from '@ud/protocol'
import { Bot, NAMES, openRoom, type Peer, sleep, watchRoom } from './bot.ts'

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
    rounds: get('--rounds', 3),
    drop: argv.includes('--drop'),
    verbose: argv.includes('--verbose'),
    code: codeIdx === -1 ? null : ((argv[codeIdx + 1] ?? null)?.toUpperCase() ?? null),
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const url = process.env.UD_URL ?? 'ws://localhost:3000/ws'
  const started = Date.now()

  console.log(`bot game · ${args.players} players · ${url}`)

  // The television opens the room — unless a real browser already did.
  const { stage, code } = args.code
    ? { stage: await watchRoom(url, args.code), code: args.code }
    : await openRoom(url)
  console.log(`  room ${code}`)

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
    (v) => v.phase.name === 'lobby' && v.seats.length >= args.players,
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
      const label = `${stage.view?.round}:${stage.view?.phase.name ?? '?'}`
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
  const errors = [stage as Peer, ...bots].flatMap((p) => p.errors)
  if (errors.length > 0) {
    console.error(`\n  errors reported by clients:\n${errors.map((e) => `    ${e}`).join('\n')}`)
    process.exit(1)
  }

  if (rows.length !== args.players) {
    console.error(`  expected ${args.players} on the scoreboard, got ${rows.length}`)
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
