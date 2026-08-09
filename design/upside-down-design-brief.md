# Upside Down — design brief

A brief for a design agent. It defines the product, the screens, and the direction. It deliberately does not specify exact colour values, typefaces, or motion curves; those are the design decisions being commissioned.

---

## 1. What we are building

**Upside Down** is a free, open-source party game for 3 to 8 players, plus unlimited audience.

Everyone is in the same room (or the same video call). One person opens the game on a big screen — a TV, a laptop lid flipped around, a shared Zoom window. Everyone else joins on their phone with a 4-letter room code. No app install, no account.

The game asks players to be funny. It shows a prompt, two people write an answer to it, and everyone else votes on which answer is funnier. That's it. The whole product is a delivery mechanism for that moment where six people read two answers and one of them makes the room laugh.

It is a direct alternative to a well-known paid party game. It must not resemble that game visually.

### The loop

1. **Lobby.** Players join, pick a name, wait. Host sets region and content level, then starts.
2. **Writing.** Every player receives 2 prompts on their phone, one at a time, and types a short answer to each. 60 seconds. The big screen shows who has finished.
3. **Voting.** One prompt at a time, the big screen shows the prompt and the two answers. Everyone except the two authors votes on their phone. 20 seconds.
4. **Reveal.** Votes appear, authors are named, points are awarded.
5. Repeat 3–4 for every matchup, then show the scoreboard.
6. Three rounds. Round 1 is normal, round 2 is double points with reshuffled opponents, round 3 is a finale where everyone answers the same prompt and voters split three votes between all answers.
7. **Winner.**

A full game runs 12 to 18 minutes.

### Pairing

Each player answers exactly 2 prompts. Each prompt is answered by exactly 2 players. With `n` players there are exactly `n` matchups per round. Opponents reshuffle between rounds.

### Regional prompts

This is the feature that distinguishes the product. The prompt library is tagged by region and language, so a room in India gets prompts about auto drivers and family WhatsApp groups, and a room in the UK gets different ones. The host picks a region when creating the room, and the deck mixes region-specific prompts with globally-applicable ones. Prompts are community-contributed and public domain.

The design needs to make region a visible, appealing choice at room creation — it is the reason someone picks this over the alternatives — without turning it into a settings screen.

---

## 2. Who it is for

Groups of friends, aged roughly 18–35, playing at someone's flat or over a call, usually a few drinks in, usually with at least one person who has never played before and is being handed a phone.

That last person is the design constraint that matters most. Someone joins mid-game, is handed a link, and must understand what to do in under five seconds without anyone explaining it.

---

## 3. Creative direction

### The name is the motif

**Upside Down.** Inversion, flipping, rotation, reversal. Use it. The most obvious application: answers reveal by rotating rather than fading, and losing answers stay upside down on the scoreboard. There will be better applications than that one — find them. The name should feel earned by the interface, not just printed on it.

### The material: claymation

The chosen aesthetic direction is **soft clay, stop-motion, pastel**. Think Aardman, Gumby, Sesame Street puppets, plasticine. Not neon, not dark mode, not "gamer."

What that means in practice:

- **Everything looks handmade and slightly imperfect.** No perfectly straight edges, no perfect circles, no elements that look laser-cut. Small irregularities are the point.
- **Objects have weight and volume.** Elements should read as physical things sitting on a surface, not as flat rectangles. The lighting model matters more than the colour choices.
- **Nothing is pure white or pure black.** Clay doesn't do either.
- **Soft, muted, warm.** Low saturation. The palette should feel like a nursery-school art table, not a candy shop. There is a real risk of this direction reading as childish — the guard against that is restraint in the palette and adult, slightly mean humour in the copy.
- **Texture over gloss.** Matte, slightly grainy surfaces. Fingerprint imperfection rather than plastic sheen.

Choose the specific palette, faces, and construction technique. The one thing to avoid is a look that could equally be a meditation app: it needs to be soft *and* loud.

### Motion is half the product

In this direction, motion is not polish applied at the end — it is the primary carrier of the aesthetic. Stop-motion has a specific feel: weight, squash and stretch, overshoot, settle, wobble. Elements should never fade in or slide linearly.

Consider deliberately reduced frame rates in places. Real stop-motion animates on twos or threes, and that slight staccato is instantly recognisable. Used selectively, it could be the signature.

Key moments that deserve real animation attention:

- An answer card landing on the big screen
- A vote arriving (a vote should be a physical object that travels and lands, not a number that increments)
- The reveal flip
- A unanimous sweep — this is the biggest emotional beat in the game and should be genuinely over the top
- The round transition
- Phone submit — the button should deform under the thumb

Respect `prefers-reduced-motion` with a version that still feels intentional rather than stripped.

### A character

We want a mascot made of the same material as the interface — it appears on the big screen and reacts to what's happening. Idle in the lobby, watching while people write, reacting to a landslide vote, upside down when a round ends.

This is the cheapest personality-per-unit-of-effort in the whole product and probably the thing people remember. Design it as a small set of poses and reactions rather than a rigged character.

---

## 4. Two surfaces, two jobs

The most important structural decision: **the big screen and the phone are not the same design.**

**The big screen is a stage.** Everyone is looking at it. It carries the whole aesthetic — the character, the motion, the texture, the sound. It is read from three metres away by people who are not concentrating. Type is large, one idea on screen at a time, no small print. It should look good in the background of a photo.

**The phone is a remote control.** Nobody is looking at it for longer than they have to; they glance down, act, and look back up at the TV. It should be almost aggressively simple: one huge input, one huge button, no chrome, no navigation, thumb-reachable. It should share the material vocabulary with the big screen so it clearly belongs to the same product, but it should not compete for attention.

If a phone screen is interesting to look at, it is wrong.

---

## 5. Screens to design

### Big screen

1. **Idle / room code.** Shown before and during joining. This screen is on a TV in someone's living room for several minutes, and it is what people photograph and post. It should be the best-looking thing we make. Needs: room code (legible across a room), join URL, list of players as they arrive, a way to feel alive rather than static while waiting.
2. **Room setup.** Host picks region and content level. Must feel like part of the game, not a settings panel.
3. **Writing phase.** Shows the countdown and who has submitted. This is 60 seconds of essentially nothing happening — it needs to hold attention without distracting people who are typing. Good place for the character.
4. **Voting.** Prompt at the top, two answers side by side, timer, vote counts appearing live. The two answers must feel like equals — no visual bias toward one side.
5. **Reveal.** Votes settle, authors named, points awarded. Staged, not simultaneous.
6. **Sweep.** The special case where one answer takes every vote. Its own celebratory treatment.
7. **Scoreboard.** Between rounds. Ranked players with score deltas.
8. **Finale round.** Same prompt for everyone, `n` answers on screen at once (up to 8), voters distributing three votes. The hardest layout in the game — it must stay readable at 8 answers.
9. **Winner.** The final beat. Should be worth waiting fifteen minutes for.

### Phone

10. **Join.** Enter code, enter name. First thing a new player sees.
11. **Lobby / waiting.** Includes the host's start control for the host only.
12. **Writing.** Prompt, text input, submit. Handles 2 prompts in sequence. Must show remaining time without inducing panic.
13. **Submitted / waiting.** Between actions. Should reassure, not go blank.
14. **Voting.** Two answers as two large tappable targets.
15. **Sitting out.** Shown to the two authors during their own matchup. An opportunity for personality rather than a dead screen.
16. **Finale voting.** Distributing three votes across many answers on a small screen.
17. **Disconnected / rejoining.** It will happen. It should be calm and it should not look like an error.

### States that are easy to forget

- Empty lobby (host alone, one player joined, waiting for a third)
- A player who ran out of time and submitted nothing
- A player who disconnects mid-round
- Audience members, who watch and vote but never write
- Room code expired or not found
- The very first screen a person sees when a friend sends them a link with no explanation

---

## 6. Copy

The interface is a character and it should have a voice: dry, a little bit rude, never cutesy. It is a comedy product, so flat functional copy reads as a missed opportunity — but the jokes belong to the players, and interface copy that tries too hard steals the room's attention.

Rules:

- Sentence case, no exclamation marks in system messages
- Second person, present tense, active voice
- No "please," no "oops," no "successfully"
- Errors say what happened and what to do next, in the game's voice
- Waiting screens are the place to spend personality
- Every timer needs a word next to the number so it is clear what is running out

Non-submissions are auto-filled with deliberately pathetic placeholder answers so the round never has a dead matchup. Writing those is a copy task and they should be funny.

The name of the product, the round names, the scoring language, and the winner announcement all need to be written, not defaulted.

---

## 7. Constraints

- Web only. Big screen is a desktop browser; phone is mobile Safari and Chrome. No native app.
- The big screen is frequently shown through screen-share and video compression. Thin lines, subtle contrast, and fine texture will not survive. Design for a compressed 720p stream as well as a crisp display.
- Big screen aspect ratios vary widely, including a laptop turned sideways on a coffee table. Do not assume 16:9.
- Phone layouts must work one-handed, thumb-reachable, with a software keyboard open covering half the screen during the writing phase.
- Assume a low-end Android phone and a five-year-old laptop. Motion must degrade gracefully.
- Accessibility floor: visible focus states, adequate contrast (this direction makes low contrast tempting — resist it), reduced-motion support, no meaning carried by colour alone.
- Open source. Assets need to be either originally created or clearly licensed, and the system needs to be documentable so contributors can extend it.

---

## 8. Deliverables

1. **Direction.** Palette with named roles, type pairing, the lighting and material model that makes the clay read, and one signature element the product will be remembered by.
2. **The signature moment**, animated. Pick the beat you think carries the product — probably the reveal or the sweep — and show it moving. Everything else can be static.
3. **Screens**, big screen and phone, covering section 5.
4. **The character**, with its reaction set.
5. **Motion spec.** Timing, easing, and the stop-motion rules. Enough for an engineer to implement without guessing.
6. **Sound brief.** Not the audio itself, but a description of what each moment sounds like. Sound carries an unusual amount of this direction and cannot be an afterthought.
7. **Tokens.** Documented and named, ready to become a CSS variable file.

---

## 9. How we will judge it

- Does the idle screen make someone want to photograph the TV?
- Can a person who has never played submit their first answer without being told how?
- Is it readable from three metres, through video compression, by someone who is not paying attention?
- Does it look like clay, or does it look like a flat UI with round corners?
- Does the humour live in the copy and the motion rather than in decoration?
- Would this be recognisable at a glance as not the game it competes with?
