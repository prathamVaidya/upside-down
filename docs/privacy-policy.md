# Upside Down privacy policy

Last updated: September 11, 2026

Effective date: September 11, 2026

## The short version

Upside Down is a multiplayer party game. We process the information needed to run your
room and use diagnostics to fix errors and understand how people play. **When configured,
browser diagnostics are on by default**, including session replay and error tracking.
You can turn browser diagnostics off through **Privacy & diagnostics → Turn off diagnostics**.

Recordings show all page text and inputs without masking, including room codes, game prompts,
names, submitted answers and unfinished drafts. Please do not put sensitive or personal information about
yourself or other people into answers: submitted text can still contain such information.

## Information used to run the game

The server processes room codes, nicknames, seat/reconnection identifiers, submitted answers,
votes, scores, game settings and connection status. Other participants see information through
the game's screens—for example, answers during voting and authors at reveal.

Live room state is held in server memory, not a game database, and is lost when a room is
destroyed, expires or the server restarts. This does not delete diagnostic records already
sent to our providers. Browser storage remembers your room, reconnection token and diagnostic
preference; PostHog also uses browser session storage for diagnostic/session identifiers.

## Browser diagnostics: PostHog

When enabled, PostHog receives a reconstruction of the game page and interactions, frontend
errors, and technical context such as browser/device information and timestamps. This is a
page replay, not a recording of your camera, microphone, other apps or entire device screen.

We attach room and game IDs, room code, random room-local player ID, stage/phone role, round,
phase and matchup markers. These let us find the separate stage and player replays for a game.
They are pseudonymous identifiers, not a guarantee that gameplay cannot identify someone.

Page text, input values, accessible labels and HTML attributes are recorded without masking.
This includes drafts before submission, nicknames, questions, submitted answers and UI labels.
Do not enter passwords or other secrets into the game: input masking is disabled.
Reconnection tokens are not deliberately added to diagnostic events or UI elements.
Console logs, network request bodies/headers, canvas recording and cross-origin iframe
contents are excluded. Exception messages are redacted; error types and stacks remain.
URL query strings and fragments are removed from captured URL fields.

Readable recordings start automatically under the default-on setting; this is not evidence
that each player actively clicked an agreement. There is no room-wide answer-masking gate.
Turning off your diagnostics stops recording your browser, but content already shared in
the game may still be recorded on another player's or stage screen. It does not turn off
other browsers' diagnostics or mask their screens. Avoid sharing sensitive information.

## Backend diagnostics: Axiom

When configured, Axiom receives structured operational events: room/game IDs and codes,
random player/connection identifiers, player counts, game settings, phase transitions,
submission/voting activity, result totals and scores, host transfers, timing, completion
and closure reasons, errors and deployment information. Answer text, nicknames, reconnection
tokens and complete room snapshots are excluded from these events.

The browser diagnostics switch and Do Not Track apply to PostHog, not these server-side
operational logs. Hosting infrastructure also processes connection information necessary
to deliver the service; our application-level masking does not prevent providers from
receiving IP addresses as part of network transport.

## Your controls

- Open **Privacy & diagnostics** and select **Turn off diagnostics** to stop future PostHog
  recording/capture in that browser. Existing saved opt-outs are preserved across updates.
- Recognized Do Not Track signals disable browser diagnostics. If preference storage is
  inaccessible, the app does not start browser diagnostics.
- Select **Enable diagnostics** to re-enable it, unless Do Not Track is active.
- Preferences are browser/site-specific. Another browser or device has its own preference.
  Clearing site storage removes the saved choice and restores the default-on behavior.
- Stopping recording does not delete earlier uploads, or remove content already recorded
  on other participants' screens. Changes reach other screens through the live connection.

The game remains playable with browser diagnostics disabled. Recording is unavailable in
unconfigured builds, and ordinary development builds do not enable PostHog recording.

## Providers, purpose and retention

We use Railway for hosting, PostHog for browser diagnostics, and Axiom for server diagnostics.
The intended uses are operating/debugging the game, understanding gameplay and improving it.
Game participants see content needed to play. Diagnostic records are intended for authorized
operators, not public sharing of player replays.

Provider processing depends on the operator's account settings and agreements. See
[PostHog's privacy policy](https://posthog.com/privacy) and
[Axiom's privacy policy](https://axiom.co/docs/legal/privacy). Review those agreements and
settings rather than assuming the application's masking controls cover every provider use.

We retain PostHog session recordings and diagnostic events, and Axiom operational logs, for
up to **90 days**. Retention is managed through provider settings rather than the game server's
in-memory room lifecycle. Turning off diagnostics does not immediately delete existing records;
you can contact us about deletion using the address below.

Our providers may process information outside your country. Axiom uses a US East ingestion
endpoint; PostHog and Railway processing locations depend on the service configuration and
provider infrastructure. The provider policies linked above describe their practices.

## Questions and privacy requests

**Operator:** Pratham Vaidya

**Privacy contact:** [iamprathamvaidya@gmail.com](mailto:iamprathamvaidya@gmail.com)

Use that private contact for questions or applicable access/deletion requests. Include an
approximate game date/time and room code if available, but never send a reconnection token.
Do not post personal answers or private replay links in public GitHub issues. Requests may
require enough information to locate the relevant records and verify the requester.

## Changes

We will update this page when our practices change and revise the date above. Where required,
we will provide additional notice or obtain consent before applying material changes.
