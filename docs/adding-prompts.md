# How to add prompts

Prompts are the setups players answer in Upside Down. You only need to edit a YAML file—no changes to the game code are needed for the existing regions.

## Quick start

1. Pick a file in [`content/prompts/`](../content/prompts/).
2. Add an entry under its existing `prompts:` list, using an unused ID.
3. From the repository root, run `bun run content:check`.
4. Open a pull request with your changes and the check result.

For example, an entry in `content/prompts/in.yaml` could look like this:

```yaml
  - id: in-019
    level: 1
    text: "A terrible feature for a new auto-rickshaw"
```

The ID above is illustrative: check the current file before using it. Keep existing entries and the file's `region:` and `prompts:` keys.

## Choose a region

- [`global.yaml`](../content/prompts/global.yaml): setups that work without country-specific knowledge. Use the `g-` ID prefix.
- [`in.yaml`](../content/prompts/in.yaml): India-specific references. Use `in-`.
- [`uk.yaml`](../content/prompts/uk.yaml): UK-specific references. Use `uk-`.
- [`us.yaml`](../content/prompts/us.yaml): US-specific references. Use `us-`.

A regional deck includes its own prompts **plus global prompts**. A global room gets only global prompts. Put a broadly relatable idea in `global.yaml` once, rather than copying it into several regional files.

The file's top-level `region` determines the region; each individual prompt only needs `id`, `level`, and `text`. Adding a new region requires changes to the protocol and application as well as content—an extra YAML file alone is not enough.

## Choose a level

The existing level names are:

- **1 — HR approved:** keep the setup suitable for a broad audience or coworkers.
- **2 — medium roast:** allow more awkward, personal, or pointed setups.
- **3 — Burn in Hell:** reserve for the most provocative setups, intended for friends comfortable with that tone.

Levels are cumulative: a level 2 room can draw levels 1 and 2; a level 3 room can draw all three. The level describes the prompt, not a guarantee about what players will write.

## Write a setup, not the punchline

Give players room to invent several different answers. A reader should understand the situation immediately, without an explanation from the host.

Good shapes include “A terrible name for…”, “The real reason…”, and “What … is thinking”. For example:

```text
A terrible feature for a new auto-rickshaw
The least useful button on a spaceship
```

Avoid supplying the joke yourself, such as “An auto-rickshaw with a passenger eject button”. That is already an answer. Avoid trivia with one correct answer, long explanations, and references so narrow that most of the room cannot participate.

Keep the voice dry, conversational, and a little rude. Do not use slurs. The automated wordlist is only a basic check; passing it does not replace editorial judgment.

## Follow the file format

Each prompt has three fields:

- `id`: globally unique across all prompt files. The schema accepts 1–3 lowercase letters, a hyphen, and exactly three digits, such as `g-042` or `in-019`. Follow the file's prefix and choose the next unused number. Do not renumber existing prompts.
- `level`: the number `1`, `2`, or `3`, without quotes.
- `text`: 8–80 characters after trimming whitespace, including spaces and punctuation. Start with a capital letter. Do not end with `.`, `!`, or `?`; prompts are fragments.

Both the multiline format above and the compact format used in most existing files are supported:

```yaml
  - { id: in-019, level: 1, text: "A terrible feature for a new auto-rickshaw" }
```

Use one format or the other for an entry, not both. Indent with spaces, not tabs. Quoting the text avoids YAML treating a colon, hash, or other punctuation as syntax. Escape double quotes inside a double-quoted string:

```yaml
    text: "What the landlord means by \"a small deposit\""
```

## Validate your changes

Install dependencies once, then run the content check from the repository root:

```sh
bun install
bun run content:check
```

The check validates the YAML schema, IDs, text length, capitalization, ending punctuation, duplicate text, and the banned-word list. It also checks deck depth, fallback answers, and room-code words.

Common failures:

- **Duplicate ID:** choose an unused ID; do not rename someone else's prompt to make room.
- **Duplicate text:** write a different setup. The checker ignores case and most punctuation when comparing prompts across regions.
- **Invalid YAML:** check indentation and quote text containing special characters.
- **Text too long or short:** keep the setup within 8–80 characters.
- **Ends with punctuation:** remove the final period, exclamation mark, or question mark.
- **Banned term:** rewrite the prompt. Do not disguise a term to bypass the check.

A `thin:` message is a warning: that region/level combination has fewer than the target of 60 eligible prompts, including global prompts and lower levels. Fewer than 17 is an error because an eight-player game needs 17 prompts. A successful run ends with `content:check ok` and exits with code 0.

For the remaining pre-PR checks, follow [CONTRIBUTING.md](../CONTRIBUTING.md#before-opening-a-pr).

## Try it in a game

Run `bun dev`, create a room at `http://localhost:5173`, and join from `/play` or the room's QR link. Prompts are drawn randomly, so an eligible new entry is not guaranteed to appear in the first game.

The host's region/level picker is not implemented yet; the current default is global, level 2. Regional and level 3 additions can pass validation without appearing in a default game.

Restart the backend after editing content: it caches the library for the process lifetime. Create a fresh room for the updated deck. Production changes require a new deployment; editing YAML does not change a running server's library.

## Submit your contribution

Keep the PR focused on the prompts you added or revised. Mention the region, levels, any cultural context a reviewer may need, and whether `bun run content:check` passed.

Prompt content is contributed under the project's **CC0** content license. Submit your own setups or material you have permission to contribute on those terms; do not copy a commercial game's prompt pack.

For deliberately blank player answers, edit [`content/fallbacks.yaml`](../content/fallbacks.yaml) instead. Those entries are plain strings under `fallbacks:`, not prompt records. They should work without knowing the question and can compete as real answers. Run the same content check afterward.
