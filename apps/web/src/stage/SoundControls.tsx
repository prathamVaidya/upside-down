import type { RoomClient } from '@ud/net'
import { useEffect, useRef, useState } from 'react'
import { StageAudio } from './audio.ts'

export function SoundControls({ client }: { client: RoomClient }) {
  const audio = useRef<StageAudio | null>(null)
  const [enabled, setEnabled] = useState(false)
  const [error, setError] = useState('')
  const [volume, setVolume] = useState(0.18)

  useEffect(() => {
    const player = new StageAudio()
    audio.current = player
    const onSound: NonNullable<RoomClient['onSound']> = (cue) => {
      if (document.visibilityState !== 'hidden' && client.snapshot().status === 'open')
        player.play(cue)
    }
    client.onSound = onSound
    const unsubscribe = client.subscribe(() => {
      const snapshot = client.snapshot()
      if (snapshot.status !== 'open' || snapshot.roomClosed || snapshot.mustReload) player.stop()
    })
    const onVisibility = () => {
      if (document.hidden) player.stop()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      if (client.onSound === onSound) client.onSound = null
      unsubscribe()
      document.removeEventListener('visibilitychange', onVisibility)
      audio.current = null
      player.dispose()
    }
  }, [client])

  return (
    <aside className="stage-sound" aria-label="Stage sound">
      <button
        type="button"
        data-testid="sound-toggle"
        aria-label={enabled ? 'Mute sound' : 'Enable sound'}
        title={enabled ? 'Mute sound' : 'Enable sound'}
        aria-pressed={enabled}
        onClick={async () => {
          const player = audio.current
          if (!player) return
          if (enabled) {
            player.mute()
            setEnabled(false)
            return
          }
          try {
            player.setVolume(volume)
            await player.enable()
            if (audio.current !== player) return
            setEnabled(true)
            setError('')
            player.play('join')
          } catch {
            setError('Sound unavailable. Try enabling it again in this browser.')
          }
        }}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M11 5 6 9H3v6h3l5 4Z" />
          {enabled ? (
            <>
              <path d="M15 8a6 6 0 0 1 0 8" />
              <path d="M18 5a10 10 0 0 1 0 14" />
            </>
          ) : (
            <path d="m16 9 5 6m0-6-5 6" />
          )}
        </svg>
      </button>
      {enabled && (
        <label>
          Volume{' '}
          <input
            data-testid="sound-volume"
            type="range"
            min="0"
            max="0.5"
            step="0.01"
            value={volume}
            onChange={(event) => {
              const next = Number(event.currentTarget.value)
              setVolume(next)
              audio.current?.setVolume(next)
            }}
          />
        </label>
      )}
      {error && <span role="status">{error}</span>}
    </aside>
  )
}
