import type { PostHogConfig } from 'posthog-js'
import { useState } from 'react'
import './telemetry.css'

const key = import.meta.env.VITE_POSTHOG_KEY
const host = import.meta.env.VITE_POSTHOG_HOST
const enabled = Boolean(key && host && import.meta.env.PROD)
const consentKey = 'ud.diagnostics'
let sdk: Promise<typeof import('posthog-js')> | undefined

function allowed() {
  try {
    return localStorage.getItem(consentKey) === 'yes'
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

/** Mask rendered answers too, not just the input where they were typed. */
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
    maskAllInputs: true,
    maskTextSelector: '*',
    maskAttributeFn: (name, value) => {
      // Finale vote buttons put answer text in accessible labels.
      if (['aria-label', 'title', 'alt', 'value'].includes(name) || name.startsWith('data-'))
        return '[redacted]'
      if (name === 'href' || name === 'src') {
        try {
          return safeUrl(new URL(value, location.origin).toString())
        } catch {
          return ''
        }
      }
      return value
    },
    recordCrossOriginIframes: false,
    recordHeaders: false,
    recordBody: false,
    captureCanvas: { recordCanvas: false },
    blockSelector: 'input[type="hidden"], input[type="file"], iframe',
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
              app_surface: location.pathname.startsWith('/stage')
                ? 'stage'
                : location.pathname === '/'
                  ? 'landing'
                  : 'phone',
            })
          },
        })
      } else {
        posthog.opt_in_capturing()
        posthog.startSessionRecording()
      }
    })
    .catch(() => {
      /* Blocked telemetry must never break joining or playing. */
    })
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
  if (!enabled) return null
  const change = () => {
    const next = !consented
    try {
      localStorage.setItem(consentKey, next ? 'yes' : 'no')
    } catch {
      return
    }
    setConsented(next)
    if (next) {
      initTelemetry()
    } else {
      void sdk
        ?.then(({ default: posthog }) => {
          posthog.stopSessionRecording()
          posthog.opt_out_capturing()
        })
        .catch(() => {})
    }
  }
  return (
    <details className="diagnostics ph-no-capture">
      <summary>Privacy & diagnostics</summary>
      <p>
        Help us fix bugs by sharing errors and a masked replay with PostHog. All text and inputs are
        hidden. Optional; you can turn it off anytime.
      </p>
      <button type="button" onClick={change} aria-pressed={consented}>
        {consented ? 'Turn off diagnostics' : 'Allow diagnostics'}
      </button>
    </details>
  )
}
