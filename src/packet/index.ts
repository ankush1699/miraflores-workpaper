import type { Doc, ExtractedValue, Packet, ReturnLine, ReturnVersion } from './types'

// The workpaper is organised around the same areas the firm budgets hours against,
// so "time vs budget" and "who owns this area" line up with what the preparer sees.
export const AREAS = [
  { id: 'intake_and_engagement', label: 'Intake & engagement' },
  { id: 'wages_and_stock_compensation', label: 'Wages, stock comp & retirement' },
  { id: 'investments_and_digital_assets', label: 'Investments & digital assets' },
  { id: 'business', label: 'Business (Lindqvist Studio)' },
  { id: 'rentals_and_sale', label: 'Rentals & the condo sale' },
  { id: 'pass_throughs_and_basis', label: 'Pass-throughs & basis' },
  { id: 'deductions_and_credits', label: 'Deductions & credits' },
  { id: 'california', label: 'California (540NR)' },
  { id: 'partner_review', label: 'Partner review' },
  { id: 'return_summary', label: 'Return totals & payments' },
] as const

export type AreaId = (typeof AREAS)[number]['id']

export function areaLabel(id: string): string {
  return AREAS.find((a) => a.id === id)?.label ?? id
}

/** Decide which area a return line belongs to. Order matters: the specific rules come first. */
export function areaOfLine(key: string): AreaId {
  const k = key
  if (/^(SchCA540NR|F540NR|ScheduleS|FTB)/.test(k)) return 'california'
  if (/^(F8949)/.test(k)) return 'investments_and_digital_assets'
  if (/^(SchD\.(11|19))$/.test(k) || /^SchD\.(11|19)$/.test(k)) return 'rentals_and_sale'
  if (k === 'SchD.12') return 'pass_throughs_and_basis'
  if (/^SchD\./.test(k) || /^SchB\./.test(k) || /^F8960/.test(k) || /^F8938/.test(k)) return 'investments_and_digital_assets'
  if (/^(SchC|SchSE|F4562-C|F8995)/.test(k) || /^Sch1\.(15|16|17)$/.test(k) || k === 'Sch2.4') return 'business'
  if (/^(F4562-E|F4797|F8582)/.test(k) || /^SchE\.\d+[AB]$/.test(k) || /^SchE\.(26|41)$/.test(k)) return 'rentals_and_sale'
  if (/^SchE\.(28[AB]|32)$/.test(k) || /^F7203/.test(k)) return 'pass_throughs_and_basis'
  if (/^(SchA|F8283|F8812|F8863|F2441|F8867)/.test(k) || /^Sch3\.(1|8)$/.test(k)) return 'deductions_and_credits'
  if (/^(F8606|F8889|F8959|F6251)/.test(k) || /^F1040\.(1a|1z|4a|4b)$/.test(k) || k === 'Sch1.13' || k === 'Sch3.11') {
    return 'wages_and_stock_compensation'
  }
  return 'return_summary'
}

export interface PacketIndex {
  packet: Packet
  docs: Map<string, Doc>
  docList: Doc[]
  evs: Map<string, ExtractedValue>
  evsByDoc: Map<string, ExtractedValue[]>
  versions: ReturnVersion[]
  current: ReturnVersion
  lineMaps: Map<string, Map<string, ReturnLine>>
  /** current version only: extracted value id -> lines that read it */
  linesByEv: Map<string, ReturnLine[]>
  /** current version only: line key -> lines that take it as an input */
  usedBy: Map<string, ReturnLine[]>
  /** current version only: document id -> lines that read any of its values */
  docLanding: Map<string, ReturnLine[]>
  param: (name: string) => any
}

export async function loadPacket(): Promise<Packet> {
  const res = await fetch(`${import.meta.env.BASE_URL}packet.json`)
  if (!res.ok) throw new Error(`Could not load the packet (${res.status})`)
  return (await res.json()) as Packet
}

export function buildIndex(packet: Packet): PacketIndex {
  const docs = new Map(packet.documents.map((d) => [d.id, d]))
  const evs = new Map(packet.extracted_values.map((e) => [e.id, e]))

  const evsByDoc = new Map<string, ExtractedValue[]>()
  for (const e of packet.extracted_values) {
    const list = evsByDoc.get(e.document_id) ?? []
    list.push(e)
    evsByDoc.set(e.document_id, list)
  }

  const lineMaps = new Map<string, Map<string, ReturnLine>>()
  for (const v of packet.return_versions) lineMaps.set(v.version, new Map(v.lines.map((l) => [l.key, l])))

  const versions = packet.return_versions
  const current = versions[versions.length - 1]

  const linesByEv = new Map<string, ReturnLine[]>()
  const usedBy = new Map<string, ReturnLine[]>()
  const docLanding = new Map<string, ReturnLine[]>()
  for (const line of current.lines) {
    for (const input of line.inputs) {
      const list = usedBy.get(input) ?? []
      list.push(line)
      usedBy.set(input, list)
    }
    for (const src of line.sources) {
      if (!src.startsWith('ev-')) continue
      const byEv = linesByEv.get(src) ?? []
      byEv.push(line)
      linesByEv.set(src, byEv)
      const ev = evs.get(src)
      if (!ev) continue
      const byDoc = docLanding.get(ev.document_id) ?? []
      if (!byDoc.includes(line)) byDoc.push(line)
      docLanding.set(ev.document_id, byDoc)
    }
  }

  const params = packet.engine_reference.parameters
  return {
    packet, docs, docList: packet.documents, evs, evsByDoc, versions, current,
    lineMaps, linesByEv, usedBy, docLanding,
    param: (name) => params[name],
  }
}

export function lineIn(idx: PacketIndex, key: string, version?: string): ReturnLine | undefined {
  return idx.lineMaps.get(version ?? idx.current.version)?.get(key)
}

export function numeric(line: ReturnLine | undefined): number {
  return typeof line?.value === 'number' ? line.value : 0
}
