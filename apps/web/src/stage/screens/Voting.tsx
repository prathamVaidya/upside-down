import { Clay, Countdown, Pellet } from '@ud/clay'
import type { ClientView, ColorRole, VotingView } from '@ud/protocol'

const PELLET_COLORS: ColorRole[] = ['brick', 'sage', 'slate', 'butter']

/**
 * Two answers, two equal podiums.
 *
 * Neither side may look favoured — same size, same tone weight, same distance
 * from centre — because the only thing that should decide this is which one is
 * funnier. A vote arrives as a physical object that travels and lands, never as
 * a number that ticks up.
 *
 * Note that nothing here knows who wrote either answer. The server did not send
 * it.
 */
export function Voting({
  view,
  phase,
  offsetMs,
}: {
  view: ClientView
  phase: VotingView
  offsetMs: number
}) {
  return (
    <>
      <h1 data-replay-public="true" className="stage__title" style={{ maxWidth: '90vw' }}>
        {phase.promptText}
      </h1>

      <div style={{ marginTop: '1vmin' }}>
        <Countdown endsAt={view.phaseEndsAt} offsetMs={offsetMs} word="to vote" />
      </div>

      <div className="slabs" style={{ marginTop: '2vmin' }}>
        <Answer
          recordable={view.replay?.submittedAnswersVisible === true}
          text={phase.a.text}
          votes={phase.a.votes}
          tone="brick"
          seed="slab-a"
        />
        <div className="versus">or</div>
        <Answer
          recordable={view.replay?.submittedAnswersVisible === true}
          text={phase.b.text}
          votes={phase.b.votes}
          tone="slate"
          seed="slab-b"
        />
      </div>

      <p className="stage__foot">
        round {view.round} · matchup {phase.matchupNumber} of {phase.matchupCount} · vote on your
        phone
      </p>
    </>
  )
}

function Answer({
  recordable,
  text,
  votes,
  tone,
  seed,
}: {
  recordable: boolean
  text: string
  votes: number
  tone: 'brick' | 'slate'
  seed: string
}) {
  return (
    <Clay seed={seed} tone="card" className="slab">
      <div key={String(recordable)} data-replay-public={recordable} className="slab__text">
        "{text}"
      </div>
      <div>
        <div className="slab__pellets">
          {Array.from({ length: votes }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: votes are deliberately anonymous, so a pellet has no identity beyond where it landed
            <Pellet key={i} color={PELLET_COLORS[i % PELLET_COLORS.length]!} index={i} />
          ))}
        </div>
        <div className="slab__meta" style={{ marginTop: 8 }}>
          {votes === 0
            ? 'no votes yet'
            : `${votes} vote${votes === 1 ? '' : 's'} · authors hidden until reveal`}
        </div>
      </div>
      <div
        aria-hidden
        style={{ height: 6, background: `var(--ud-${tone})`, borderRadius: 4, opacity: 0.9 }}
      />
    </Clay>
  )
}
