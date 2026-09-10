/** Explicit allowlist: never serialize an engine event, message, or room snapshot. */
export type WideEvent = {
  event: string
  room_id?: string
  game_id?: string
  room_code?: string
  round?: number
  phase?: string
  previous_phase?: string
  player_count?: number
  connected_count?: number
  region?: string
  content_level?: number
  outcome?: 'ok' | 'rejected' | 'ignored' | 'error'
  error_code?: string
  duration_ms?: number
  deadline_lag_ms?: number
  close_reason?: 'host' | 'expired'
  reason?: string
  actor_id?: string
  connection_id?: string
  connection_type?: 'stage' | 'phone' | 'unbound'
  close_code?: number
  previous_host_id?: string | null
  host_id?: string | null
  connected_player_count?: number
  previous_round?: number
  action_seq?: number
  matchup_index?: number
  prompt_id?: string
  trigger?: string
  game_duration_ms?: number
  round_duration_ms?: number
  fallback_count?: number
  missing_votes?: number
  votes_a?: number
  votes_b?: number
  points_a?: number
  points_b?: number
  author_a?: string
  author_b?: string
  sweep?: boolean
  winner_ids?: string[]
  scores?: { player_id: string; score: number; delta: number; sweeps: number }[]
  entries?: { player_id: string; votes: number; points: number; fallback: boolean }[]
  room_count?: number
}

type Options = {
  token?: string
  dataset?: string
  version?: string
  environment?: string
  fetcher?: typeof fetch
}

/** Bounded, best-effort delivery: outages must not stall or exhaust the game server. */
export function createTelemetry(options: Options) {
  const queue: Record<string, unknown>[] = []
  let sending: Promise<void> | null = null
  let timer: ReturnType<typeof setInterval> | undefined
  let dropped = 0
  let failedBatches = 0
  let lastSuccessAt: string | null = null
  const enabled = Boolean(options.token && options.dataset)
  const fetcher = options.fetcher ?? fetch

  function emit(event: WideEvent) {
    if (!enabled) return
    if (queue.length >= 500) {
      dropped++
      return
    }
    queue.push({
      ...event,
      _time: new Date().toISOString(),
      schema_version: 1,
      service: 'upside-down',
      environment: options.environment ?? 'development',
      deployment: options.version ?? 'local',
    })
    if (!timer) {
      timer = setInterval(() => void flush(), 2000)
      timer.unref?.()
    }
  }

  function flush(): Promise<void> {
    if (sending) return sending
    if (!queue.length) return Promise.resolve()
    const batch = queue.splice(0, 100)
    sending = (async () => {
      try {
        const response = await fetcher(
          `https://us-east-1.aws.edge.axiom.co/v1/ingest/${encodeURIComponent(options.dataset!)}`,
          {
            method: 'POST',
            headers: {
              authorization: `Bearer ${options.token}`,
              'content-type': 'application/json',
            },
            body: JSON.stringify(batch),
            signal: AbortSignal.timeout(3000),
          },
        )
        if (!response.ok) throw new Error('ingest failed')
        const result = (await response.json()) as { failed?: number }
        dropped += result.failed ?? 0
        if (result.failed) failedBatches++
        else lastSuccessAt = new Date().toISOString()
      } catch {
        // No unbounded retries, no response bodies or credentials in logs.
        dropped += batch.length
        failedBatches++
      } finally {
        sending = null
      }
    })()
    return sending
  }

  async function close() {
    if (timer) clearInterval(timer)
    timer = undefined
    await sending
    while (queue.length) await flush()
  }

  return {
    emit,
    flush,
    close,
    stats: () => ({ queued: queue.length, dropped, enabled, failedBatches, lastSuccessAt }),
  }
}

export const telemetry = createTelemetry({
  token: process.env.AXIOM_TOKEN,
  dataset: process.env.AXIOM_DATASET,
  version: process.env.RAILWAY_DEPLOYMENT_ID ?? process.env.RAILWAY_GIT_COMMIT_SHA,
  environment: process.env.NODE_ENV,
})
