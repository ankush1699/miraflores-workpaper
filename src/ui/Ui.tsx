import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { Finding } from '../checks/types'
import { useStore } from '../store/Store'

/** What the "adjust this" dialog is opening for. */
export type AdjustRequest =
  | { kind: 'finding'; finding: Finding }
  | { kind: 'line'; lineKey: string }

interface Ui {
  trace: string | null
  openTrace: (ref: string) => void
  closeTrace: () => void
  adjust: AdjustRequest | null
  openAdjust: (r: AdjustRequest) => void
  closeAdjust: () => void
  palette: boolean
  setPalette: (open: boolean) => void
  /** findings indexed by every reference they cite, so a number can tell if it is flagged */
  findingsByRef: Map<string, Finding[]>
}

const UiContext = createContext<Ui | null>(null)

export function useUi(): Ui {
  const u = useContext(UiContext)
  if (!u) throw new Error('useUi outside UiProvider')
  return u
}

export function UiProvider({ children }: { children: ReactNode }) {
  const { findings } = useStore()
  const [trace, setTrace] = useState<string | null>(null)
  const [adjust, setAdjust] = useState<AdjustRequest | null>(null)
  const [palette, setPalette] = useState(false)

  const findingsByRef = useMemo(() => {
    const m = new Map<string, Finding[]>()
    for (const f of findings) {
      for (const r of f.refs) {
        const list = m.get(r) ?? []
        list.push(f)
        m.set(r, list)
      }
      for (const d of f.fix?.drafts ?? []) {
        const list = m.get(d.target) ?? []
        if (!list.includes(f)) list.push(f)
        m.set(d.target, list)
      }
    }
    return m
  }, [findings])

  const openTrace = useCallback((ref: string) => setTrace(ref), [])
  const closeTrace = useCallback(() => setTrace(null), [])
  const openAdjust = useCallback((r: AdjustRequest) => setAdjust(r), [])
  const closeAdjust = useCallback(() => setAdjust(null), [])

  return (
    <UiContext.Provider value={{ trace, openTrace, closeTrace, adjust, openAdjust, closeAdjust, palette, setPalette, findingsByRef }}>
      {children}
    </UiContext.Provider>
  )
}
