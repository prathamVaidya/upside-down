import { Clay, ClayButton, Wordmark } from '@ud/clay'
import type { ErrorCode } from '@ud/protocol'
import { NAME_MAX } from '@ud/protocol'
import { useState } from 'react'

/**
 * The first thing a person sees when a friend sends them a link with no
 * explanation. Five seconds to understand it, one hand, no instructions.
 *
 * The code arrives pre-filled from `/r/GRUB` when they scanned the television,
 * which means most people only ever type a name.
 */
export function Join({
  initialCode,
  error,
  onJoin,
}: {
  initialCode: string
  error: { code: ErrorCode; message: string } | null
  onJoin: (code: string, name: string) => void
}) {
  const [code, setCode] = useState(initialCode)
  const [name, setName] = useState('')

  const ready = code.trim().length === 4 && name.trim().length > 0
  const submit = () => ready && onJoin(code, name)

  return (
    <form
      className="phone"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
        <Wordmark size={19} />
      </div>

      <label htmlFor="room-code" className="phone__label" style={{ marginTop: 24 }}>
        the code on the TV
      </label>
      <input
        id="room-code"
        className="ud-input codeinput"
        data-testid="code-input"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 4))}
        maxLength={4}
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        inputMode="text"
        aria-label="room code"
      />

      <label htmlFor="player-name" className="phone__label" style={{ marginTop: 12 }}>
        what do we call you
      </label>
      <input
        id="player-name"
        className="ud-input"
        data-testid="name-input"
        style={{ fontSize: 19, fontWeight: 500 }}
        value={name}
        onChange={(e) => setName(e.target.value.slice(0, NAME_MAX))}
        maxLength={NAME_MAX}
        aria-label="your name"
      />
      <div className="phone__hint" style={{ textAlign: 'left' }}>
        {NAME_MAX} letters max. choose wisely, it's permanent.
      </div>

      {error && (
        <div className="error" role="alert">
          {error.message}
        </div>
      )}

      <div className="phone__spacer" />

      <ClayButton
        seed="join-button"
        data-testid="join"
        tone="brick"
        disabled={!ready}
        type="submit"
      >
        get in
      </ClayButton>

      <Clay
        seed="join-note"
        tone="card"
        shape={{ radius: 12, jitter: 3, tilt: 0.6 }}
        style={{ padding: '10px 14px', fontSize: 12, color: 'var(--ud-ink-soft)' }}
      >
        someone reads a prompt out on the telly, two people answer it, everyone else decides who was
        funnier. that's the whole game.
      </Clay>
    </form>
  )
}
