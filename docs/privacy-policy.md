# Upside Down privacy policy

Last updated: September 11, 2026

> Publication draft: describes the default-on diagnostics implementation. Before publishing,
> the operator must supply a legal identity, private contact address, effective date,
> actual retention periods and processing locations, and review applicable consent requirements.
> This repository document is not yet a published in-app policy or a claim of legal compliance.

## The short version

Upside Down is a multiplayer party game. We process the information needed to run your
room and use diagnostics to fix errors and understand how people play. **When configured,
browser diagnostics are on by default**, including session replay and error tracking.
You can turn browser diagnostics off through **Privacy & diagnostics → Turn off diagnostics**.

Recordings can show room codes, game prompts and submitted answers. Names and unfinished
drafts are masked in recordings. Please do not put sensitive or personal information about
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

Only specifically marked room codes, prompts and eligible submitted answers are readable.
Other display text, player names, input values and unfinished drafts are masked. Accessible
labels and selected HTML attributes are redacted. Reconnection tokens are not deliberately
sent to PostHog. Console logs, network request bodies/headers, canvas recording and iframe
contents are excluded. Exception messages are redacted; error types and stacks remain.
URL query strings and fragments are removed from captured URL fields.

Submitted answers are readable in stage and player replays only while every player seat
reports diagnostics enabled. This can happen automatically under the default-on setting;
it is not evidence that each player actively clicked an agreement. A player's opt-out or
disconnect makes subsequent answer snapshots masked throughout the room. Reconnecting
clients resend their preference. A stage's setting cannot override a player's opt-out.

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
Game participants see content needed to play; diagnostic access should be restricted to
authorized operators. This document does not authorize public sharing of player replays.

Provider processing depends on the operator's account settings and agreements. See
[PostHog's privacy policy](https://posthog.com/privacy) and
[Axiom's privacy policy](https://axiom.co/docs/legal/privacy). Review those agreements and
settings rather than assuming the application's masking controls cover every provider use.

The application does not enforce a fixed retention period for exported logs or recordings.
The operator must configure retention/deletion and specify the actual periods here before
publication. The Axiom exporter targets the US East ingestion endpoint; PostHog's ingestion
region is configured by the operator. Hosting and provider storage/processing locations
must be confirmed before making location or international-transfer commitments.

## Questions and privacy requests

**Operator:** [add legal/operator name]

**Private privacy contact:** [add monitored email address]

Use that private contact for questions or applicable access/deletion requests. Include an
approximate game date/time and room code if available, but never send a reconnection token.
Do not post personal answers or private replay links in public GitHub issues. Requests may
require enough information to locate the relevant records and verify the requester.

## Changes

The operator should publish material changes before applying them and obtain consent where
required. A default-on setting and a policy document alone do not establish a lawful basis
for collection in every jurisdiction. Review this draft before using it as a public policy.
