# Production observability

Two independent integrations, disabled without configuration:

- **Axiom:** structured backend game events. No Redis or database is required.
- **PostHog:** browser errors (including React root errors) and selectively masked session replays on
  landing, phone, and stage. This is not a backend console-log exporter.

## Axiom setup

1. Create an Axiom dataset such as `upside-down`.
2. Create an ingest-only API token scoped to that dataset.
3. Set Railway runtime variables `AXIOM_TOKEN` and `AXIOM_DATASET` on the backend service.
   The exporter uses the US East edge endpoint `https://us-east-1.aws.edge.axiom.co`.
4. Deploy, create a room, join, and start a game. Filter the dataset by `room_code`.
   Use `room_id` to distinguish separate rooms that reuse the same four-letter code.

Events contain an event name, timestamp, deployment, room ID/code, round, previous/current
phase, player/connection counts, region/content level, outcome and duration. Deadline events
include lateness. Socket rejections include error codes. Room close events distinguish host
destruction from expiry. Reconnect tokens, player names, answer text, votes' raw payloads,
and complete room snapshots are never sent.

Lifecycle coverage also includes:

- `round.started`, `round.completed`, `phase.changed`, `voting.started`.
- `writing.completed`: auto-filled answer count and `timeout` vs `all_submitted`.
- `voting.completed`: missing votes among currently eligible connected voters (unspent
  vote units in the finale). A settle timer after all votes land is not labeled a timeout.
  Disconnected players are not counted as missing voters; connection events track their exit.
- `matchup.result`: prompt ID, matchup index, anonymous author IDs, vote totals, points,
  fallback count and sweep status. `finale.result` includes per-entry totals and points.
- `game.completed`, `game.ended_early`, `game.aborted`: completion/exit reason, elapsed
  game time (excluding the lobby), score summaries and, for ended games, winner IDs.
  Round completion includes elapsed round time through its last result, excluding the
  following scoreboard (or finale reveal) dwell time.
- `host.changed`: previous/new anonymous host IDs; emitted only when ownership changes.
- Connection open/attach/detach/close, socket send failures and handler errors. Connection
  IDs distinguish pipes; room-local seat IDs correlate players across reconnects. Stage,
  phone and unbound sockets are distinguished. Close codes are recorded, but arbitrary
  client-provided close reason strings are never logged.
- `room.closed` reasons: `host`, `idle_timeout`, `max_age`, `server_shutdown`.
- `server.started`, `server.stopping` (SIGTERM/SIGINT); shutdown records active-game aborts.

Derived lifecycle events share an `action_seq` and `trigger` with the action that caused
them. Group by `room_id` + `action_seq`; these are additional outcome records, not additional
player actions. `round`/`phase` describe the resulting state; `previous_round`/`previous_phase`
describe the input state. `connected_count` includes stages; `connected_player_count` does not.

The queue holds at most 500 events, sends up to 100 every two seconds, and times out after
three seconds per batch. Overflow/failed deliveries are counted in the exporter's local
`stats()` and public `/health.telemetry`: `enabled`, `queued`, `dropped`, `failedBatches`,
and `lastSuccessAt` (last fully successful batch, or null). Counters are process-local and
reset on restart. They contain no credentials. Health stays OK during an Axiom outage so
an observability failure does not restart healthy games. Failed batches are dropped, not
retried. SIGTERM/SIGINT attempt a bounded drain.
Abrupt crashes, SIGKILL and infrastructure loss cannot guarantee a final event or queue
delivery; correlate deployments and Railway process logs when a lifecycle ends without closure.
These are diagnostic logs, not an audit trail or room-recovery store.

Example query (replace the dataset name if necessary):

```apl
['upside-down']
| where room_code == 'COMB'
| order by _time asc
```

## PostHog setup

1. Create a PostHog project and enable Error Tracking and Session Replay.
2. Set Railway build variables:
   - `VITE_POSTHOG_KEY`: the **public project token**, not a personal API key.
   - `VITE_POSTHOG_HOST`: the project's ingestion host, such as `https://us.i.posthog.com`
     or `https://eu.i.posthog.com`.
3. Rebuild/deploy. Vite embeds these public values; changing runtime variables without
   rebuilding does not update the browser. Dockerfile build arguments are provided.
4. Open **Privacy & diagnostics** at the bottom left and choose **Allow diagnostics**.
   No PostHog SDK is loaded or events sent before consent. Withdrawal stops recording and
   opts out of capture. Consent is saved per browser; a separate machine must opt in separately.
   This version uses `ud.diagnostics.v2`: old opt-ins promising fully masked text do not count.
5. Play a test game and check Session Replay. On a staging/test build, trigger a deliberate
   JavaScript error and verify it appears in Error Tracking with a session link.

DOM text is masked by default. Only marked room codes, prompts, and consent-approved
submitted answers are readable. All inputs (including drafts and name fields) stay masked.
Player names remain masked even after reveal. Accessible
labels, titles, alt text, values and data attributes are redacted too. Hidden/file
inputs and iframes are blocked. Console capture, request bodies/headers, canvas capture,
autocapture, page views and performance capture are disabled. URLs have query strings and
fragments removed, and `/r/CODE` is redacted. Exception messages are redacted because they
may contain player input; exception types/stacks are retained. Do Not Track is respected.
No real player name or reconnect token is passed to PostHog. Random room-local seat IDs
are used as `player_id`; players are not merged into a shared PostHog identity.

Submitted answers become readable on stage and phones only after **every player seat**
opts in. Stage/audience consent cannot authorize other players' answers. The server broadcasts
only a room-wide visibility flag, not which anonymous answer belongs to a consenting author.
Withdrawal or disconnect masks future answer snapshots across the room; reconnect resends
current consent. Offline/older clients default to no consent. Already uploaded snapshots
are not retroactively redacted or deleted. Consent text explains this and the cross-screen use.
Answer nodes remount when visibility changes so the recorder receives freshly masked text.

Avoid adding
user text to HTML attributes or error stack metadata. Any new capture fields need a privacy
review. Set recording sampling/retention and billing limits in PostHog before production use;
this code does not enforce account quotas. Review the site's privacy notice before enabling.

Source-map upload is not configured yet: production stack locations may be minified. Set up
private release/source-map upload in CI if readable production source locations are needed.

### Find all replays for a game

The server supplies an immutable `room_id` and a random `game_id` when play starts. Both
match Axiom event fields. Room codes are reusable, so filter by the IDs for an exact game.
Browser events carry `room_id`, `room_code`, `game_id`, anonymous `player_id` (null for stage),
`app_surface`, `round`, `phase`, and `matchup_number`. `game.replay_context` marks entry and
phase/round/matchup changes; `server_time_ms` provides a server-clock reference. Repeated
broadcasts do not create duplicate markers. Consent given mid-game captures the current context,
not pre-consent history. Exit clears properties and emits `game.replay_left` with null IDs.

In PostHog Session Replay, filter for sessions with the `game.replay_context` event and its
`game_id` property (or `room_code` to discover games). Separate stage/phone recordings using
`app_surface`; use `player_id` to find a player's reconnect sessions. One browser may visit
several rooms, so use event properties rather than treating the entire session as one game.
You can save the selected recordings together for review. This is correlation, **not** a merged
or synchronized multi-screen player; no custom viewer is included. Recordings only exist for
consenting browsers that successfully upload and pass the project's recording rules/sampling.

## Local verification

Unit tests mock ingestion and the PostHog SDK; they send no data to external accounts.
Production-only PostHog initialization means normal `bun dev` sessions aren't recorded.
For a local browser smoke check, build with a test project's public variables and opt in.
Do not put `AXIOM_TOKEN` in browser variables or commit real credentials.
CI also builds with a fake public token and intercepts the provider to exercise consent.
For an intentional **live** check against your configured project, run the built app locally
and use `UD_E2E_PORT=3487 bunx cypress run --spec e2e/specs/telemetry-live.cy.ts --env liveTelemetry=true`
(adjust the port to your test backend). This sends synthetic error/replay data, is skipped by
default in CI, and simulates a normal Chrome user-agent because PostHog filters automated browsers.
When using local env files, put browser variables in the workspace `.env` or `.env.local`, or export them
in the shell before `bun run build`. The root `.env.example` lists both services' variables.

References: [Axiom ingestion](https://axiom.co/docs/restapi/ingest),
[PostHog replay privacy](https://posthog.com/docs/session-replay/privacy),
[PostHog web errors](https://posthog.com/docs/error-tracking/installation/web).
