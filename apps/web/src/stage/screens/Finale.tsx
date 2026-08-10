import { Blob, Clay, Countdown, Pellet } from '@ud/clay'
import type { ClientView, ColorRole, FinaleRevealView, FinaleVotingView } from '@ud/protocol'

const PELLET_COLORS: ColorRole[] = ['brick', 'sage', 'slate', 'butter']

/**
 * The hardest layout in the game.
 *
 * Up to eight answers on screen at once, read from three metres, through video
 * compression, by people who are not concentrating. It only works because
 * nothing else is competing for the screen: no scoreboard, no player list, no
 * running commentary. One prompt, the answers, and the votes landing on them.
 *
 * The grid tightens as answers are added rather than letting cards shrink below
 * readable — at eight it is four across, at five or fewer it is one row.
 */
export function FinaleVoting({
  view,
  phase,
  offsetMs,
}: {
  view: ClientView
  phase: FinaleVotingView
  offsetMs: number
}) {
  const columns = phase.entries.length > 6 ? 4 : phase.entries.length > 3 ? 3 : 2

  return (
    <>
      <Clay
        seed="finale-tag"
        tone="ink"
        shape={{ radius: 13, jitter: 4, tilt: 1.4 }}
        style={{
          padding: '7px 15px',
          font: '600 clamp(11px,1.5vmin,17px) var(--ud-stage-font)',
          letterSpacing: '0.06em',
        }}
      >
        THE FINALE · TRIPLE STAKES
      </Clay>

      <h1 className="stage__title" style={{ maxWidth: '88vw' }}>
        {phase.promptText}
      </h1>

      <p className="stage__sub">
        everyone answered this one · split your {phase.votesPerVoter} votes however you like
      </p>

      <div style={{ marginTop: '0.5vmin' }}>
        <Countdown endsAt={view.phaseEndsAt} offsetMs={offsetMs} word="to vote" />
      </div>

      <div
        className="finale-grid"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {phase.entries.map((entry, i) => (
          <Clay key={entry.id} seed={`finale-${entry.id}`} tone="card" className="finale-card">
            <div className="finale-card__text">"{entry.text}"</div>
            <div className="slab__pellets">
              {Array.from({ length: entry.votes }, (_, v) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: votes are anonymous, so a pellet has no identity beyond where it landed
                <Pellet key={v} color={PELLET_COLORS[(i + v) % PELLET_COLORS.length]!} index={v} />
              ))}
            </div>
          </Clay>
        ))}
      </div>

      <p className="stage__foot">
        authors hidden · votes are pellets, not numbers · {phase.votesIn} of {phase.votesPossible}{' '}
        spent
      </p>
    </>
  )
}

/** The same grid, with the names put to the answers and the points dropped on. */
export function FinaleReveal({ view, phase }: { view: ClientView; phase: FinaleRevealView }) {
  const columns = phase.entries.length > 6 ? 4 : phase.entries.length > 3 ? 3 : 2

  return (
    <>
      {phase.sweep ? (
        <Clay
          seed="finale-sweep"
          tone="butter"
          className="ud-anim-tag"
          style={{
            padding: 'clamp(6px,1.2vmin,16px) clamp(14px,2.6vmin,34px)',
            font: '600 clamp(20px,4vmin,52px) var(--ud-stage-font)',
          }}
        >
          CLEAN SWEEP
        </Clay>
      ) : (
        <p className="stage__sub">that was the finale. this is what the room decided.</p>
      )}

      <h1
        className="stage__title"
        style={{ fontSize: 'clamp(18px,2.8vmin,36px)', maxWidth: '88vw' }}
      >
        {phase.promptText}
      </h1>

      <div
        className="finale-grid"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {phase.entries.map((entry) => (
          <div key={entry.seatId} style={{ position: 'relative' }}>
            <Clay
              seed={`finale-${entry.seatId}`}
              tone="card"
              className={`finale-card ${entry.won ? 'ud-anim-winflip' : 'ud-anim-loseflip'}`}
            >
              <div className="finale-card__text">"{entry.text}"</div>
              <div
                className="slab__meta"
                style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 6 }}
              >
                <Blob color={entry.color} shape={entry.shape} size={22} />
                <span>
                  {entry.authorName} · {entry.votes}
                </span>
              </div>
            </Clay>
            {entry.points > 0 && (
              <div
                className="ud-anim-pts"
                style={{
                  position: 'absolute',
                  top: '-8%',
                  right: '-4%',
                  font: '600 clamp(13px,2vmin,26px) var(--ud-stage-font)',
                  color: 'var(--ud-sage)',
                }}
              >
                +{entry.points}
              </div>
            )}
          </div>
        ))}
      </div>

      <p className="stage__foot">
        everyone who did not win it is upside down · round {view.round} of {view.roundCount}
      </p>
    </>
  )
}
