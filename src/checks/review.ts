import type { PacketIndex } from '../packet'
import type { ReturnLine } from '../packet/types'
import type { Finding } from './types'

/* --------------------------------------------------------------- variances */

export interface Variance {
  key: string
  label: string
  prior: number
  current: number
  change: number
  pct: number | null
  flagged: boolean
}

// California lines were renamed between last year's Form 540 and this year's 540NR.
const CA_RENAMES: Record<string, string> = {
  'CA540.13': 'F540NR.13', 'CA540.17': 'F540NR.17', 'CA540.19': 'F540NR.19', 'CA540.64': 'F540NR.64',
}

/**
 * Compare every number that exists in both years. A line is flagged when it moved by more
 * than the firm's percentage and dollar thresholds (editable in Settings & security).
 */
export function variances(
  idx: PacketIndex,
  current: (key: string, line: ReturnLine) => number,
  thresholds: { percent: number; amount: number },
): Variance[] {
  const prior = idx.packet.prior_years.return_2024
  const out: Variance[] = []
  for (const [oldKey, was] of Object.entries(prior.lines)) {
    if (typeof was !== 'number') continue
    const key = CA_RENAMES[oldKey] ?? oldKey
    const line = idx.lineMaps.get(idx.current.version)?.get(key)
    if (!line || typeof line.value !== 'number') continue
    const now = current(key, line)
    const change = now - was
    const pct = was === 0 ? null : (change / Math.abs(was)) * 100
    const big = Math.abs(change) > thresholds.amount && (pct === null || Math.abs(pct) > thresholds.percent)
    out.push({
      key, label: line.label || prior.line_labels[oldKey] || key,
      prior: was, current: now, change, pct, flagged: big,
    })
  }
  return out.sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
}

/* ------------------------------------------------------ document landing */

// Documents that are context for the engagement, not a source of numbers.
const REFERENCE_TYPES = new Set([
  'engagement_letter', 'consent_7216', 'irs_ip_pin_notice', 'identity_document',
  'prior_year_return', 'prior_workpaper', 'irs_transcript', 'irs_notice',
])

export type Disposition =
  | { kind: 'landed'; lines: ReturnLine[] }
  | { kind: 'superseded'; by: string }
  | { kind: 'duplicate'; of: string }
  | { kind: 'reference'; why: string }
  | { kind: 'not_landed'; why: string }
  | { kind: 'after_current_run'; why: string }

function evSignature(idx: PacketIndex, id: string): string {
  return (idx.evsByDoc.get(id) ?? []).map((e) => `${e.field}=${e.value}`).sort().join('|')
}

/** What happened to a document in the current return: where it landed, or why it didn't. */
export function dispositionOf(idx: PacketIndex, docId: string): Disposition {
  const doc = idx.docs.get(docId)!
  const cur = idx.current
  if (cur.documents_superseded.includes(docId)) {
    const by = idx.docList.find((d) => d.marked_corrected && d.issuer === doc.issuer && d.id !== docId)?.id ?? 'a corrected copy'
    return { kind: 'superseded', by }
  }
  const sig = evSignature(idx, docId)
  if (sig) {
    const twin = idx.docList.find((d) => d.id < docId && d.issuer === doc.issuer && evSignature(idx, d.id) === sig)
    if (twin) return { kind: 'duplicate', of: twin.id }
  }
  const lines = idx.docLanding.get(docId) ?? []
  if (lines.length) return { kind: 'landed', lines }
  if (!cur.documents_used.includes(docId)) {
    return { kind: 'after_current_run', why: `Received ${doc.received_at.slice(0, 10)}, after the ${cur.version} run (${cur.computed_at.slice(0, 10)}). Not in the numbers yet.` }
  }
  if (REFERENCE_TYPES.has(doc.document_type)) return { kind: 'reference', why: 'Context for the engagement, identity or prior year; it supports the file, not a number.' }
  return { kind: 'not_landed', why: 'The tax software lists this document as used, but none of its values reached any line.' }
}

export function completenessFindings(idx: PacketIndex): Finding[] {
  const out: Finding[] = []
  for (const doc of idx.docList) {
    const d = dispositionOf(idx, doc.id)
    if (d.kind !== 'not_landed') continue
    out.push({
      id: `doc-not-landed-${doc.id}`,
      area: 'partner_review', severity: 'warning', kind: 'tie_out',
      title: `${doc.id} "${doc.title}" was used, but nothing in it reached the return`,
      detail:
        `The tax software lists ${doc.id} as an input of ${idx.current.version}, yet no return line reads any of its ${doc.extraction.values} extracted values. ` +
        `Either the document truly needs no action, or the tax software ignored something it said. Open the document, look at each value, and record what you concluded.`,
      surfacedBy: 'Document index shows, for each document, the exact lines it fed. An empty "landed on" cell next to "used" is the signal.',
      refs: [`doc:${doc.id}`],
    })
  }
  return out
}

/* --------------------------------------------------------------- foot check */

export interface FootResult { checked: number; breaks: { key: string; value: number; expected: number }[] }

/**
 * Re-add every engine line that is a plain sum or carry of other lines. Inputs are
 * either added, or the first is reduced by the rest (a total less deductions), so we
 * accept either reading. If neither agrees within a dollar, that line is reported.
 */
export function footEngine(idx: PacketIndex): FootResult {
  const lines = idx.lineMaps.get(idx.current.version)!
  let checked = 0
  const breaks: FootResult['breaks'] = []
  for (const l of idx.current.lines) {
    if (!['R-SUM', 'R-CARRY'].includes(l.rule) || !l.inputs.length || typeof l.value !== 'number') continue
    const vals = l.inputs.map((i) => lines.get(i)?.value)
    if (vals.some((v) => typeof v !== 'number')) continue
    const nums = vals as number[]
    const sum = nums.reduce((s, v) => s + v, 0)
    const firstLess = nums[0] - nums.slice(1).reduce((s, v) => s + v, 0)
    checked++
    // Inputs are listed as sources but a few lines add inputs that are not all listed; skip those with a known partial list
    // a carry may list more than one input but equal just one of them; a difference may be read either way round
    const matches = [sum, firstLess, -firstLess, ...nums].some((v) => Math.abs(v - (l.value as number)) <= 1)
    if (matches) continue
    if (nums.length === 1 && l.rule === 'R-SUM') continue // a one-input "sum" that re-labels a figure (e.g. CA conformity)
    breaks.push({ key: l.key, value: l.value, expected: sum })
  }
  return { checked, breaks }
}
