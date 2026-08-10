import { Clay, Countdown, Doug } from '@ud/clay'
import type { ClientView, WritingView } from '@ud/protocol'

/**
 * Sixty seconds in which nothing happens.
 *
 * The job is to hold the room's attention without pulling the eyes of the
 * people who are actually typing, so the only motion is Doug and the tiles
 * turning over as answers land. Done tiles flip upside down — obviously.
 */
export function Writing({
  view,
  phase,
  offsetMs,
}: {
  view: ClientView
  phase: WritingView
  offsetMs: number
}) {
  const nameOf = (seatId: string) => view.seats.find((s) => s.id === seatId)?.name ?? '…'
  const colorOf = (seatId: string) => view.seats.find((s) => s.id === seatId)?.color ?? 'sage'

  return (
    <>
      <h1 className="stage__title">
        {phase.isFinale ? 'One prompt. Everyone.' : 'Everyone is writing'}
      </h1>
      <p className="stage__sub">
        {phase.isFinale
          ? 'same question for the whole room. no hiding behind a matchup.'
          : "no reading over shoulders. we'll know."}
      </p>

      <div className="stage__corner">
        <Countdown endsAt={view.phaseEndsAt} offsetMs={offsetMs} word="to write" size="large" />
      </div>

      <div className="writers" style={{ marginTop: '3vmin' }}>
        {phase.progress.map((p) => {
          const done = p.done >= p.of
          return (
            <div className="writer" key={p.seatId}>
              <Clay
                seed={`writer-${p.seatId}`}
                tone={colorOf(p.seatId)}
                className={`writer__tile ${done ? '' : 'ud-anim-rock'}`}
                style={done ? { transform: 'rotate(180deg)' } : undefined}
              >
                {done ? 'done' : 'writing…'}
              </Clay>
              <div className="writer__name">
                {nameOf(p.seatId)} · {p.done} of {p.of}
              </div>
            </div>
          )
        })}
      </div>

      <p className="stage__sub" style={{ marginTop: '2vmin', opacity: 0.7 }}>
        done tiles flip upside down. obviously.
      </p>

      <div className="stage__shelf" />
      <div style={{ position: 'absolute', bottom: 'clamp(30px,6vmin,72px)', textAlign: 'center' }}>
        <Doug pose="watching" size={90} />
        <div style={{ fontSize: 'clamp(10px,1.3vmin,16px)', color: 'var(--ud-ink-faint)' }}>
          Doug is not reading your answer
        </div>
      </div>
    </>
  )
}
