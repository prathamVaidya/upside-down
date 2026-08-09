import { ClayButton, Doug, Wordmark } from '@ud/clay'

/**
 * It will happen, so it should be calm and it should not look like an error.
 *
 * The socket is already retrying by the time this renders — the seat token
 * survives in session storage, so the reconnect puts the same person back in
 * the same seat with their score intact. This screen exists to say so.
 */
export function Dropped({ onRejoin }: { onRejoin: () => void }) {
  return (
    <div className="phone">
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
        <Wordmark size={18} />
      </div>

      <div className="phone__spacer" />

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <Doug pose="idle" size={92} />
      </div>

      <h1 className="phone__title" style={{ textAlign: 'center', marginTop: 18 }}>
        You dropped
      </h1>
      <p className="phone__label" style={{ textAlign: 'center' }}>
        the game kept going. your seat is safe. reconnecting now.
      </p>

      <div className="phone__spacer" />

      <ClayButton seed="rejoin" tone="sage" onClick={onRejoin}>
        rejoin by hand instead
      </ClayButton>
      <div className="phone__hint">if you timed out, the game answered for you. badly.</div>
    </div>
  )
}
