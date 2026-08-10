import { Clay, Doug } from '@ud/clay'
import type { ClientView } from '@ud/protocol'

/**
 * Between actions.
 *
 * Waiting screens are where the personality goes — it is the one place the
 * interface can be funny without stealing attention from the players' own
 * jokes, because by definition nothing else is happening.
 */
export function Waiting({ view, line, sub }: { view: ClientView; line: string; sub?: string }) {
  const stragglers = view.seats.filter((s) => s.kind === 'player' && s.connected)

  return (
    <div className="phone">
      <div className="phone__spacer" />

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <Doug pose="watching" size={96} />
      </div>

      <h1 className="phone__title" style={{ textAlign: 'center', marginTop: 18 }}>
        {line}
      </h1>
      {sub && (
        <p className="phone__label" style={{ textAlign: 'center' }}>
          {sub}
        </p>
      )}

      <Clay
        seed="waiting-note"
        tone="card"
        shape={{ radius: 14, jitter: 4, tilt: 0.8 }}
        style={{ marginTop: 22, padding: '14px 16px', fontSize: 12.5, textAlign: 'center' }}
      >
        <span className="ud-anim-dots">look up. the telly is doing the work now.</span>
      </Clay>

      <div className="phone__spacer" />
      <div className="phone__hint" style={{ paddingBottom: 10 }}>
        {stragglers.length} still in the room
      </div>
    </div>
  )
}
