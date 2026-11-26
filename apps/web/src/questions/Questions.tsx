import { Wordmark } from '@ud/clay'
import type { ContentLevel, Region } from '@ud/protocol'
import { useEffect, useMemo, useState } from 'react'
import { voterId } from './voter.ts'
import './questions.css'

export type Vote = -1 | 0 | 1

export type Question = {
  id: string
  region: Region
  level: ContentLevel
  text: string
  up: number
  down: number
  mine: Vote
}

const REGION_LABEL: Record<Region, string> = { global: 'Global', in: 'India', uk: 'UK', us: 'US' }
const LEVEL_LABEL: Record<ContentLevel, string> = {
  1: 'HR approved',
  2: 'Medium roast',
  3: 'Burn in Hell',
}
const SORTS = { top: 'Top voted', worst: 'Least liked', index: 'Index order' } as const
type Sort = keyof typeof SORTS

export type QuestionsApi = {
  list: (voter: string) => Promise<Question[]>
  vote: (id: string, voter: string, value: Vote) => Promise<Question>
}

export const httpApi: QuestionsApi = {
  async list(voter) {
    const res = await fetch(`/api/questions?voter=${encodeURIComponent(voter)}`)
    if (!res.ok) throw new Error(`list failed: ${res.status}`)
    return (await res.json()).questions
  },
  async vote(id, voter, value) {
    const res = await fetch(`/api/questions/${id}/vote`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ voterId: voter, value }),
    })
    if (!res.ok) throw new Error(`vote failed: ${res.status}`)
    return (await res.json()).question
  },
}

/** Apply a vote locally so the tap feels instant; the server reply then overwrites it. */
function optimistic(q: Question, value: Vote): Question {
  const up = q.up - (q.mine === 1 ? 1 : 0) + (value === 1 ? 1 : 0)
  const down = q.down - (q.mine === -1 ? 1 : 0) + (value === -1 ? 1 : 0)
  return { ...q, up, down, mine: value }
}

export function Questions({ api = httpApi }: { api?: QuestionsApi }) {
  const voter = useMemo(() => voterId(), [])
  const [questions, setQuestions] = useState<Question[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [query, setQuery] = useState('')
  const [region, setRegion] = useState<Region | 'all'>('all')
  const [level, setLevel] = useState<ContentLevel | 0>(0)
  const [sort, setSort] = useState<Sort>('index')

  useEffect(() => {
    api.list(voter).then(setQuestions, () => setFailed(true))
  }, [api, voter])

  // Permalinks like /questions#g-014 point at rows that only exist once the list arrives.
  const loaded = questions !== null
  useEffect(() => {
    if (loaded && location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView()
  }, [loaded])

  const cast = (q: Question, pressed: 1 | -1) => {
    const value: Vote = q.mine === pressed ? 0 : pressed
    const before = q
    setQuestions((all) => all?.map((x) => (x.id === q.id ? optimistic(x, value) : x)) ?? all)
    api.vote(q.id, voter, value).then(
      (fresh) => setQuestions((all) => all?.map((x) => (x.id === fresh.id ? fresh : x)) ?? all),
      () => setQuestions((all) => all?.map((x) => (x.id === before.id ? before : x)) ?? all),
    )
  }

  const shown = useMemo(() => {
    if (!questions) return []
    const needle = query.trim().toLowerCase()
    const filtered = questions.filter(
      (q) =>
        (region === 'all' || q.region === region) &&
        (level === 0 || q.level === level) &&
        (!needle || q.text.toLowerCase().includes(needle) || q.id.includes(needle)),
    )
    if (sort === 'index') return filtered
    const score = (q: Question) => q.up - q.down
    return [...filtered].sort((a, b) =>
      sort === 'top' ? score(b) - score(a) || b.up - a.up : score(a) - score(b) || b.down - a.down,
    )
  }, [questions, query, region, level, sort])

  const myVotes = questions?.filter((q) => q.mine !== 0).length ?? 0

  return (
    <main className="questions-page">
      <header className="questions-page__header">
        <a href="/" aria-label="Upside Down home">
          <Wordmark size={20} />
        </a>
        <a href="/">Back to the game</a>
      </header>

      <section className="questions-page__intro">
        <h1>Every question</h1>
        <p>
          All {questions?.length ?? '…'} prompts in the deck. Thumb up the ones that make a room
          howl, thumb down the duds. Votes are anonymous: this browser gets a random id, and that is
          all we keep.
        </p>
      </section>

      <form
        className="questions-page__filters"
        aria-label="Filter questions"
        onSubmit={(e) => e.preventDefault()}
      >
        <input
          type="search"
          placeholder="Search questions or ids"
          aria-label="Search questions"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          aria-label="Region"
          value={region}
          onChange={(e) => setRegion(e.target.value as Region | 'all')}
        >
          <option value="all">All regions</option>
          {(Object.keys(REGION_LABEL) as Region[]).map((r) => (
            <option key={r} value={r}>
              {REGION_LABEL[r]}
            </option>
          ))}
        </select>
        <select
          aria-label="Level"
          value={level}
          onChange={(e) => setLevel(Number(e.target.value) as ContentLevel | 0)}
        >
          <option value={0}>All levels</option>
          {([1, 2, 3] as const).map((l) => (
            <option key={l} value={l}>
              {LEVEL_LABEL[l]}
            </option>
          ))}
        </select>
        <select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
          {(Object.keys(SORTS) as Sort[]).map((s) => (
            <option key={s} value={s}>
              {SORTS[s]}
            </option>
          ))}
        </select>
      </form>

      {failed ? (
        <p className="questions-page__status" role="alert">
          Couldn't load the questions. Refresh to try again.
        </p>
      ) : !questions ? (
        <p className="questions-page__status">Loading questions…</p>
      ) : (
        <>
          <p className="questions-page__count" aria-live="polite">
            Showing {shown.length} of {questions.length}
            {myVotes > 0 && ` · you've voted on ${myVotes}`}
          </p>
          {shown.length === 0 ? (
            <p className="questions-page__status">No questions match those filters.</p>
          ) : (
            <ol className="questions-page__list">
              {shown.map((q) => (
                <li key={q.id} id={q.id} className="questions-page__item">
                  <div className="questions-page__body">
                    <p className="questions-page__text">{q.text}</p>
                    <p className="questions-page__meta">
                      <a href={`#${q.id}`} className="questions-page__id">
                        {q.id}
                      </a>
                      <span>{REGION_LABEL[q.region]}</span>
                      <span className={`questions-page__level questions-page__level--${q.level}`}>
                        {LEVEL_LABEL[q.level]}
                      </span>
                    </p>
                  </div>
                  <fieldset className="questions-page__votes" aria-label={`Vote on ${q.id}`}>
                    <button
                      type="button"
                      aria-pressed={q.mine === 1}
                      aria-label={`Upvote: ${q.text}`}
                      onClick={() => cast(q, 1)}
                    >
                      <span aria-hidden="true">▲</span> {q.up}
                    </button>
                    <button
                      type="button"
                      aria-pressed={q.mine === -1}
                      aria-label={`Downvote: ${q.text}`}
                      onClick={() => cast(q, -1)}
                    >
                      <span aria-hidden="true">▼</span> {q.down}
                    </button>
                  </fieldset>
                </li>
              ))}
            </ol>
          )}
        </>
      )}

      <footer className="questions-page__footer">
        <a href="https://github.com/prathamVaidya/upside-down/tree/main/content/prompts">
          Suggest a question on GitHub
        </a>
        <a href="/privacy">Privacy policy</a>
      </footer>
    </main>
  )
}
