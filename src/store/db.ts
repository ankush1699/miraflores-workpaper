import { openDB, type IDBPDatabase } from 'idb'
import type { WorkEvent } from './types'

// Events are the only thing we persist. The browser database keeps them between visits;
// if it is unavailable (some private windows), we keep them in memory for the session.

const DB_NAME = 'miraflores-workpaper'
const STORE = 'events'

let dbPromise: Promise<IDBPDatabase | null> | null = null
let memory: WorkEvent[] = []

function db(): Promise<IDBPDatabase | null> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(d) {
        d.createObjectStore(STORE, { keyPath: 'id' })
      },
    }).catch(() => null)
  }
  return dbPromise
}

export async function loadEvents(): Promise<WorkEvent[]> {
  const d = await db()
  if (!d) return memory
  const all = (await d.getAll(STORE)) as WorkEvent[]
  return sortEvents(all)
}

export async function appendEvents(events: WorkEvent[]): Promise<void> {
  const d = await db()
  if (!d) {
    memory = sortEvents([...memory, ...events])
    return
  }
  const tx = d.transaction(STORE, 'readwrite')
  for (const e of events) tx.store.put(e)
  await tx.done
}

export async function clearEvents(): Promise<void> {
  memory = []
  const d = await db()
  if (d) await d.clear(STORE)
}

export function sortEvents(events: WorkEvent[]): WorkEvent[] {
  return [...events].sort((a, b) => (a.at === b.at ? a.id.localeCompare(b.id) : a.at.localeCompare(b.at)))
}

/** A channel between tabs, so two people in two windows see each other's work as it happens. */
export function openChannel(): BroadcastChannel | null {
  try {
    return new BroadcastChannel('miraflores-workpaper')
  } catch {
    return null
  }
}
