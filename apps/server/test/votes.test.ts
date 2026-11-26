import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Prompt } from '@ud/content'
import { afterEach, expect, it } from 'vitest'
import { VoteStore } from '../src/votes.ts'

const prompts: Prompt[] = [
  { id: 'g-001', region: 'global', level: 1, text: 'First question here' },
  { id: 'uk-002', region: 'uk', level: 2, text: 'Second question here' },
]
const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'
const dirs: string[] = []
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

it('keeps one vote per voter, lets it flip or be withdrawn, and reports your own', () => {
  const store = new VoteStore(null, prompts)
  store.vote('g-001', A, 1)
  store.vote('g-001', A, 1)
  store.vote('g-001', B, -1)
  expect(store.list(A)[0]).toMatchObject({ up: 1, down: 1, mine: 1 })
  expect(store.list(B)[0]).toMatchObject({ mine: -1 })
  store.vote('g-001', A, -1)
  expect(store.list()[0]).toMatchObject({ up: 0, down: 2, mine: 0 })
  store.vote('g-001', A, 0)
  expect(store.list(A)[0]).toMatchObject({ up: 0, down: 1, mine: 0 })
  expect(store.vote('zz-999', A, 1)).toBeNull()
})

it('survives a restart through the votes file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ud-votes-'))
  dirs.push(dir)
  const file = join(dir, 'nested', 'votes.json')
  const first = new VoteStore(file, prompts)
  first.vote('uk-002', A, 1)
  first.flush()
  expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({ 'uk-002': { [A]: 1 } })
  expect(new VoteStore(file, prompts).list(A)[1]).toMatchObject({ up: 1, mine: 1 })
})

it('serves the HTTP routes and rejects bad votes', async () => {
  const store = new VoteStore(null, prompts)
  const call = (path: string, init?: RequestInit) => {
    const req = new Request(`http://x${path}`, init)
    return store.handle(req, new URL(req.url))
  }
  const post = (id: string, body: unknown) =>
    call(`/api/questions/${id}/vote`, { method: 'POST', body: JSON.stringify(body) })

  expect((await post('g-001', { voterId: A, value: 1 }))!.status).toBe(200)
  expect((await post('g-001', { voterId: 'nope', value: 1 }))!.status).toBe(400)
  expect((await post('g-001', { voterId: A, value: 5 }))!.status).toBe(400)
  expect((await post('g-404', { voterId: A, value: 1 }))!.status).toBe(404)
  const list = await (await call(`/api/questions?voter=${A}`))!.json()
  expect(list.questions[0]).toMatchObject({ id: 'g-001', up: 1, mine: 1 })
  expect(await call('/questions')).toBeNull()
})
