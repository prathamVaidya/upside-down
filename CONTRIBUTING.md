# Contributing

## Getting it running

```sh
bun install && bun dev
```

Landing page on http://localhost:5173, big screen on http://localhost:5173/stage, phones on http://localhost:5173/play. Those are the same
URLs production uses. That is the whole setup — if you needed anything else, that is a bug in this
file.

## The rules that matter

A few constraints hold this project together. Everything else is negotiable.

**No image assets.** Every visible object is CSS: uneven `border-radius`, an inset highlight, an
inset occlusion, a hard offset shadow, a degree or two of rotation. If a component seems to need a
PNG, it has been designed wrong. This is what keeps the product responsive across unpredictable TV
aspect ratios, small enough for a bad phone connection, and free of licensing questions.

**No animation library.** Stop-motion is `steps()` keyframes on twos. Spring interpolation is its
exact opposite, so a physics library would fight the aesthetic rather than help it. Add keyframes
to `packages/clay/src/keyframes.css`.

**Derive irregularity from a seed, never from `Math.random()` in render.** `useClayShape(seed)`
exists because random radii computed during render make the entire screen shimmer on every
re-render, and a countdown re-renders four times a second.

**The engine stays pure.** No `Date.now()`, no `Math.random()`, no imports with side effects in
`packages/engine`. Time and content arrive through `Ctx`; randomness lives in `state.seed`. This
is what makes a whole game runnable in a unit test, and what makes a reported bug replayable.

**Clients never import the engine.** They render `ClientView` and nothing else. If a screen needs
to know a rule, the rule is missing from `project()` and belongs on the server.

**Redaction is not a UI concern.** Authorship before the reveal, other players' prompts, who voted
for what — none of it may cross the wire. `packages/engine/test/redaction.test.ts` walks a whole
game asserting it does not. If you add a field to `ClientView`, think about who receives it.

## Adding prompts

The easiest useful contribution, and no programming needed. See the README — one line in
`content/prompts/<region>.yaml`, then `bun run content:check`.

Voice: dry, a little rude, never cutesy. The jokes belong to the players; a prompt that is already
funny leaves them nothing to do. Prompts are fragments, not sentences.

## Before opening a PR

```sh
bun run content:check
bun run typecheck
bun run lint
bunx vitest run
```

If you touched anything in `apps/server`, `packages/engine` or `packages/net`, also play a game:

```sh
UD_FAST=1 bun apps/server/src/index.ts &
bun run bots -- --players 8 --drop
```

And if you touched a screen, run it in a real browser:

```sh
bun run e2e          # headless
bun run e2e:open     # watch it
```

E2E specs address the UI through `data-testid`, never through copy. Copy is the part of this
product most likely to change, and a test that breaks when a joke gets funnier is a bad test. The
one exception is copy that *is* the behaviour under test — "authors hidden until reveal" earns a
`cy.contains`, because that sentence is the promise being checked.

## Interface copy

Sentence case. No exclamation marks in system messages. Second person, present tense, active
voice. No "please", no "oops", no "successfully". Errors say what happened and what to do next.
Waiting screens are where the personality goes, because nothing else is happening there.

Every timer needs a word next to the number so it is obvious what is running out. `Countdown`
enforces this by requiring the `word` prop.
