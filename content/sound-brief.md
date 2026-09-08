# Sound effects — approved palette

Status: Direction A approved by the user; integrated on the stage through `StageAudio`.

Open `design/sound-preview.html` in a browser for eight individually playable synthesized
sketches. No dependencies, external recordings, automatic playback, or game sockets.

## Direction A

Small clay pops, muted wooden knocks, and a papery flip. Warm and tactile, not a casino or
an arcade. These are synthesized approximations, not recorded Foley. No background music.

- `join`: a friendly pop, about 140 ms.
- `start`: three rising knocks, about 500 ms.
- `submit`: a muted tap, about 80 ms.
- `vote-land`: a tiny pellet click, about 45 ms; the quietest cue.
- `flip`: a short swish followed by a soft thud, about 250 ms.
- `sweep`: an upward wobble and chunky finish, about 610 ms.
- `round-end`: two descending notes, about 650 ms.
- `winner`: a toy-instrument fanfare and final plop, about 1.2 seconds.

## Review

The user approved the playable preview before integration. Keep its pitch, envelopes,
and timing as the reference when changing the production implementation.

## Playback

Stage only; phones stay silent. Enable sound on the stage itself: the host's phone tap
cannot unlock a different browser's AudioContext. Sound starts off after each page load.
Mute stops current sounds, and volume defaults to the preview's 0.18 (maximum 0.5).
Minor cues are coalesced within 80 ms and limited to six active sources; major cues replace
current sounds. Hidden/disconnected stages stop sounds and never replay missed events.
Physical TV/speaker listening at party volume remains a manual check.
