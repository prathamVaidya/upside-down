import { useEffect, useMemo, useSyncExternalStore } from 'react'
import type { Role, RoomSnapshot } from './client.ts'
import { defaultSocketUrl, RoomClient } from './client.ts'

export type UseRoom = RoomSnapshot & { client: RoomClient }

/**
 * One hook, one socket, one view.
 *
 * `useSyncExternalStore` rather than `useState` in an effect: the client owns
 * the socket and outlives React's render cycle, which keeps StrictMode's double
 * mount from opening two connections and racing two rooms into existence.
 */
export function useRoom(role: Role, url = defaultSocketUrl()): UseRoom {
  const client = useMemo(() => new RoomClient(url, role), [url, role])

  useEffect(() => {
    client.connect()
    return () => client.close()
  }, [client])

  const snapshot = useSyncExternalStore(client.subscribe, client.snapshot, client.snapshot)
  return { ...snapshot, client }
}
