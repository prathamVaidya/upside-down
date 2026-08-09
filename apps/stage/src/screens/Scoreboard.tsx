import { Blob, Clay } from '@ud/clay'
import type { ClientView, ScoreboardView } from '@ud/protocol'

/** Between rounds. Lose your matchup, spend the break upside down. */
export function Scoreboard({ view, phase }: { view: ClientView; phase: ScoreboardView }) {
  return (
    <>
      <h1 className="stage__title">After round {phase.roundJustEnded}</h1>
      <p className="stage__sub">
        {phase.nextRound
          ? `round ${phase.nextRound} is double points, so none of this matters yet`
          : 'that was the last round. brace yourself.'}
      </p>

      <div className="rows" style={{ marginTop: '3vmin' }}>
        {phase.rows.map((row, i) => (
          <div className="row" key={row.seatId}>
            <Blob color={row.color} shape={row.shape} size={44} upsideDown={row.upsideDown} />
            <Clay seed={`row-${row.seatId}`} tone="card" className="row__bar">
              <div
                className="row__name"
                style={row.upsideDown ? { transform: 'rotate(180deg)' } : undefined}
              >
                {row.name}
              </div>
              <div className="row__scores">
                <div
                  className="row__delta"
                  style={{ color: row.delta > 0 ? 'var(--ud-sage)' : 'var(--ud-ink-faint)' }}
                >
                  +{row.delta}
                </div>
                <div className="row__total">{row.score}</div>
              </div>
            </Clay>
            <div style={{ width: 28, textAlign: 'right', color: 'var(--ud-ink-faint)' }}>
              {i + 1}
            </div>
          </div>
        ))}
      </div>

      <p className="stage__foot">lose your matchup, spend the break upside down</p>
      <div className="ud-sr-only">
        {phase.rows.map((r) => `${r.name} ${r.score} points`).join(', ')}
      </div>
      <span className="ud-sr-only">round {view.round}</span>
    </>
  )
}
