import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { content, type Prompt } from '@ud/content'
import { z } from 'zod'

export type VoteValue = -1 | 0 | 1

export type QuestionTally = Prompt & { up: number; down: number; mine: VoteValue }

/**
 * Where votes live between restarts. The game itself keeps nothing (see
 * ARCHITECTURE §7); these are anonymous thumbs on public CC0 prompts, keyed by a
 * random id the browser invents, so a flat JSON file is all they deserve. On
 * Railway, point `UD_VOTES_FILE` at a mounted volume or they reset each deploy.
 */
export const DEFAULT_VOTES_FILE = fileURLToPath(
  new URL('../../../data/votes.json', import.meta.url),
)

const VoterId = z.uuid()
const VoteBody = z.object({
  voterId: VoterId,
  value: z.union([z.literal(-1), z.literal(0), z.literal(1)]),
})
const VoteFile = z.record(z.string(), z.record(z.string(), z.union([z.literal(-1), z.literal(1)])))

/**
 * promptId → voterId → ±1. One vote per voter per question; sending the same
 * value again is idempotent and 0 takes it back.
 */
export class VoteStore {
  private readonly votes = new Map<string, Map<string, 1 | -1>>()
  private flushTimer: ReturnType<typeof setTimeout> | null = null

  constructor(
    private readonly file: string | null = process.env.UD_VOTES_FILE ?? DEFAULT_VOTES_FILE,
    private readonly prompts: Prompt[] = content().prompts,
  ) {
    if (file) this.load(file)
  }

  private load(file: string) {
    let raw: string
    try {
      raw = readFileSync(file, 'utf8')
    } catch {
      return // first run
    }
    const parsed = VoteFile.safeParse(JSON.parse(raw))
    if (!parsed.success) throw new Error(`votes file ${file} is malformed`)
    for (const [promptId, voters] of Object.entries(parsed.data)) {
      this.votes.set(promptId, new Map(Object.entries(voters)))
    }
  }

  /** Every prompt, in content order, with its tallies and this voter's own vote. */
  list(voterId?: string): QuestionTally[] {
    const me = voterId && VoterId.safeParse(voterId).success ? voterId : null
    return this.prompts.map((p) => this.tally(p, me))
  }

  vote(promptId: string, voterId: string, value: VoteValue): QuestionTally | null {
    const prompt = this.prompts.find((p) => p.id === promptId)
    if (!prompt) return null
    const voters = this.votes.get(promptId) ?? new Map<string, 1 | -1>()
    if (value === 0) voters.delete(voterId)
    else voters.set(voterId, value)
    if (voters.size) this.votes.set(promptId, voters)
    else this.votes.delete(promptId)
    this.scheduleFlush()
    return this.tally(prompt, voterId)
  }

  private tally(prompt: Prompt, voterId: string | null): QuestionTally {
    let up = 0
    let down = 0
    const voters = this.votes.get(prompt.id)
    for (const v of voters?.values() ?? []) v === 1 ? up++ : down++
    return { ...prompt, up, down, mine: (voterId && voters?.get(voterId)) || 0 }
  }

  /** Coalesce bursts of clicks into one write; temp-file + rename so a crash never truncates. */
  private scheduleFlush() {
    if (!this.file || this.flushTimer) return
    this.flushTimer = setTimeout(() => this.flush(), 500)
  }

  flush() {
    if (this.flushTimer) clearTimeout(this.flushTimer)
    this.flushTimer = null
    if (!this.file) return
    const data: Record<string, Record<string, 1 | -1>> = {}
    for (const [promptId, voters] of this.votes) data[promptId] = Object.fromEntries(voters)
    mkdirSync(dirname(this.file), { recursive: true })
    const tmp = `${this.file}.tmp`
    writeFileSync(tmp, JSON.stringify(data))
    renameSync(tmp, this.file)
  }

  /**
   * `/api/*` routes. Returns null for everything else so the caller can fall
   * through to static files without awaiting anything.
   */
  handle(req: Request, url: URL): Promise<Response> | null {
    if (!url.pathname.startsWith('/api/')) return null
    return this.route(req, url)
  }

  private async route(req: Request, url: URL): Promise<Response> {
    const noStore = { 'cache-control': 'no-store' }
    if (url.pathname === '/api/questions' && req.method === 'GET') {
      return Response.json(
        { questions: this.list(url.searchParams.get('voter') ?? undefined) },
        { headers: noStore },
      )
    }
    const match = url.pathname.match(/^\/api\/questions\/([a-z]{1,3}-\d{3})\/vote$/)
    if (match && req.method === 'POST') {
      const body = VoteBody.safeParse(await req.json().catch(() => null))
      if (!body.success) return Response.json({ error: 'BAD_VOTE' }, { status: 400 })
      const result = this.vote(match[1]!, body.data.voterId, body.data.value)
      if (!result) return Response.json({ error: 'UNKNOWN_QUESTION' }, { status: 404 })
      return Response.json({ question: result }, { headers: noStore })
    }
    return Response.json({ error: 'NOT_FOUND' }, { status: 404 })
  }
}
