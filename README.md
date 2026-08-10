# Upside Down

A free, open-source party game for 3–8 players plus unlimited audience.

One person opens the game on a big screen — a TV, a laptop lid flipped around, a shared call.
Everyone else joins on their phone with a four-letter room code. No app, no account. The game
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

Then open **http://localhost:5173/stage** on the big screen and **http://localhost:5173** on
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
| `/` | the phone — a link a friend forwards should land here |
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
```

The game rules live in a pure reducer, so a complete three-round game with eight players runs
headlessly in about twenty milliseconds. There is no mocking anywhere in the suite.

## Adding prompts

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

Milestone 1: lobby → write → vote → reveal → scoreboard → winner, over real sockets, with server
timers, per-recipient redaction, and reconnection. Coming next: three rounds and the finale (M2),
regions and the setup screen (M3), the remaining screens at full fidelity (M4).

## Licence

Content under `content/` is **CC0**. The code licence is not settled yet — see the open question
at the end of ARCHITECTURE.md.
