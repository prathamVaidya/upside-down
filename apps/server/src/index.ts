import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ServerMsg } from '@ud/protocol'
import { connectionContext } from './room.ts'
import { Rooms } from './rooms.ts'
import { type Connection, handleMessage } from './socket.ts'
import { telemetry } from './telemetry.ts'

const PUBLIC_DIR = fileURLToPath(new URL('../public/', import.meta.url))

/**
 * One process serves the lot: landing at `/`, phone at `/play`, television at `/stage`,
 * and the socket at `/ws`. In development the two Vite servers proxy `/ws`
 * here, so both clients hot-reload against live rooms.
 */
export function startServer(port = Number(process.env.PORT ?? 3000)) {
  const rooms = new Rooms()
  rooms.startSweeper()

  const server = Bun.serve<Connection>({
    port,
    idleTimeout: 60,

    fetch(req, srv) {
      const url = new URL(req.url)

      if (url.pathname === '/ws') {
        const ok = srv.upgrade(req, {
          data: {
            client: {
              connectionId: crypto.randomUUID(),
              seatId: null,
              isStage: false,
              send: () => {},
            },
            room: null,
          },
        })
        return ok ? undefined : new Response('expected a websocket', { status: 426 })
      }

      if (url.pathname === '/health') {
        return Response.json(
          {
            ok: true,
            rooms: rooms.size,
            activeRoomCount: rooms.activeRoomCount,
            telemetry: telemetry.stats(),
          },
          { headers: { 'cache-control': 'no-store' } },
        )
      }

      return serveStatic(url.pathname)
    },

    websocket: {
      open(ws) {
        telemetry.emit({ event: 'connection.opened', ...connectionContext(ws.data.client) })
        ws.data.client.send = (msg: ServerMsg) => {
          if (msg.t === 'error' || msg.t === 'reload') {
            telemetry.emit({
              event: 'socket.rejected',
              ...ws.data.room?.telemetryContext(),
              ...connectionContext(ws.data.client),
              outcome: 'rejected',
              error_code: msg.t === 'error' ? msg.code : 'PROTOCOL_VERSION',
            })
          }
          try {
            ws.send(JSON.stringify(msg))
          } catch {
            telemetry.emit({
              event: 'socket.send_failed',
              ...ws.data.room?.telemetryContext(),
              ...connectionContext(ws.data.client),
              outcome: 'error',
              error_code: 'SOCKET_SEND_FAILED',
            })
          }
        }
      },

      message(ws, raw) {
        try {
          handleMessage(ws.data, rooms, typeof raw === 'string' ? raw : raw.toString())
        } catch (error) {
          telemetry.emit({
            event: 'socket.error',
            ...ws.data.room?.telemetryContext(),
            ...connectionContext(ws.data.client),
            outcome: 'error',
            error_code: 'INTERNAL_ERROR',
          })
          throw error
        }
      },

      close(ws, code) {
        telemetry.emit({
          event: 'connection.closed',
          ...ws.data.room?.telemetryContext(),
          ...connectionContext(ws.data.client),
          close_code: code,
        })
        ws.data.room?.remove(ws.data.client, code)
      },
    },
  })

  telemetry.emit({ event: 'server.started', room_count: rooms.size })
  return { server, rooms }
}

/**
 * Static files, built by Vite into `apps/server/public/`. Missing in
 * development, where Vite serves the clients itself — so say that plainly
 * instead of returning a bare 404 that looks like a bug.
 *
 * These routes are mirrored by `apps/web/vite.config.ts` so the dev server and
 * this one agree on what lives where. They must not drift: when they did, the
 * dev server's SPA fallback served the phone at `/stage` and the two surfaces
 * became indistinguishable.
 */
function serveStatic(pathname: string): Response {
  if (!existsSync(PUBLIC_DIR)) {
    return new Response(
      'no client build here. run `bun dev` for the Vite server, or `bun run build` first.',
      { status: 503, headers: { 'content-type': 'text/plain' } },
    )
  }

  // A real file wins — that is every hashed asset under /assets.
  const candidate = join(PUBLIC_DIR, pathname)
  if (
    candidate.startsWith(PUBLIC_DIR) &&
    statSync(candidate, { throwIfNoEntry: false })?.isFile()
  ) {
    return new Response(Bun.file(candidate))
  }

  // Keep these document routes in sync with the Vite dev server.
  const isStage = pathname === '/stage' || pathname.startsWith('/stage/')
  const isPhone =
    pathname === '/play' || pathname === '/play/' || /^\/r\/[A-Za-z]{4}\/?$/.test(pathname)
  const document = isStage
    ? join(PUBLIC_DIR, 'stage', 'index.html')
    : isPhone
      ? join(PUBLIC_DIR, 'play', 'index.html')
      : join(PUBLIC_DIR, 'index.html')

  return new Response(Bun.file(document), { headers: { 'content-type': 'text/html' } })
}

if (import.meta.main) {
  const { server, rooms } = startServer()
  console.log(`upside down · http://localhost:${server.port}`)
  console.log(`  phone  http://localhost:${server.port}/play`)
  console.log(`  stage  http://localhost:${server.port}/stage`)
  let stopping = false
  const shutdown = (signal: string) => {
    if (stopping) return
    stopping = true
    // Railway gives shutdown a finite window; do not let telemetry delay it indefinitely.
    const exitTimer = setTimeout(() => process.exit(0), 4000)
    telemetry.emit({ event: 'server.stopping', reason: signal, room_count: rooms.size })
    rooms.close()
    server.stop(true)
    void telemetry.close().finally(() => {
      clearTimeout(exitTimer)
      process.exit(0)
    })
  }
  process.once('SIGTERM', () => shutdown('SIGTERM'))
  process.once('SIGINT', () => shutdown('SIGINT'))
}
