import { Blob, Clay, ClayButton } from '@ud/clay'
import type { ClientView, LobbyView } from '@ud/protocol'

/** Waiting, plus the host's one piece of power. */
export function Lobby({
  view,
  phase,
  onStart,
}: {
  view: ClientView
  phase: LobbyView
  onStart: () => void
}) {
  const isHost = view.you?.isHost ?? false
  const waiting = Math.max(0, phase.minPlayers - phase.playerCount)

  return (
    <div className="phone">
      <div className="phone__label" style={{ textAlign: 'center' }}>
        room {view.code}
        {isHost ? " · you're the host" : ''}
      </div>

      <h1 className="phone__title" style={{ textAlign: 'center', marginTop: 14 }}>
        {waiting > 0
          ? `${phase.playerCount} in, waiting on ${waiting} more`
          : `${phase.playerCount} in, waiting on nobody`}
      </h1>

      <div className="seatlist" style={{ marginTop: 18 }}>
        {view.seats.map((s) => (
          <div className="seatlist__row" key={s.id}>
            <Blob color={s.color} shape={s.shape} size={34} />
            <span style={{ opacity: s.connected ? 1 : 0.4 }}>{s.name}</span>
            {s.id === view.you?.id && (
              <span style={{ fontSize: 11, color: 'var(--ud-ink-faint)' }}>· that's you</span>
            )}
            {s.isHost && s.id !== view.you?.id && (
              <span style={{ fontSize: 11, color: 'var(--ud-ink-faint)' }}>· host</span>
            )}
            {s.kind === 'audience' && (
              <span style={{ fontSize: 11, color: 'var(--ud-ink-faint)' }}>· audience</span>
            )}
          </div>
        ))}
      </div>

      <Clay
        seed="lobby-settings"
        tone="card"
        shape={{ radius: 14, jitter: 4, tilt: 0.8 }}
        style={{ marginTop: 22, padding: '14px 16px', fontSize: 12.5, lineHeight: 1.55 }}
      >
        {phase.settings.region} · level {phase.settings.level}
        <br />
        {view.roundCount} round{view.roundCount === 1 ? '' : 's'}, about{' '}
        {Math.max(5, view.roundCount * 6)} minutes
      </Clay>

      <div className="phone__spacer" />

      {isHost ? (
        <>
          <ClayButton seed="start" tone="sage" disabled={!phase.canStart} onClick={onStart}>
            start the game
          </ClayButton>
          <div className="phone__hint">
            {phase.canStart
              ? 'only you can press this. power.'
              : `the game needs ${phase.minPlayers}.`}
          </div>
        </>
      ) : (
        <div className="phone__hint" style={{ paddingBottom: 12 }}>
          the host starts it. lean on them.
        </div>
      )}
    </div>
  )
}
