import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ServerMsg } from '@ud/protocol'
import { Rooms } from './rooms.ts'
import { type Connection, handleMessage } from './socket.ts'

const PUBLIC_DIR = fileURLToPath(new URL('../public/', import.meta.url))

/**
 * One process serves the lot: the phone app at `/`, the television at `/stage`,
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
          data: { client: { seatId: null, isStage: false, send: () => {} }, room: null },
        })
        return ok ? undefined : new Response('expected a websocket', { status: 426 })
      }

      if (url.pathname === '/health') {
        return Response.json({ ok: true, rooms: rooms.size })
      }

      return serveStatic(url.pathname)
    },

    websocket: {
      open(ws) {
        ws.data.client.send = (msg: ServerMsg) => {
          try {
            ws.send(JSON.stringify(msg))
          } catch {
            // The socket went away mid-broadcast. `close` will tidy up.
          }
        }
      },

      message(ws, raw) {
        handleMessage(ws.data, rooms, typeof raw === 'string' ? raw : raw.toString())
      },

      close(ws) {
        ws.data.room?.remove(ws.data.client)
      },
    },
  })

  return { server, rooms }
}

/**
 * Static files, built by Vite into `apps/server/public/`. Missing in
 * development, where Vite serves the clients itself — so say that plainly
 * instead of returning a bare 404 that looks like a bug.
 */
function serveStatic(pathname: string): Response {
  if (!existsSync(PUBLIC_DIR)) {
    return new Response(
      'no client build here. run `bun dev` for the Vite servers, or `bun run build` first.',
      { status: 503, headers: { 'content-type': 'text/plain' } },
    )
  }

  // `/stage` is the television. `/` and `/r/GRUB` are both the phone — the
  // second is what the idle screen's QR code points at, with the code
  // pre-filled by the client from the path.
  const app = pathname === '/stage' || pathname.startsWith('/stage/') ? 'stage' : 'phone'
  const rest = (app === 'stage' ? pathname.slice('/stage'.length) : pathname) || '/'

  // Serve a real file if the path names one; otherwise fall through to the
  // app's index so client-side paths like /r/GRUB still boot.
  const candidate = join(PUBLIC_DIR, app, rest)
  if (
    candidate.startsWith(PUBLIC_DIR) &&
    statSync(candidate, { throwIfNoEntry: false })?.isFile()
  ) {
    return new Response(Bun.file(candidate))
  }

  return new Response(Bun.file(join(PUBLIC_DIR, app, 'index.html')), {
    headers: { 'content-type': 'text/html' },
  })
}

if (import.meta.main) {
  const { server } = startServer()
  console.log(`upside down · http://localhost:${server.port}`)
  console.log(`  phone  http://localhost:${server.port}/`)
  console.log(`  stage  http://localhost:${server.port}/stage`)
}
