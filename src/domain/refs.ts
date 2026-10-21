import type { PacketIndex } from '../packet'
import type { ExtractedValue } from '../packet/types'

/**
 * Anything evidence can point at is written as a short reference: "line:SchC.1", "ev:ev-0103",
 * "doc:D15#page3", "qa:qa-14", "msg:msg-07", "call:call-01", "py:/return_2024/lines/F1040.11",
 * "agency:/efile/0", "household:theo", "asset:SAC-BLDG", "whatif:equipment_section179".
 * This file turns a reference into something a person can read.
 */

export interface ResolvedRef {
  kind: string
  title: string
  detail?: string
}

export function splitRef(ref: string): { kind: string; id: string; page?: number } {
  const i = ref.indexOf(':')
  const kind = i < 0 ? 'text' : ref.slice(0, i)
  let id = i < 0 ? ref : ref.slice(i + 1)
  let page: number | undefined
  const h = id.indexOf('#page')
  if (h >= 0) {
    page = Number(id.slice(h + 5))
    id = id.slice(0, h)
  }
  return { kind, id, page }
}

export function resolveRef(idx: PacketIndex, ref: string): ResolvedRef {
  const { kind, id, page } = splitRef(ref)
  switch (kind) {
    case 'line': {
      const l = idx.lineMaps.get(idx.current.version)?.get(id)
      return { kind: 'Line', title: l ? `${id} · ${l.label}` : id }
    }
    case 'ev': {
      const e = idx.evs.get(id)
      return { kind: 'Value', title: e ? `${e.label} (${idx.docs.get(e.document_id)?.id}, p${e.page})` : id }
    }
    case 'doc': {
      const d = idx.docs.get(id)
      return { kind: 'Document', title: d ? `${id} · ${d.title}${page ? ` · page ${page}` : ''}` : id }
    }
    case 'qa': {
      const q = idx.packet.client.questionnaire.find((x) => x.id === id)
      return { kind: 'Questionnaire', title: q ? `${id}: ${q.question}` : id, detail: q?.answer }
    }
    case 'msg': {
      const m = idx.packet.client.messages.find((x) => x.id === id)
      return { kind: 'Client message', title: m ? `${m.from}, ${m.sent_at.slice(0, 10)}` : id, detail: m?.text }
    }
    case 'call': {
      const c = idx.packet.client.call_notes.find((x) => x.id === id)
      return { kind: 'Call notes', title: c ? `${c.date.slice(0, 10)} with ${c.participants.join(' and ')}` : id, detail: c?.notes.join(' ') }
    }
    case 'py':
      return { kind: 'Prior year', title: id.replace(/^\//, '').replace(/\//g, ' › '), detail: String(pointer(idx.packet.prior_years, id) ?? '') }
    case 'agency':
      return { kind: 'Agency record', title: id.replace(/^\//, '').replace(/\//g, ' › ') }
    case 'household': {
      const p = idx.packet.household.people.find((x) => x.id === id)
      return { kind: 'Household', title: p ? p.name : id }
    }
    case 'asset':
      return { kind: 'Asset', title: id }
    case 'whatif': {
      const w = idx.packet.what_if.alternatives.find((x) => x.id === id)
      return { kind: 'What-if', title: w?.description ?? id }
    }
    case 'ref':
      return { kind: 'Engine reference', title: id }
    case 'finding':
      return { kind: 'Finding', title: id }
    case 'thread':
      return { kind: 'Note', title: id }
    default:
      return { kind: 'Item', title: ref }
  }
}

/** Walk a JSON Pointer (RFC 6901) like "/return_2024/lines/F1040.11" through an object. */
export function pointer(root: unknown, path: string): unknown {
  let cur: any = root
  for (const part of path.split('/').filter(Boolean)) {
    if (cur == null) return undefined
    cur = cur[part.replace(/~1/g, '/').replace(/~0/g, '~')]
  }
  return cur
}

/* ------------------------------------------------------------- page text */

export interface Segment { text: string; ev?: ExtractedValue }

function candidates(e: ExtractedValue): string[] {
  const out: string[] = []
  if (e.text_as_read) out.push(e.text_as_read)
  if (typeof e.value === 'number') {
    const cents = e.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    out.push(cents, cents.replace(/\.00$/, ''), String(e.value))
  }
  if (typeof e.value === 'string' && e.value) out.push(e.value)
  return [...new Set(out)].filter((s) => s.length > 0)
}

/**
 * Split a page's printed text into plain and highlighted pieces. The packet gives synthetic
 * coordinates only, so we locate each extracted value by its text instead. Values arrive in
 * reading order, so we search forward from the last match first.
 */
export function segmentPage(text: string, evs: ExtractedValue[]): Segment[] {
  const taken: { start: number; end: number; ev: ExtractedValue }[] = []
  const overlaps = (s: number, e: number) => taken.some((t) => s < t.end && e > t.start)
  let cursor = 0
  for (const ev of evs) {
    let hit: { start: number; end: number } | null = null
    for (const cand of candidates(ev)) {
      for (const from of [cursor, 0]) {
        let at = text.indexOf(cand, from)
        while (at >= 0 && overlaps(at, at + cand.length)) at = text.indexOf(cand, at + 1)
        if (at >= 0) { hit = { start: at, end: at + cand.length }; break }
      }
      if (hit) break
    }
    if (hit) {
      taken.push({ ...hit, ev })
      cursor = hit.end
    }
  }
  taken.sort((a, b) => a.start - b.start)
  const out: Segment[] = []
  let pos = 0
  for (const t of taken) {
    if (t.start > pos) out.push({ text: text.slice(pos, t.start) })
    out.push({ text: text.slice(t.start, t.end), ev: t.ev })
    pos = t.end
  }
  if (pos < text.length) out.push({ text: text.slice(pos) })
  return out
}
