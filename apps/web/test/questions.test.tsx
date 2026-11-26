// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { type Question, Questions, type QuestionsApi } from '../src/questions/Questions.tsx'
import { resetVoterMemo, voterId } from '../src/questions/voter.ts'

afterEach(() => {
  cleanup()
  resetVoterMemo()
  localStorage.clear()
})

const seed: Question[] = [
  {
    id: 'g-001',
    region: 'global',
    level: 1,
    text: 'A terrible name for a boy band',
    up: 2,
    down: 0,
    mine: 0,
  },
  {
    id: 'uk-001',
    region: 'uk',
    level: 3,
    text: 'What the queue is really for',
    up: 0,
    down: 3,
    mine: 0,
  },
]

function fakeApi() {
  const calls: Array<[string, string, number]> = []
  const api: QuestionsApi = {
    list: async () => structuredClone(seed),
    vote: async (id, voter, value) => {
      calls.push([id, voter, value])
      const q = seed.find((x) => x.id === id)!
      return { ...q, up: q.up + (value === 1 ? 1 : 0), mine: value }
    },
  }
  return { api, calls }
}

it('persists one random voter id per browser', () => {
  const id = voterId()
  expect(id).toMatch(/^[0-9a-f-]{36}$/)
  resetVoterMemo()
  expect(voterId()).toBe(id)
  expect(localStorage.getItem('ud-voter-id')).toBe(id)
})

it('indexes every question, filters them, and toggles a vote', async () => {
  const { api, calls } = fakeApi()
  render(<Questions api={api} />)
  const rows = await screen.findAllByRole('listitem')
  expect(rows).toHaveLength(2)
  expect(within(rows[0]!).getByRole('link', { name: 'g-001' }).getAttribute('href')).toBe('#g-001')

  fireEvent.change(screen.getByLabelText('Region'), { target: { value: 'uk' } })
  expect(screen.getAllByRole('listitem')).toHaveLength(1)
  fireEvent.change(screen.getByLabelText('Region'), { target: { value: 'all' } })
  fireEvent.change(screen.getByLabelText('Search questions'), { target: { value: 'boy band' } })
  expect(screen.getAllByRole('listitem')).toHaveLength(1)

  const up = screen.getByRole('button', { name: /^Upvote: A terrible name/ })
  fireEvent.click(up)
  expect(up.getAttribute('aria-pressed')).toBe('true')
  expect(up.textContent).toContain('3')
  await screen.findByText(/you've voted on 1/)
  fireEvent.click(up)
  expect(up.getAttribute('aria-pressed')).toBe('false')
  expect(calls.map((c) => c[2])).toEqual([1, 0])
  expect(calls[0]![1]).toBe(localStorage.getItem('ud-voter-id'))
})
