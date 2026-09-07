import { Blob, Clay, Doug, Wordmark } from '@ud/clay'
import type { ClientView, LobbyView } from '@ud/protocol'
import { RoomSetup, settingsLabel } from '../../RoomSetup.tsx'
import { Qr } from '../Qr.tsx'

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
  const joinUrl = `${window.location.host}/play`
  // The deep link the phone already knows how to read: /r/GRUB lands on the
  // join screen with the code filled in, so a scan skips the typing entirely.
  const scanUrl = `${window.location.origin}/r/${view.code}`

  if (phase.settingsOpen) {
    return (
      <>
        <p className="stage__sub">
          Room {view.code} · join at {joinUrl}
        </p>
        <RoomSetup settings={phase.settings} />
        <p className="stage__sub">
          The host picks on their phone. Everyone else gets to judge the choice.
        </p>
      </>
    )
  }

  return (
    <>
      <div style={{ position: 'absolute', top: 'clamp(16px,3vmin,42px)' }}>
        <Wordmark size={28} />
      </div>

      <p className="stage__sub" style={{ marginTop: '6vmin' }}>
        room code — scan the square, or go to {joinUrl} and type it in
      </p>

      <div className="join">
        <div className="code" data-testid="room-code">
          {letters.map((ch, i) => (
            <Clay
              // The last tile is inked rather than flipped. The joke is everywhere
              // else in this game; a code read across a room and retyped on a
              // phone is the one place legibility outranks it.
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
            >
              {ch}
            </Clay>
          ))}
        </div>

        <Qr
          value={scanUrl}
          size="clamp(144px, 22vmin, 240px)"
          label={`scan to join room ${view.code}`}
        />
      </div>

      <p className="stage__sub" data-testid="settings-summary">
        {settingsLabel(phase.settings)}
      </p>

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
