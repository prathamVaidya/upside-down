import { Clay, ClayButton, Countdown } from '@ud/clay'
import type { ClientView, Side, VotingView } from '@ud/protocol'

/**
 * Two answers, two enormous targets.
 *
 * No takebacks, so the only feedback needed after a tap is which one they hit.
 * Note there is nothing here about who wrote either answer — the server did not
 * send it, so the component could not leak it even if it wanted to.
 */
export function Vote({
  view,
  phase,
  offsetMs,
  onVote,
}: {
  view: ClientView
  phase: VotingView
  offsetMs: number
  onVote: (side: Side) => void
}) {
  // One of the two authors: this matchup is theirs, so they sit it out.
  if (phase.yourSide) return <SittingOut view={view} phase={phase} offsetMs={offsetMs} />

  const voted = phase.yourVote !== null
  // Somebody who joined after the lobby is handed a ballot with no explanation
  // of why they were never asked to write. Say it, quietly, once.
  const audience = view.you?.kind === 'audience'

  return (
    <div className="phone">
      <div className="phone__top">
        <div className="phone__label">
          {audience && <span data-testid="audience-badge">audience · </span>}
          {voted ? 'locked in' : "which one's funnier"}
        </div>
        <Countdown endsAt={view.phaseEndsAt} offsetMs={offsetMs} word="to vote" />
      </div>

      <ClayButton
        seed="choice-a"
        data-testid="choice-a"
        tone="card"
        className={`choice ${phase.yourVote === 'a' ? 'choice--chosen' : ''}`}
        disabled={voted}
        onClick={() => onVote('a')}
        aria-pressed={phase.yourVote === 'a'}
      >
        "{phase.a.text}"
      </ClayButton>

      <div style={{ textAlign: 'center', color: 'var(--ud-ink-faint)', fontSize: 13 }}>or</div>

      <ClayButton
        seed="choice-b"
        data-testid="choice-b"
        tone="card"
        className={`choice ${phase.yourVote === 'b' ? 'choice--chosen' : ''}`}
        disabled={voted}
        onClick={() => onVote('b')}
        aria-pressed={phase.yourVote === 'b'}
      >
        "{phase.b.text}"
      </ClayButton>

      <div className="phone__hint">{voted ? 'eyes on the TV now.' : 'tap one. no takebacks.'}</div>

      <div className="phone__spacer" />
    </div>
  )
}

/** Your own matchup is on the television. An opportunity, not a dead screen. */
function SittingOut({
  view,
  phase,
  offsetMs,
}: {
  view: ClientView
  phase: VotingView
  offsetMs: number
}) {
  const yours = phase.yourSide === 'a' ? phase.a : phase.b

  return (
    <div className="phone">
      <div className="phone__top">
        <div className="phone__label">this one's yours</div>
        <Countdown endsAt={view.phaseEndsAt} offsetMs={offsetMs} word="to vote" />
      </div>

      <h1 className="phone__title" style={{ marginTop: 18 }}>
        The room is voting on your answer right now
      </h1>
      <p className="phone__label">act natural.</p>

      <Clay seed="your-answer" tone="card" style={{ padding: 20, marginTop: 16 }}>
        <div style={{ fontFamily: 'var(--ud-stage-font)', fontSize: 18, fontWeight: 500 }}>
          "{yours.text}"
        </div>
        <div style={{ fontSize: 12, color: 'var(--ud-ink-faint)', marginTop: 10 }}>
          — you, a minute ago
        </div>
      </Clay>

      <div className="phone__spacer" />
      <div className="phone__hint" style={{ paddingBottom: 12 }}>
        eyes on the TV, not on this
      </div>
    </div>
  )
}
