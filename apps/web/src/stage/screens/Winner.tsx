import { Blob, Clay, Doug } from '@ud/clay'
import type { ClientView, ColorRole, WinnerView } from '@ud/protocol'

const CONFETTI: { color: ColorRole; left: string; duration: string; delay: string }[] = [
  { color: 'brick', left: '16%', duration: '3.4s', delay: '0s' },
  { color: 'butter', left: '42%', duration: '2.8s', delay: '.7s' },
  { color: 'sage', left: '63%', duration: '3.7s', delay: '.3s' },
  { color: 'slate', left: '84%', duration: '3s', delay: '1.2s' },
  { color: 'butter', left: '28%', duration: '3.2s', delay: '1.8s' },
  { color: 'brick', left: '72%', duration: '2.6s', delay: '2.2s' },
]

/**
 * The final beat, and the only place the stage goes dark.
 *
 * Fifteen minutes of build-up land here, so everyone who is not the champion is
 * upside down — the joke the whole game has been setting up.
 */
export function Winner({ view, phase }: { view: ClientView; phase: WinnerView }) {
  const champion = view.seats.find((s) => s.id === phase.championSeatId)
  const others = phase.rows.filter((r) => r.seatId !== phase.championSeatId)

  return (
    <div className="stage stage-winner ud-dark">
      {CONFETTI.map((c, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: a fixed decorative list
          key={i}
          className="confetti ud-anim-fall"
          style={{
            left: c.left,
            background: `var(--ud-${c.color})`,
            animationDuration: c.duration,
            animationDelay: c.delay,
          }}
        />
      ))}

      <p className="stage__sub">after {view.roundCount} round(s) and one regrettable finale</p>

      <h1
        className="stage__title ud-anim-drop-in"
        style={{
          color: 'var(--ud-butter)',
          fontSize: 'clamp(32px,7vmin,88px)',
          textShadow: '0 6px 0 rgba(0,0,0,.35)',
        }}
      >
        {phase.championName} is the funniest
      </h1>

      <p className="stage__sub">
        {phase.championScore} points
        {phase.championSweeps > 0
          ? ` · ${phase.championSweeps} clean sweep${phase.championSweeps === 1 ? '' : 's'}`
          : ''}{' '}
        · legally binding until next game
      </p>

      <div style={{ marginTop: '2vmin' }}>
        <Doug pose="delighted" size={96} />
      </div>

      {champion && (
        <Clay
          seed="podium"
          tone="butter"
          style={{
            width: 'clamp(140px,22vmin,260px)',
            height: 'clamp(60px,10vmin,120px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            font: '600 clamp(22px,4vmin,48px) var(--ud-stage-font)',
          }}
        >
          1
        </Clay>
      )}

      <div
        style={{
          display: 'flex',
          gap: 'clamp(12px,2.5vmin,32px)',
          marginTop: '1vmin',
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}
      >
        {others.map((r) => (
          <div key={r.seatId} style={{ textAlign: 'center', opacity: 0.75 }}>
            <Blob color={r.color} shape={r.shape} size={40} upsideDown />
            <div
              style={{
                fontSize: 'clamp(11px,1.5vmin,18px)',
                transform: 'rotate(180deg)',
                marginTop: 6,
              }}
            >
              {r.name}
            </div>
          </div>
        ))}
      </div>

      <p className="stage__foot">everyone else is upside down. that is the whole game.</p>
    </div>
  )
}
