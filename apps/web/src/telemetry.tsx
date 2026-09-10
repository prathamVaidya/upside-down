import type { RoomClient } from '@ud/net'
import type { PostHogConfig } from 'posthog-js'
import { useEffect, useState } from 'react'
import './telemetry.css'

const key = import.meta.env.VITE_POSTHOG_KEY
const host = import.meta.env.VITE_POSTHOG_HOST
const enabled = Boolean(key && host && import.meta.env.PROD)
// Preserve explicit opt-outs across versions; no saved preference now means enabled.
const consentKey = 'ud.diagnostics.v2'
const consentChanged = 'ud.diagnostics.changed'
let sdk: Promise<typeof import('posthog-js')> | undefined

function allowed() {
  try {
    const preference = localStorage.getItem(consentKey) ?? localStorage.getItem('ud.diagnostics')
    return preference !== 'no' && !['1', 'yes'].includes(navigator.doNotTrack ?? '')
  } catch {
    return false
  }
}

export function safeUrl(value: string): string {
  try {
    const url = new URL(value)
    url.search = ''
    url.hash = ''
    if (/^\/r\/[A-Za-z]{4}\/?$/.test(url.pathname)) url.pathname = '/r/[room]'
    return url.toString()
  } catch {
    return ''
  }
}

/** Replay content is unmasked. Transport/error sanitization is separate below. */
export const privacyConfig: Partial<PostHogConfig> = {
  autocapture: false,
  capture_pageview: false,
  capture_pageleave: false,
  capture_dead_clicks: false,
  capture_performance: false,
  disable_surveys: true,
  enable_recording_console_log: false,
  person_profiles: 'never',
  persistence: 'sessionStorage',
  ip: false,
  respect_dnt: true,
  capture_exceptions: {
    capture_unhandled_errors: true,
    capture_unhandled_rejections: true,
    capture_console_errors: false,
  },
  session_recording: {
    // Explicit values override project defaults; callbacks also cover legacy mask classes.
    maskAllInputs: false,
    maskInputOptions: { password: false },
    maskInputFn: (text) => text,
    maskTextSelector: '',
    maskTextFn: (text) => text,
    maskAllElementAttributes: false,
    maskAttributeFn: (_name, value) => value,
    recordCrossOriginIframes: false,
    recordHeaders: false,
    recordBody: false,
    captureCanvas: { recordCanvas: false },
    blockSelector: '',
    maskCapturedNetworkRequestFn: (request) => ({ ...request, name: safeUrl(request.name) }),
  },
  before_send: (event) => {
    if (!event) return event
    for (const name of ['$current_url', '$referrer', '$initial_current_url', '$initial_referrer']) {
      if (typeof event.properties[name] === 'string')
        event.properties[name] = safeUrl(event.properties[name])
    }
    // Exception messages can embed a submitted value. Keep stack/type for debugging.
    if (event.event === '$exception') {
      delete event.properties.$exception_message
      const exceptions = event.properties.$exception_list
      if (Array.isArray(exceptions))
        for (const exception of exceptions) exception.value = '[message redacted]'
    }
    return event
  },
}

export function initTelemetry() {
  if (!enabled || !key || !allowed()) return
  sdk ??= import('posthog-js')
  void sdk
    .then(({ default: posthog }) => {
      if (!allowed()) return
      if (!posthog.__loaded) {
        posthog.init(key, {
          api_host: host,
          ...privacyConfig,
          loaded: (client) => {
            client.register({
              room_id: null,
              room_code: null,
              game_id: null,
              player_id: null,
              round: null,
              phase: null,
              matchup_number: null,
              server_time_ms: null,
              app_surface: location.pathname.startsWith('/stage')
                ? 'stage'
                : location.pathname === '/'
                  ? 'landing'
                  : location.pathname.startsWith('/privacy')
                    ? 'privacy'
                    : 'phone',
            })
            publishReplayContext(client)
          },
        })
      } else {
        posthog.opt_in_capturing()
        posthog.startSessionRecording()
        publishReplayContext(posthog)
      }
    })
    .catch(() => {
      /* Blocked telemetry must never break joining or playing. */
    })
}

type ReplayContext = {
  room_id: string | null
  room_code: string | null
  game_id: string | null
  player_id: string | null
  app_surface: 'stage' | 'phone'
  round: number | null
  phase: string | null
  matchup_number: number | null
  server_time_ms: number | null
}
let replayContext: ReplayContext | null = null
let lastMarker = ''

function publishReplayContext(
  client: Pick<typeof import('posthog-js')['default'], 'register' | 'capture'>,
  context = replayContext,
) {
  if (!allowed() || !context) return
  // Explicit nulls clear a previous game's context on leave; never identify a room as a person.
  client.register(context)
  const { server_time_ms: _, ...stable } = context
  const marker = JSON.stringify(stable)
  if (marker !== lastMarker) {
    lastMarker = marker
    client.capture(context.room_id ? 'game.replay_context' : 'game.replay_left', context)
  }
}

/** Subscribe at the network boundary so phase markers aren't skipped by React batching. */
export function useGameReplay(client: RoomClient, surface: 'stage' | 'phone') {
  useEffect(() => {
    let consentSent = ''
    const sync = () => {
      const snap = client.snapshot()
      const view = snap.view
      const replay = view?.replay
      const consent = enabled && allowed()
      const consentMarker = `${replay?.roomId}:${view?.you?.id}:${consent}`
      if (snap.status !== 'open') consentSent = ''
      else if (replay && view?.you && consentSent !== consentMarker) {
        consentSent = consentMarker
        client.send({ t: 'diagnostics.set', submittedAnswers: consent })
      }
      replayContext = {
        room_id: replay?.roomId ?? null,
        room_code: replay ? view!.code : null,
        game_id: replay?.gameId ?? null,
        player_id: view?.you?.id ?? null,
        app_surface: surface,
        round: replay ? view!.round : null,
        phase: replay ? view!.phase.name : null,
        matchup_number: view && 'matchupNumber' in view.phase ? view.phase.matchupNumber : null,
        server_time_ms: replay ? view!.serverNow : null,
      }
      const context = replayContext
      if (consent && sdk)
        void sdk
          .then(({ default: posthog }) => {
            if (posthog.__loaded) publishReplayContext(posthog, context)
          })
          .catch(() => {})
    }
    sync()
    const unsubscribe = client.subscribe(sync)
    const onConsent = () => {
      sync()
    }
    window.addEventListener(consentChanged, onConsent)
    window.addEventListener('storage', onConsent)
    return () => {
      unsubscribe()
      window.removeEventListener(consentChanged, onConsent)
      window.removeEventListener('storage', onConsent)
    }
  }, [client, surface])
}

export function captureReactError(error: unknown) {
  // Preserve React's default local error visibility even with telemetry disabled.
  console.error(error)
  if (!enabled || !allowed() || !sdk) return
  void sdk.then(({ default: posthog }) => posthog.captureException(error)).catch(() => {})
}

/** Available on every surface; withdrawing consent takes effect immediately. */
export function DiagnosticsConsent() {
  const [consented, setConsented] = useState(allowed)
  useEffect(() => {
    const syncConsent = (event: Event) => {
      if (
        event instanceof StorageEvent &&
        event.key !== null &&
        event.key !== consentKey &&
        event.key !== 'ud.diagnostics'
      )
        return
      const next = allowed()
      setConsented(next)
      lastMarker = ''
      if (next) initTelemetry()
      else
        void sdk
          ?.then(({ default: posthog }) => {
            posthog.stopSessionRecording()
            posthog.opt_out_capturing()
          })
          .catch(() => {})
    }
    window.addEventListener(consentChanged, syncConsent)
    window.addEventListener('storage', syncConsent)
    return () => {
      window.removeEventListener(consentChanged, syncConsent)
      window.removeEventListener('storage', syncConsent)
    }
  }, [])
  if (!enabled)
    return (
      <a className="diagnostics" href="/privacy" target="_blank" rel="noreferrer">
        Privacy policy
      </a>
    )
  const change = () => {
    const next = !consented
    try {
      localStorage.setItem(consentKey, next ? 'yes' : 'no')
    } catch {
      return
    }
    setConsented(next)
    lastMarker = ''
    window.dispatchEvent(new Event(consentChanged))
  }
  return (
    <details className="diagnostics">
      <summary>Privacy & diagnostics</summary>
      <p>
        <a href="/privacy" target="_blank" rel="noreferrer">
          Read the privacy policy
        </a>
      </p>
      <p>
        Diagnostics are on by default to help us understand play. PostHog receives errors and
        game-linked replays. All page text and inputs are recorded without masking, including names,
        unfinished drafts, questions and answers. Your content may also appear in other players’ or
        stage replays even if you turn off your own diagnostics. Avoid entering sensitive
        information. You can turn diagnostics off anytime. Previously recorded content is not
        deleted when you turn this off.
      </p>
      <button type="button" onClick={change} aria-pressed={consented}>
        {consented ? 'Turn off diagnostics' : 'Enable diagnostics'}
      </button>
    </details>
  )
}
