import type { PacketIndex } from '../packet'
import type { ExtractedValue } from '../packet/types'

/** The printed text of one page (or the whole document when no page is given). */
export function docText(idx: PacketIndex, docId: string, page?: number): string {
  const doc = idx.docs.get(docId)
  if (!doc) return ''
  const pages = page ? doc.pages.filter((p) => p.page === page) : doc.pages
  return pages.map((p) => p.printed_content).join('\n')
}

/** Find an extracted value by document and field name. */
export function evByField(idx: PacketIndex, docId: string, field: string): ExtractedValue | undefined {
  return idx.evsByDoc.get(docId)?.find((e) => e.field === field)
}

export function evNumber(idx: PacketIndex, docId: string, field: string): number {
  const v = evByField(idx, docId, field)?.value
  return typeof v === 'number' ? v : 0
}

/** "1,234.50" -> 1234.5 */
export function parseMoney(text: string): number {
  return Number(text.replace(/[,$]/g, ''))
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function round0(n: number): number {
  return Math.round(n)
}

export function lineNum(idx: PacketIndex, key: string): number {
  const v = idx.lineMaps.get(idx.current.version)?.get(key)?.value
  return typeof v === 'number' ? v : 0
}

export function usd(n: number, cents = false): string {
  const abs = Math.abs(n)
  const body = abs.toLocaleString('en-US', {
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  })
  return `${n < 0 ? '−' : ''}$${body}`
}
