# Upside Down — architecture

Decisions, and the reasons behind them, for the free open-source party game described in
`design/upside-down-design-brief.md`. Read this before adding anything.

Stack: **Bun** server, **React 19 + Vite + TypeScript** clients, **no database**, **no animation library**.

---

## 1. Shape of the system

Three programs and one shared brain.

```
   TV / laptop lid                    phones (3–8 players + audience)
   ┌──────────────┐                   ┌──────┐ ┌──────┐ ┌──────┐
   │ web  /stage  │                   │ web  /play · /r/GRUB        │
   └──────┬───────┘                   └──┬───┘ └──┬───┘ └──┬───────┘
          │  WebSocket (JSON)            │        │        │
          └──────────────┬───────────────┴────────┴────────┘
                         ▼
                  ┌─────────────┐
                  │ apps/server │  Bun.serve — sockets, timers, redaction
                  │   ┌───────┐ │
                  │   │engine │ │  pure reducer, no I/O, no clock, no rng
                  │   └───────┘ │
                  └─────────────┘
```

The stage never receives gameplay input. Its local sound controls are the exception, because
browser audio needs a gesture on the stage itself. Mockup `2g` puts the start button on the host's phone and `2a`
says the host picks the region there too, so the TV is a display surface only. This is a gift —
TV and cast-browser input is miserable, and now we never need it.

### Repo layout

Bun workspaces — `packages/*`, `apps/*`, `tools/*`. `bun install && bun dev` brings the whole
thing up with no external services, no database, and no cloud account.

```
upside-down/
├── package.json              workspaces + root scripts
├── tsconfig.base.json        shared compiler options and path aliases
├── biome.json                one tool for lint + format
├── Dockerfile                single image: builds clients, serves everything
├── ARCHITECTURE.md · README.md · CONTRIBUTING.md · LICENSE
│
├── design/                   source of truth for the look — not code
│   ├── upside-down-design-brief.md
│   ├── Upside Down Mockups.dc.html
│   └── support.js
│
├── content/                  CC0 game content — the PR surface for non-coders
│   ├── prompts/{global,in,uk,us}.yaml
│   ├── fallbacks.yaml        the pathetic auto-fill answers
│   ├── copy.yaml             waiting lines, round names, winner announcements
│   ├── words.yaml            room-code dictionary, profanity-filtered
│   ├── sound-brief.md
│   └── LICENSE               CC0, separate from the code licence
│
├── packages/
│   ├── protocol/             @ud/protocol — the contract, depends on nothing
│   │   └── src/{version,messages,view,ids}.ts
│   │   └── src/validate.ts   the zod schemas — a separate entry point, see below
│   ├── engine/               @ud/engine — pure rules, no I/O
│   │   ├── src/{state,events,ctx,reduce,transitions}.ts
│   │   ├── src/{pairing,scoring,deck,project,rng,config}.ts
│   │   ├── src/bootstrap.ts  the only file here that touches disk
│   │   └── test/{fullgame,redaction,pairing}.test.ts + {harness,drive}.ts
│   ├── content/              @ud/content — loader, zod schema, CI checker
│   ├── clay/                 @ud/clay — the material system
│   │   └── src/{tokens,clay,keyframes,reduced-motion}.css
│   │   └── src/{components.tsx,Countdown.tsx,shape.ts}
│   └── net/                  @ud/net — the socket, clock sync, useRoom()
│
├── apps/
│   ├── server/               Bun.serve — sockets, timers, room registry
│   │   └── src/{index,rooms,room,socket,config}.ts
│   └── web/                  Vite, three HTML entry points, one bundle graph
│       ├── index.html            the landing page
│       ├── play/index.html       the phone
│       ├── stage/index.html      the television
│       ├── src/stage/screens/{Idle,Writing,Voting,Reveal,Finale,Scoreboard,Winner}.tsx
│       └── src/phone/screens/{Join,Lobby,Write,Vote,FinaleVote,Waiting,Dropped}.tsx
│
└── tools/
    └── botgame/              headless N-bot full-game runner, plus the fuzzer
```

### Dependency rules

The tree is decoration; these arrows are the actual structure. Enforced by a dependency lint in
CI, not by good intentions.

```
protocol ← (nothing)          engine ← protocol, content
clay     ← protocol           server ← protocol(+validate), engine, content
content  ← protocol           web    ← protocol, clay, net
net      ← protocol
```

Two of these matter more than the rest:

**`engine` imports no I/O and no framework.** That is what keeps the reducer pure, and therefore
what keeps a full game runnable in a unit test.

**The clients never import `engine`.** Not "shouldn't" — a lint failure. Clients render
`ClientView` and nothing else. If a screen needs to know a rule, the rule is missing from the
projection and belongs on the server. This kills client-side rule duplication, and it makes it
structurally impossible to ship un-redacted state types into a bundle a player can read.

### Three documents, one app

`apps/web` builds three HTML entry points from one bundle graph: landing, phone, and stage. The landing page has no room connection. React and the clay system are
emitted once and shared; each surface adds about 3KB of its own.

The original plan had these as two separate Vite apps, on the theory that a route split would ship
the confetti system and Doug's pose set to every phone at the party. Measured, that difference was
about 4KB — React dominates both bundles, so the split bought nothing. What survives is narrower:

- **Separate `<head>`s.** The phone uses `viewport-fit=cover` with safe-area padding. Inputs
  use at least 16px text to avoid iOS focus zoom, while pinch zoom remains available.
- **Separate cache lifetimes.** Changing the winner screen does not invalidate the phone's chunk.

Two *apps* also cost something real: development served the surfaces on two ports while production
served them on two paths, so `/stage` on a dev port silently fell through Vite's SPA fallback to
the phone and the two surfaces looked identical. `apps/web/vite.config.ts` now mirrors the server's
routing table, and CI asserts the two documents differ.

The design separation the brief asks for — a stage and a remote control, not one responsive layout
— is a component-level discipline, enforced by `src/stage` and `src/phone` being separate trees
with separate CSS. It never needed separate build targets.

Both surfaces adapt to their viewport: the phone UI becomes a centered, 600px-wide panel on
desktop, while compact stage layouts scroll and stack content instead of clipping it. Browser
fixtures cover game phases at narrow and desktop widths, long answers, and reduced motion.

### Serving

One process, one container. Vite builds both clients into `apps/server/public/`, and Bun serves:

| Route | Serves |
|---|---|
| `/` | landing page — Create a room opens `/stage`; Join a room opens `/play` |
| `/play` | phone app — enter a room code and name |
| `/r/GRUB` | phone app, code pre-filled — this is what the idle-screen QR points at |
| `/stage` | stage app — the host opens this on the TV |
| `/ws` | WebSocket upgrade |

In development one Vite server on `:5173` serves the same routes and proxies `/ws` to Bun on
`:3000`, so hot reload works on both surfaces while the server holds live rooms. The dev routing
table lives in `apps/web/vite.config.ts` and deliberately mirrors the one above — CI asserts `/`
and `/stage` return different documents, because when they did not the symptom was simply that
both URLs looked the same.

### Root scripts

```
bun dev             server watch + the Vite server on :5173
bun test            engine units, property tests, redaction walk, bot game
bun run bots        full game with N synthetic players against a real server
bun run content:check   schema, duplicate ids, duplicate text, length ceiling, wordlist
bun run build       both surfaces into the server's public dir
```

### Deliberately not doing

- **No `shared/` or `utils/` package.** Things live where they're owned, or they get a name.
- **No barrel files re-exporting everything.** They defeat tree-shaking, and the phone bundle is
  the one place bytes actually matter.
- **No Turborepo or Nx.** Seven packages and Bun scripts. Add a build orchestrator when a build is
  slow, not before.
- **No client-side state library.** One `useRoom()` hook holds the latest `ClientView`. The server
  is the store.

---

## 2. The core bet: the engine is a pure reducer

```ts
type Ctx    = { now: number; rng: () => number }        // injected, never ambient
type Result = { state: RoomState; effects: Effect[] }

function reduce(state: RoomState, event: Event, ctx: Ctx): Result
```

No sockets, no `Date.now()`, no `Math.random()`, no timers inside `packages/engine`. Clock and
randomness arrive through `ctx`. Effects are data the server carries out:

```ts
type Effect =
  | { kind: 'schedule'; at: number; event: Event }   // becomes a setTimeout
  | { kind: 'broadcast' }                            // recompute + push projections
  | { kind: 'sound';    cue: SoundCue }              // stage audio
  | { kind: 'close';    seatId: SeatId; reason: string }
```

This is the decision everything else leans on, and it buys three specific things:

- A full 3-round game with 8 bots runs headlessly in **milliseconds** under Vitest, no network.
- Games are **seeded and replayable**. Record the event log, replay it, get a byte-identical
  game. Any bug a player reports becomes a regression test.
- Rule changes never touch transport code, and transport bugs never corrupt rules.

### Phases

```
lobby ──▶ writing ──▶ voting[i] ──▶ reveal[i] ──┐
  ▲          │           ▲                      │  more matchups
  │          │           └──────────────────────┘
  │          │                                  ▼
  │          │                             scoreboard ──▶ next round
  │          │                                  │
  └── setup  └──(finale)──▶ finaleVoting ──▶ finaleReveal ──▶ winner
```

Rounds 1 and 2 are head-to-head. Round 3 is the finale: one prompt for
everybody, every answer on screen at once, and three votes per voter to spread
across them. It rides the same `writing` phase and the same `assignments` map as
a normal round — the phone's writing screen cannot tell the difference, it just
receives one prompt instead of two — and then diverges into its own ballot and
its own reveal, which runs straight into the winner rather than another
scoreboard.

Two rules the finale does *not* share with a matchup: you cannot vote for your
own answer (it is absent from your ballot entirely, and the reducer refuses it
anyway), and votes come off as easily as they go on, because mockup 2l gives
every row a minus as well as a plus. "No takebacks" belongs to the head-to-head
round.

Setup is not a separate phase. `settings` is editable by the host during `lobby`, and when the
host opens the picker the stage renders screen `2a` live — the mockup copy is literally
*"the host picks on their phone · everyone else gets to judge the choice"*, so the room watching
the choice happen is the feature.

### Pairing

Each player writes 2 answers, each prompt receives exactly 2 — that is a 2-regular graph, i.e. a
cycle. Take a random permutation `p` and pair `p[i]` with `p[(i+1) % n]` on prompt `i`. Exactly
`n` matchups, every player in exactly two. Property-tested.

> **Known limit:** at n=3 there are only 3 possible pairings and every round consumes all three,
> so "opponents reshuffle between rounds" is best-effort, not guaranteed. Minimise repeats; don't
> promise to eliminate them.

---

## 3. Redaction is a correctness requirement, not a UI state

`1d` says *"authors hidden until reveal"*. `2l` says *"yours isn't in this list"*. If the server
broadcasts one snapshot containing authorship, anyone with devtools wins the game.

So every push goes through:

```ts
function project(state: RoomState, viewer: Seat): ClientView
```

Authorship, un-revealed answers a viewer shouldn't have, and the sitting-out player's identity
are stripped **server-side, per recipient**. A test walks a complete game and asserts that no
serialised payload ever contains an author's seat id before that matchup is revealed.

**Note on Bun pub/sub:** `server.publish()` sends one identical payload to a topic, which we
cannot use for game snapshots. Viewers do however collapse into a handful of equivalence classes
per phase — stage, ordinary voter, author A, author B — so memoise the projection by class and
loop the sockets. At 8 players the loop is free; the class key is there if it ever isn't.

---

## 4. Time

The server owns every deadline. Snapshots carry `phaseEndsAt` as an **epoch milliseconds**
timestamp, never a remaining-seconds count.

Clients run a small clock sync — `ping{t0}` → `pong{t0, tServer}`, offset from the min-RTT
sample, resampled every 30s — and render the countdown against corrected local time. A client
timer hitting zero is cosmetic; only the server's `deadline` event ends a phase.

One active timer per room, so a plain `setTimeout` per room is sufficient. No timer wheel.

---

## 5. Reconnection

Screen `2m` is *"You dropped — the game kept going. your seat is safe."* Reconnect is a normal
state, not an error path.

- Identity is a `seatToken` (128 random bits) issued at join, held in `sessionStorage`.
- The socket is a pipe bound to a seat, never the seat itself.
- Rejoin sends `{ code, seatToken }` and rebinds. Seats persist for the whole game with
  `connected: false`.
- Host disconnected >30s hands host to the next-joined player.
- Room is destroyed 10 minutes after the last disconnect, or 2 hours absolute.
- The host can destroy the room from their phone in any phase after confirming.
  The server checks host identity, removes the room and cancels its timers, then
  notifies all clients to forget their seats and show the room-closed screen.

---

## 6. Protocol

JSON over WebSocket, zod-validated on the way in, a monotonic `seq` on the way out so late or
duplicated frames can be ordered.

Full redacted snapshot on every state change — **no deltas**. At 8 players a snapshot is under
3KB, and deltas would buy nothing but an entire class of desync bugs.

`PROTOCOL_VERSION` lives in `packages/protocol`. A mismatched client is told to reload. This is
not optional: deploys change the protocol and stale phones on a coffee table are the normal case.

**The schemas are a separate entry point.** `@ud/protocol` exports types only; the zod validators
live in `@ud/protocol/validate`, which the server imports and the clients do not. When they were
in the same module, every phone at the party downloaded the server's validator — 19KB gzipped of
code that can only ever run on the other end of the socket. `validate.ts` carries a compile-time
assertion that its schema output still matches the hand-written `ClientMsg`, so the two cannot
drift apart silently.

---

## 7. No database

Game state is in memory and dies with the room. There are no accounts, no PII, and nothing worth
persisting — which is also the entire data-protection story.

Content is files in the repo:

```yaml
# content/prompts/in.yaml
- id: in-0001
  text: The worst thing to say in a job interview
  level: 2                    # 1 HR approved · 2 medium roast · 3 Burn in Hell
  lang: en
```

`content/fallbacks.yaml` holds the deliberately pathetic auto-fill answers — `2n` shows
*"(stared at the phone until time ran out)"* and notes it can still win the matchup, so these are
game content, versioned alongside prompts.

`bun run content:check` runs in CI: zod validation, unique ids, no duplicate normalised text,
length ceiling (~80 chars — a prompt has to survive `2h` at 19px on a phone), slur wordlist.
Everything is CC0 so the licensing story stays trivial.

**Deck size:** a game needs `2n + 1` prompts. At 8 players that is 17. A region/level combination
needs roughly 60+ prompts before repeat sessions stop feeling stale.

**Room codes** are 4-letter dictionary words from a curated, profanity-filtered list — `GRUB` in
the mockups, and the idle screen jokes about the B being upside down. Words are easier to read
across a room and to retype than random letters. Fall back to random strings if the pool ever
runs more than half occupied.

---

## 8. The clay system

Every mockup — Doug, the tiles, the podium, the vote pellets, the confetti — is divs with uneven
`border-radius`, an inset top highlight, an inset bottom occlusion, a hard offset shadow, and
±1–2° rotation. **There is not one image asset in the entire design.**

That is a project rule, not an observation: *if a component needs a PNG, it is designed wrong.*
It gives us free responsiveness across the "don't assume 16:9" constraint, tiny bundles for the
low-end Android, and nothing to license.

`packages/clay` ships:

- `tokens.css` — the palette and motion tokens from direction sheet `1a`, verbatim.
- `clay.css` — the `.clay` material rule, driven by custom properties.
- `keyframes.css` — `ud-bob`, `ud-rock`, `ud-winflip`, `ud-loseflip`, `ud-pellet`, `ud-pts`,
  `ud-tag`, `ud-fall`, `ud-pop`, `ud-crownbounce`, `ud-timer`, `ud-look`, `ud-blink`, `ud-dots`.

```css
--ud-table: #F0E9DB;  --ud-ink:    #40352C;
--ud-brick: #CE6A50;  --ud-slate:  #7E97B8;
--ud-butter:#EFC75E;  --ud-sage:   #88A386;
--ud-lift:  0 9px 0 rgba(64,53,44,.16);
--ud-step:  steps(3, end);
--ud-beat:  240ms;
```

### Motion

No Framer Motion, no GSAP, no spring library. Stop-motion is keyframes on twos and spring
interpolation is its exact opposite — a physics library would actively fight the aesthetic. CSS
keyframes with `steps()` carry everything; the Web Animations API is used only where sequencing
depends on runtime data, such as vote pellets landing one per voter.

> **Implementation trap:** the "handmade irregularity" is per-element random radii and rotation.
> If that randomness is computed during render, every React re-render reshapes every element and
> the whole screen shimmers. Derive it deterministically from a stable seed —
> `useClayShape(seed)` returning CSS custom properties.

`prefers-reduced-motion` keeps the *meaning* and drops the *travel*: the loser still ends up
upside down, it simply arrives there instead of tumbling. Stripped, but still intentional.

Performance floor is a low-end Android and a five-year-old laptop: animate only `transform` and
`opacity`, use `will-change` sparingly, and cap particle counts with a runtime probe.

### Sound

Stage only — phones stay silent. The approved synthesized palette plays through Web Audio,
unlocked by the stage's own Enable sound button, not the host's phone. Mute stops active
sounds; volume starts at 0.18. Playback is driven by live sound messages, not snapshots, so
reconnects never replay old cues. Hidden/disconnected stages stop playback; minor-event
bursts are coalesced and capped. The player is disposed when leaving the room.
`content/sound-brief.md` records the approved palette and remaining physical-speaker QA.

---

## 9. Testing

| Layer | How |
|---|---|
| `packages/engine` | Vitest units per transition, plus property tests on the pairing invariants |
| Redaction | Full-game walk asserting no pre-reveal authorship in any serialised payload |
| Screens | Every stage and phone screen rendered against views a real game produced |
| `tools/botgame` | N bots over real sockets, real server, full game to `winner` — runs in CI |
| `e2e/` | Cypress: a real browser tapping real controls, against the built app |
| Fuzz | Bots that submit late, double-vote, and send garbage *(not yet written)* |

### Browser tests

Cypress gives one browser context per test; the game needs three players and a television before
it will do anything. So the browser plays **one seat for real** and `e2e/tasks.ts` seats the rest
over the same WebSocket a phone uses — the room genuinely has four participants, they are simply
not all rendered. One spec drives the phone, another drives the stage, so both surfaces get real
browser coverage. Playwright would do this with multiple contexts instead; Cypress plus bots gets
there without fighting the tool.

They run against the **built** app served by the real Bun server, not the Vite dev server. The
production artefact and the production routing are part of what is being tested — `/stage` serving
the phone was a real bug, and a dev server with different routing would not have caught it.

Phases run on server clocks, so the specs never assume a fixed sequence: they read
`body[data-phase]` and act on whatever screen they find. Every phase clock is individually
settable by environment variable so the E2E run can be slow enough to type into and still finish
in a couple of minutes.

The screen tests get their fixtures from `packages/engine/test/drive.ts`, which plays a real game
and samples one `ClientView` per phase, per seat. Nothing is hand-written, so a change to the
projection breaks the screens that depend on it rather than drifting away from them. Sampling is
explicit rather than automatic, because *when* in a phase you look changes what the screens get —
the lobby is only interesting once everyone has arrived, and the writing phase only before anyone
has submitted.

---

## 10. Milestones

- **M0 — skeleton.** ✅ Workspaces, protocol, tokens, clay CSS, stage and phone shells, health check.
- **M1 — vertical slice.** ✅ Lobby → write → vote → reveal → scoreboard → winner. One round, one
  deck, no regions. Server timers, per-recipient redaction, reconnect, bot game in CI. The round
  loop is written for N rounds and tested at three; only the finale phase is missing.
- **M2 — full game.** ✅ Three rounds, the finale with its own ballot and reveal, scoring config,
  sweep, winner.
- **M3 — content.** Regions, levels, the live phone/stage setup screen, fallbacks and CI lint
  are implemented. Regional prompt pools still need expanding to the 60+ target.
- **M4 — polish.** All 17 screens to mockup fidelity, Doug's pose set, sound, reduced motion, edge
  states.
- **M5 — ship.** Dockerfile, deploy, README, CONTRIBUTING, QR, domain.

---

## 11. Open questions

Flagged, not blocking. M1 does not depend on any of them.

1. **8 players, 4 player colours.** The palette offers brick, slate, butter and sage. The
   accessibility floor also forbids meaning carried by colour alone. Proposal: give each seat a
   distinct clay *silhouette* as a second identity dimension, so 4 colours × shapes covers 8 and
   satisfies the floor at the same time. Needs a design call.
2. **How much should the finale be worth?** The mockups disagree with each other on scoring — `2c`
   shows +1200/+800/+400/+0, `1e` shows four votes paying +800 — so everything lives in
   `EngineConfig` and the finale's rate is *derived* rather than fixed (see `finalePointsPerVote`,
   and the note there on why a flat rate made the finale worth 25% of the game at eight players
   and 79% at three).

   With that fixed, multipliers of 1:2:3 put the finale at 50% of the game by construction, and
   bot games measure a mean swing of 49% / 38% / 66% at three, five and eight players — the spread
   is variance plus the fact that the winner is usually whoever won the finale, not a remaining
   scaling bug. Whether half the game is the *right* weight for a "triple stakes" round is a play
   question, not an arithmetic one. The lever is `roundMultipliers`: dropping the finale to `2`
   would put it at 40%.
3. **Audience vote weight.** The audience is unlimited and can swamp 8 players. Does a "clean
   sweep" mean all voters, or all player-voters? Affects the biggest beat in the game.
4. **Deploys drop live rooms.** True on any runtime without persist-and-rehydrate. "Don't deploy
   on a Friday night" is a legitimate answer for a party game — but it should be a decision.
5. **Host's phone dies mid-game.** Auto-migration is specified above; whether the room should
   survive at all with no host is not.
