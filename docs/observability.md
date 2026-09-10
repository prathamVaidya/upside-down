# Production observability

Two independent integrations, disabled without configuration:

- **Axiom:** structured backend game events. No Redis or database is required.
- **PostHog:** browser errors (including React root errors) and masked session replays on
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

The queue holds at most 500 events, sends up to 100 every two seconds, and times out after
three seconds per batch. Overflow/failed deliveries are counted in the exporter's local
`stats()`; they are dropped, not retried indefinitely. SIGTERM attempts a bounded drain.
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
5. Play a test game and check Session Replay. On a staging/test build, trigger a deliberate
   JavaScript error and verify it appears in Error Tracking with a session link.

All DOM text and inputs are masked, including rendered player names and answers. Accessible
labels, titles, alt text, values and data attributes are redacted too. Hidden/file
inputs and iframes are blocked. Console capture, request bodies/headers, canvas capture,
autocapture, page views and performance capture are disabled. URLs have query strings and
fragments removed, and `/r/CODE` is redacted. Exception messages are redacted because they
may contain player input; exception types/stacks are retained. Do Not Track is respected.
No player identity or reconnect token is passed to PostHog.

Recordings therefore show layout and interaction, not the actual jokes or names. Avoid adding
user text to HTML attributes or error stack metadata. Any new capture fields need a privacy
review. Set recording sampling/retention and billing limits in PostHog before production use;
this code does not enforce account quotas. Review the site's privacy notice before enabling.

Source-map upload is not configured yet: production stack locations may be minified. Set up
private release/source-map upload in CI if readable production source locations are needed.

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
