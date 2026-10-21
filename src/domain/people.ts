import type { Packet, StaffMember } from '../packet/types'

export type Role = StaffMember['role'] | 'client'

export interface Actor {
  id: string
  name: string
  role: Role
  credential: string | null
  /** may see SSNs, bank numbers and IP PINs unmasked */
  clearance: boolean
  activeFrom: string
  note?: string
}

export const ROLE_LABEL: Record<Role, string> = {
  preparer: 'Preparer',
  reviewer: 'Reviewer',
  partner: 'Partner',
  firm_administrator: 'Firm administrator',
  quality_reviewer: 'Quality reviewer',
  client: 'Client',
}

export function actorsFrom(packet: Packet): Actor[] {
  const staff: Actor[] = packet.firm.staff.map((s) => ({
    id: s.id, name: s.name, role: s.role, credential: s.credential,
    clearance: s.sensitive_data_clearance, activeFrom: s.active_from, note: s.note,
  }))
  const clients: Actor[] = packet.firm.client_users.map((c) => ({
    id: c.id, name: c.name, role: 'client', credential: null, clearance: false, activeFrom: '2026-01-01',
  }))
  return [...staff, ...clients]
}

/** Things a role is allowed to do. The store refuses anything outside this list. */
export type Cap =
  | 'adjust.propose' | 'adjust.approve' | 'verify' | 'attach' | 'judgment.record' | 'finding.decide'
  | 'note.raise' | 'note.address' | 'note.clear' | 'question.ask'
  | 'step.attest' | 'signoff.review' | 'signoff.partner'
  | 'filing.manage' | 'standards.edit' | 'assign' | 'time.log' | 'viewlog.read'
  | 'client.respond' | 'client.approve' | 'quality.review'

const PREP: Cap[] = ['adjust.propose', 'verify', 'attach', 'judgment.record', 'finding.decide', 'note.address', 'question.ask', 'step.attest', 'time.log']

export const ROLE_CAPS: Record<Role, Cap[]> = {
  preparer: PREP,
  reviewer: [...PREP, 'adjust.approve', 'note.raise', 'note.clear', 'signoff.review'],
  partner: [...PREP, 'adjust.approve', 'note.raise', 'note.clear', 'signoff.partner', 'filing.manage', 'assign', 'viewlog.read'],
  firm_administrator: ['standards.edit', 'assign', 'viewlog.read', 'time.log'],
  quality_reviewer: ['note.raise', 'quality.review', 'viewlog.read'],
  client: ['client.respond', 'client.approve', 'attach'],
}

/**
 * Whether an actor is on the engagement yet. Marcus Bell joined mid-season and Sam Adeyemi
 * only starts in January 2027, so the season clock decides when they can act.
 */
export function isActive(actor: Actor, seasonDate: string): boolean {
  return actor.activeFrom <= seasonDate.slice(0, 10)
}

export function can(actor: Actor, cap: Cap, seasonDate: string): boolean {
  return isActive(actor, seasonDate) && ROLE_CAPS[actor.role].includes(cap)
}

export function initials(name: string): string {
  return name.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}

/** Mask an identifier unless the viewer is cleared and has chosen to reveal it. */
export function mask(value: string, kind: 'ssn' | 'account' | 'pin'): string {
  const tail = value.replace(/\D/g, '').slice(-4)
  if (kind === 'ssn') return `•••-••-${tail || '••••'}`
  if (kind === 'pin') return '••••••'
  return `••••••${tail}`
}
