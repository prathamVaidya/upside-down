import { Blob, Clay, Doug } from '@ud/clay'
import type { ClientView, RevealSide, RevealView, Side } from '@ud/protocol'

/**
 * The signature moment.
 *
 * The winner flips right-side-up and settles; the loser rotates 180° and stays
 * there — on this screen, on the scoreboard, for the rest of the round. That
 * inversion is the one thing this product should be remembered by, so it is a
 * game state rather than a flourish, and reduced motion keeps the result even
 * when it drops the tumble.
 */
export function Reveal({ view, phase }: { view: ClientView; phase: RevealView }) {
  const won = (side: Side) => phase.winner === side || phase.winner === 'tie'

  return (
    <>
      {phase.sweep && <SweepBanner />}

      <h1
        data-replay-public="true"
        className="stage__title"
        style={{ fontSize: phase.sweep ? 'clamp(18px,2.8vmin,34px)' : undefined, maxWidth: '90vw' }}
      >
        {phase.promptText}
      </h1>

      <div className="slabs" style={{ marginTop: '2vmin' }}>
        <RevealSlab view={view} side={phase.a} won={won('a')} seed="reveal-a" />
        <div className="versus">{phase.winner === 'tie' ? 'tie' : 'beat'}</div>
        <RevealSlab view={view} side={phase.b} won={won('b')} seed="reveal-b" />
      </div>

      {phase.sweep && (
        <div
          style={{ position: 'absolute', bottom: 'clamp(12px,3vmin,40px)', textAlign: 'center' }}
        >
          <Doug pose="upsidedown" size={72} />
          <div style={{ fontSize: 'clamp(10px,1.3vmin,16px)', color: 'var(--ud-ink-faint)' }}>
            Doug only does this for sweeps
          </div>
        </div>
      )}

      {!phase.sweep && (
        <p className="stage__foot">
          round {view.round} · matchup {phase.matchupNumber} of {phase.matchupCount}
        </p>
      )}
    </>
  )
}

function SweepBanner() {
  return (
    <div style={{ textAlign: 'center' }}>
      <Clay
        seed="sweep-banner"
        tone="butter"
        className="ud-anim-tag"
        shape={{ radius: 18, jitter: 5, tilt: 2 }}
        style={{
          display: 'inline-block',
          padding: 'clamp(8px,1.4vmin,18px) clamp(16px,3vmin,40px)',
          font: '600 clamp(24px,5vmin,64px) var(--ud-stage-font)',
        }}
      >
        CLEAN SWEEP
      </Clay>
      <p className="stage__sub">every single vote. the room has spoken.</p>
    </div>
  )
}

function RevealSlab({
  view,
  side,
  won,
  seed,
}: {
  view: ClientView
  side: RevealSide
  won: boolean
  seed: string
}) {
  const author = view.seats.find((s) => s.id === side.authorSeatId)

  return (
    <div style={{ position: 'relative' }}>
      <Clay
        seed={seed}
        tone="card"
        className={`slab ${won ? 'ud-anim-winflip' : 'ud-anim-loseflip'}`}
      >
        <div
          data-replay-public={view.replay?.submittedAnswersVisible === true}
          key={String(view.replay?.submittedAnswersVisible)}
          className="slab__text"
        >
          "{side.text}"
        </div>
        <div
          className="slab__meta ud-anim-tag"
          style={{ display: 'flex', alignItems: 'center', gap: 8 }}
        >
          {author && <Blob color={author.color} shape={author.shape} size={26} />}
          <span>
            {side.authorName} · {side.votes} vote{side.votes === 1 ? '' : 's'}
            {side.fallback ? ' · wrote nothing' : ''}
          </span>
        </div>
      </Clay>

      {side.points > 0 && (
        <div
          className="ud-anim-pts"
          style={{
            position: 'absolute',
            top: '-4%',
            right: '-2%',
            font: '600 clamp(18px,3vmin,40px) var(--ud-stage-font)',
            color: 'var(--ud-sage)',
          }}
        >
          +{side.points}
        </div>
      )}

      {!won && (
        <div
          style={{
            textAlign: 'center',
            marginTop: 10,
            fontSize: 'clamp(10px,1.3vmin,16px)',
            color: 'var(--ud-ink-faint)',
          }}
        >
          stays upside down until the next round
        </div>
      )}
    </div>
  )
}
