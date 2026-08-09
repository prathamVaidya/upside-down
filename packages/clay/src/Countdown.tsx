import { useEffect, useState } from 'react'
import type { Tone } from './components.tsx'
import { Clay } from './components.tsx'

/**
 * A phase clock.
 *
 * The server owns the deadline and sends it as an epoch timestamp; this only
 * renders it, corrected by the measured clock offset. If this component's
 * number reaches zero before the server says so, nothing happens — the phase
 * ends when the server ends it, and never because a phone's clock is fast.
 *
 * Every timer gets a word next to the number, so it is obvious what is running
 * out. That is a copy rule from the brief, and it belongs in the component
 * rather than in each caller's markup.
 */
export function Countdown({
  endsAt,
  offsetMs = 0,
  word,
  tone = 'sage',
  size = 'small',
}: {
  endsAt: number | null
  offsetMs?: number
  word: string
  tone?: Tone
  size?: 'small' | 'large'
}) {
  const [now, setNow] = useState(() => Date.now() + offsetMs)

  useEffect(() => {
    if (endsAt === null) return
    const id = setInterval(() => setNow(Date.now() + offsetMs), 250)
    return () => clearInterval(id)
  }, [endsAt, offsetMs])

  if (endsAt === null) return null
  const seconds = Math.max(0, Math.ceil((endsAt - now) / 1000))
  const urgent = seconds <= 10

  if (size === 'large') {
    return (
      <Clay
        seed="timer-large"
        tone={urgent ? 'brick' : tone}
        className="ud-anim-timer"
        style={{
          width: 118,
          height: 118,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '48% 52% 50% 50% / 52% 48% 54% 46%',
        }}
      >
        <div style={{ font: '600 46px var(--ud-stage-font)', lineHeight: 1 }}>{seconds}</div>
        <div style={{ fontSize: 13, opacity: 0.85 }}>{word}</div>
      </Clay>
    )
  }

  return (
    <Clay
      seed="timer-small"
      tone={urgent ? 'brick' : tone}
      shape={{ radius: 12, jitter: 3, tilt: 1 }}
      style={{
        padding: '7px 13px',
        font: '600 14px var(--ud-stage-font)',
        whiteSpace: 'nowrap',
        boxShadow: 'var(--ud-lift-sm)',
      }}
    >
      {seconds} {word}
    </Clay>
  )
}
