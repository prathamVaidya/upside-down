import { ClayButton, Countdown } from '@ud/clay'
import type { ClientView, WritingView } from '@ud/protocol'
import { ANSWER_MAX } from '@ud/protocol'
import { useState } from 'react'

/**
 * Writing, with the keyboard up.
 *
 * The timer says "to write" beside the number so it is obvious what is running
 * out, and it is deliberately small: the brief asks for time pressure without
 * panic, and a huge countdown two inches from the text field is panic.
 */
export function Write({
  view,
  phase,
  offsetMs,
  onSubmit,
}: {
  view: ClientView
  phase: WritingView
  offsetMs: number
  onSubmit: (slot: number, text: string) => void
}) {
  const assignment = phase.assignment
  if (!assignment) return null

  return (
    <Composer
      // A fresh box for each prompt. Keying the component is how React resets
      // state on a changed input — an effect that clears the text would fight
      // whatever the player typed in the frame the second prompt arrived.
      key={`${assignment.slot}:${assignment.promptText}`}
      assignment={assignment}
      endsAt={view.phaseEndsAt}
      offsetMs={offsetMs}
      onSubmit={onSubmit}
    />
  )
}

function Composer({
  assignment,
  endsAt,
  offsetMs,
  onSubmit,
}: {
  assignment: { slot: number; of: number; promptText: string }
  endsAt: number | null
  offsetMs: number
  onSubmit: (slot: number, text: string) => void
}) {
  const [text, setText] = useState('')
  const ready = text.trim().length > 0

  return (
    <div className="phone">
      <div className="phone__top">
        <div className="phone__label">
          prompt {assignment.slot + 1} of {assignment.of}
        </div>
        <Countdown endsAt={endsAt} offsetMs={offsetMs} word="to write" />
      </div>

      <p className="phone__prompt" style={{ marginTop: 12 }}>
        {assignment.promptText}
      </p>

      <textarea
        className="ud-input"
        style={{ minHeight: 104, fontSize: 17, lineHeight: 1.4 }}
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, ANSWER_MAX))}
        maxLength={ANSWER_MAX}
        placeholder="be funnier than the other one"
        // biome-ignore lint/a11y/noAutofocus: this screen exists to be typed into and nothing else, and mobile Safari ignores it without a gesture anyway
        autoFocus
        aria-label="your answer"
      />

      <ClayButton
        seed={`submit-${assignment.slot}`}
        tone="brick"
        disabled={!ready}
        onClick={() => onSubmit(assignment.slot, text)}
        style={{ fontSize: 19, padding: '18px 20px' }}
      >
        that's my answer
      </ClayButton>

      <div className="phone__hint">the button squishes when you press it. it's the law.</div>

      <div className="phone__spacer" />
    </div>
  )
}
