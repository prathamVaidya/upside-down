import { Blob, Clay, Doug, Wordmark } from '@ud/clay'
import type { ClientView, LobbyView } from '@ud/protocol'

/**
 * The screen this product is judged on.
 *
 * It sits on a television in someone's living room for several minutes, and it
 * is the thing people photograph. The room code has to be legible across the
 * room, the join address has to be obvious to a person handed a phone with no
 * explanation, and the whole thing has to feel alive rather than parked.
 */
export function Idle({ view, phase }: { view: ClientView; phase: LobbyView }) {
  const letters = view.code.split('')
  const joinUrl = window.location.host

  return (
    <>
      <div style={{ position: 'absolute', top: 'clamp(16px,3vmin,42px)' }}>
        <Wordmark size={28} />
      </div>

      <p className="stage__sub" style={{ marginTop: '6vmin' }}>
        room code — go to {joinUrl} on your phone and type it in
      </p>

      <div className="code">
        {letters.map((ch, i) => (
          <Clay
            // The last tile is upside down, always. The name has to be earned by
            // the interface, not printed on it.
            // biome-ignore lint/suspicious/noArrayIndexKey: a four-letter code is fixed-length and never reorders, so position is the identity
            key={`${ch}-${i}`}
            seed={`code-${view.code}-${i}`}
            tone={
              i === letters.length - 1
                ? 'ink'
                : (['brick', 'sage', 'slate', 'butter'][i % 4] as 'brick')
            }
            shape={{ radius: 20, jitter: 6, tilt: 4 }}
            className="code__tile"
            style={i === letters.length - 1 ? { transform: 'rotate(180deg)' } : undefined}
          >
            {ch}
          </Clay>
        ))}
      </div>

      <p className="stage__sub">yes, the last one is upside down. it does that.</p>

      <div className="lobby__seats" style={{ marginTop: '2vmin' }}>
        {view.seats.map((s) => (
          <div className="lobby__seat ud-anim-drop-in" key={s.id}>
            <Blob color={s.color} shape={s.shape} size={38} />
            <span style={{ opacity: s.connected ? 1 : 0.45 }}>{s.name}</span>
            {s.isHost && (
              <span style={{ fontSize: '0.6em', color: 'var(--ud-ink-faint)' }}>host</span>
            )}
          </div>
        ))}
        {view.seats.length === 0 && <p className="stage__sub">nobody yet. it's quiet.</p>}
      </div>

      <div className="stage__shelf" />
      <div style={{ position: 'absolute', bottom: 'clamp(34px,7vmin,80px)' }}>
        <Doug pose="idle" size={94} />
      </div>

      <p className="stage__foot">
        {phase.canStart
          ? `${phase.playerCount} in. the host can start whenever they're brave enough.`
          : `${phase.playerCount} of ${phase.minPlayers} needed. text somebody.`}
      </p>
    </>
  )
}
