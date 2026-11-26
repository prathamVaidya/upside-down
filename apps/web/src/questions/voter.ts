const KEY = 'ud-voter-id'

let memo: string | null = null

/**
 * An anonymous, per-browser voter id. Not an account and not tied to anything —
 * it only lets the server keep one vote per question per browser. Falls back to
 * an in-memory id when storage is blocked, so the page still works for the visit.
 */
export function voterId(storage: Pick<Storage, 'getItem' | 'setItem'> | null = safeStorage()) {
  if (memo) return memo
  let id: string | null = null
  try {
    id = storage?.getItem(KEY) ?? null
  } catch {}
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    id = crypto.randomUUID()
    try {
      storage?.setItem(KEY, id)
    } catch {}
  }
  memo = id
  return id
}

function safeStorage() {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

/** Test hook. */
export function resetVoterMemo() {
  memo = null
}
