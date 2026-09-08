# Upside Down

A free, open-source party game for 3–8 players plus unlimited audience.

One person opens the game on a big screen — a TV, a laptop lid flipped around, a shared call.
Everyone else joins at `/play` on their phone with a four-letter room code. No app, no account. The game
shows a prompt, two people write an answer to it, and everyone else votes on which is funnier.

A full game runs about fifteen minutes.

The prompt library is tagged by region, so a room in India gets prompts about auto drivers and
family WhatsApp groups and a room in the UK gets different ones. Prompts are community-contributed
and CC0 — [adding one is a two-line pull request](#adding-prompts).

## Running it

Needs [Bun](https://bun.sh). Nothing else — no database, no cloud account, no services.

```sh
bun install
bun dev
```

Then open **http://localhost:5173** on the big screen, choose **Create a room**, and open **http://localhost:5173/play** on
phones. The Vite server proxies the socket to the Bun server on `:3000`, and routes the two
surfaces exactly the way production does — same URLs in both, so you are never debugging the
wrong screen.

For a single-process production build:

```sh
bun run build     # both surfaces into apps/server/public/
bun apps/server/src/index.ts
```

| Route | |
|---|---|
| `/` | landing page — create a room or join an existing one |
| `/play` | the phone — enter a room code and name |
| `/r/GRUB` | the phone with the code pre-filled; this is what the idle screen's QR points at |
| `/stage` | the television |
| `/ws` | the WebSocket |

## Playing without friends

The bot harness plays a whole game over real sockets, which is also the integration test:

```sh
UD_FAST=1 bun apps/server/src/index.ts     # collapsed phase clocks
bun run bots -- --players 8 --rounds 3 --drop
```

`--drop` disconnects somebody mid-game and reconnects them onto their seat, which is the path
worth exercising most. `--code GRUB` fills seats in a room you already opened in a browser, so
you can watch the real stage while eight bots play.

## Tests

```sh
bun run test      # content lint, engine, redaction, client render
bun run bots      # a whole game over real sockets (needs a server running)
bun run e2e       # Cypress, in a real browser, against the built app
```

Four layers, each proving something the one below it cannot:

| | What it covers |
|---|---|
| `packages/engine` | the rules. A three-round eight-player game runs headlessly in ~20ms |
| screen tests | every screen rendered against state a real game produced |
| `bun run bots` | the socket boundary, timers, reconnection — no browser |
| `bun run e2e` | a person tapping real controls in a real browser |

There is no mocking anywhere in any of them.

`bun run e2e` builds the app, starts the Bun server on `:3100` with phase clocks slowed enough to
type into, and runs Cypress. Use `bun run e2e:open` to watch it happen.

Cypress gives one browser context per test, and this game needs four participants before it will
do anything, so the browser plays one seat for real and `e2e/tasks.ts` seats the rest over the
same WebSocket a phone uses. Nothing reaches into the server's internals — a bot sends exactly
what a phone sends, so whatever the specs prove is true of real clients too.

## Adding prompts

See [How to add prompts](docs/adding-prompts.md) for the full guide, including regions, levels, YAML examples, and troubleshooting.

Prompts live in `content/prompts/*.yaml`, one file per region, and are CC0. Add a line:

```yaml
- { id: uk-016, level: 2, text: The worst thing to admit on a night bus }
```

`level` is 1 (HR approved), 2 (medium roast) or 3 (Meet in Hell together). Keep it under 80
characters — it has to survive both a phone at 19px and a living room at three metres. Then:

```sh
bun run content:check
```

which checks the schema, duplicate ids, duplicate jokes across regions, length, and a wordlist.
Prompts are fragments, not sentences, so no full stop at the end.

Non-answers matter too: `content/fallbacks.yaml` holds the deliberately pathetic lines that fill
in for anyone who writes nothing. They compete for real, and one of them winning is the joke.

## How it fits together

Read [ARCHITECTURE.md](./ARCHITECTURE.md) before changing anything. The short version:

- `packages/engine` is a pure reducer — no I/O, no clock, no randomness. All the rules.
- `packages/protocol` is the contract. `@ud/protocol/validate` holds the schemas and stays server-side.
- `packages/clay` is the material system. Every visible object is CSS; **there is not one image
  asset in this product, and there should not be.**
- `apps/web` builds two documents: `/stage` is a stage, `/` is a remote control. Deliberately not
  the same design, and never the same layout responding to a breakpoint.
- Clients never import the engine, and never receive room state — only the redacted view for
  their own seat. That is what stops a player with devtools from seeing who wrote what.

The design brief and the mockups it was built from are in [`design/`](./design).

## Status

The full game loop runs: three rounds over real sockets, with server timers, per-recipient
redaction and reconnection. Rounds 1 and 2 are head-to-head; round 3 is the finale — one prompt
for the room, every answer on screen, three votes each to spread around.

Room setup is available from the host's lobby: choose India, UK, US, or Global and one of
three content levels. Choices appear live on the stage and survive a refresh.

Stage sound effects are available through **Enable sound** on the stage browser, with mute
and volume controls. Phones stay silent; each new page load starts with sound off.

Coming next: expand the regional prompt pools (M3), then remaining screen and edge-state
polish plus physical TV/speaker sound checks (M4).

## Licence

Content under `content/` is **CC0**. The code licence is not settled yet — see the open question
at the end of ARCHITECTURE.md.
