import { Clay, Countdown } from '@ud/clay'
import type { ClientView, FinaleVotingView, SeatId } from '@ud/protocol'

/**
 * Three votes, many answers, one thumb.
 *
 * A stepper per row rather than a drag or a slider: the whole interaction has
 * to survive being done without looking, while the room is shouting. Votes come
 * back off as easily as they go on, because the finale is the one round where
 * you are weighing several answers against each other rather than picking one.
 *
 * Your own answer is not in this list — the server never sent it as votable.
 */
export function FinaleVote({
  view,
  phase,
  offsetMs,
  onVote,
}: {
  view: ClientView
  phase: FinaleVotingView
  offsetMs: number
  onVote: (entrySeatId: SeatId, delta: 1 | -1) => void
}) {
  const ballot = phase.entries.filter((e) => !e.isYours)
  const spent = phase.votesPerVoter - phase.votesLeft

  return (
    <div className="phone">
      <div className="phone__top">
        <div className="phone__label">the finale · spend all {phase.votesPerVoter}</div>
        <Countdown endsAt={view.phaseEndsAt} offsetMs={offsetMs} word="to vote" />
      </div>

      <div className="votesleft">
        <span className="phone__label">votes left</span>
        <span className="ud-sr-only">{phase.votesLeft} votes left to spend</span>
        <div className="votesleft__pips" aria-hidden>
          {Array.from({ length: phase.votesPerVoter }, (_, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: a fixed-length row of identical pips
              key={i}
              className="ud-blob"
              style={{
                width: 18,
                height: 16,
                background: i < phase.votesLeft ? 'var(--ud-brick)' : 'rgba(64,53,44,.15)',
              }}
            />
          ))}
        </div>
      </div>

      <div className="ballot">
        {ballot.map((entry) => (
          <Clay
            key={entry.id}
            seed={`ballot-${entry.id}`}
            tone="card"
            className="ballot__row"
            data-testid="ballot-row"
          >
            <div className="ballot__text">"{entry.text}"</div>
            <div className="ballot__stepper">
              <button
                type="button"
                className="ud-press ballot__step"
                data-testid="vote-minus"
                onClick={() => onVote(entry.id, -1)}
                disabled={entry.yourVotes === 0}
                aria-label={`take a vote off "${entry.text}"`}
              >
                −
              </button>
              <div className="ballot__count" data-testid="vote-count" aria-live="polite">
                {entry.yourVotes}
              </div>
              <button
                type="button"
                className="ud-press ballot__step"
                data-testid="vote-plus"
                onClick={() => onVote(entry.id, 1)}
                disabled={phase.votesLeft === 0}
                aria-label={`put a vote on "${entry.text}"`}
              >
                +
              </button>
            </div>
          </Clay>
        ))}
      </div>

      <div className="phone__hint" style={{ paddingBottom: 10 }}>
        {phase.votesLeft === 0
          ? 'all spent. eyes on the TV.'
          : spent === 0
            ? `${phase.votesLeft} to spend. stack them or spread them.`
            : `${phase.votesLeft} left to spend`}
      </div>
    </div>
  )
}
