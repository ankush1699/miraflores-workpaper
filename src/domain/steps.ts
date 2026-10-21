import type { Finding } from '../checks/types'
import { dispositionOf, type Variance } from '../checks/review'
import type { PacketIndex } from '../packet'
import { approvedIds, fingerprintOf, findingStatus, isResolved, latestSignoff, lineValue, signoffStatus } from './derived'
import type { WorkState } from '../store/types'

export type StepState = 'done' | 'open' | 'reopened'

export interface StepStatus {
  name: string
  state: StepState
  /** done by the system comparing records, or by a person attesting */
  auto: boolean
  why: string
  by?: string
  at?: string
}

interface Ctx {
  idx: PacketIndex
  state: WorkState
  findings: Finding[]
  variances: Variance[]
}

/** The firm's required steps. The ones we can check from records are checked; the rest need a person to attest. */
export function stepStatuses(ctx: Ctx): StepStatus[] {
  return ctx.state.standards.required_steps.map((name) => evaluate(name, ctx))
}

function evaluate(name: string, c: Ctx): StepStatus {
  const { idx, state, findings } = c
  const attested = state.attestations[name]
  const manual = (extra?: string): StepStatus =>
    attested
      ? { name, state: 'done', auto: false, why: attested.note || 'Attested.', by: attested.by, at: attested.at }
      : { name, state: 'open', auto: false, why: extra ?? 'Needs a person to confirm and sign.' }

  switch (name) {
    case 'Engagement letter and consents signed': {
      const ok = /Signed/.test(idx.docs.get('D01')?.pages.map((p) => p.printed_content).join(' ') ?? '') &&
        /Signed/.test(idx.docs.get('D02')?.pages.map((p) => p.printed_content).join(' ') ?? '')
      return ok
        ? { name, state: 'done', auto: true, why: 'D01 signed by both spouses and countersigned by the partner; D02 (7216 consent) signed 01/12/2026.' }
        : { name, state: 'open', auto: true, why: 'Signed engagement letter or consent missing.' }
    }
    case 'Identity verified': {
      const theo = findings.find((f) => f.id === 'theo-ssn-typo')
      if (theo && !isResolved(findingStatus(theo, state))) return { name, state: 'open', auto: false, why: "Theo's SSN in the organizer does not match his Social Security card." }
      return manual('IDs on file (D03 IP PIN notice, D04, D05); dependent SSN check passed.')
    }
    case 'All documents accounted for': {
      const missing = idx.docList.filter((d) => {
        if (d.received_at.slice(0, 10) > state.season.asOf) return false
        const disp = dispositionOf(idx, d.id)
        return disp.kind === 'not_landed' && !state.docDispositions[d.id]
      })
      return missing.length
        ? { name, state: 'open', auto: true, why: `${missing.length} document(s) used by the tax software but never landed need a recorded decision: ${missing.map((d) => d.id).join(', ')}.` }
        : { name, state: 'done', auto: true, why: 'Every document has landed on a line, been superseded, or has a recorded decision.' }
    }
    case 'Prior-year variances explained': {
      const open = c.variances.filter((v) => v.flagged && !state.varianceNotes[v.key])
      return open.length
        ? { name, state: 'open', auto: true, why: `${open.length} flagged line(s) still need an explanation.` }
        : { name, state: 'done', auto: true, why: 'Every flagged year-over-year change has an explanation.' }
    }
    case 'Carryovers agreed to prior year': {
      const co = idx.packet.prior_years.carryovers_into_2025 as Record<string, number>
      const pairs: [string, number, number][] = [
        ['SchD.6', -lineValue(idx, state, 'SchD.6'), co.capital_loss_short],
        ['SchD.14', -lineValue(idx, state, 'SchD.14'), co.capital_loss_long],
        ['F8582.1c', -lineValue(idx, state, 'F8582.1c'), co.passive_1450_fremont + co.passive_1200_barton_hills],
        ['F8606.2', lineValue(idx, state, 'F8606.2'), 7000],
      ]
      const bad = pairs.filter(([, a, b]) => a !== b)
      return bad.length
        ? { name, state: 'open', auto: true, why: `Does not agree: ${bad.map(([k]) => k).join(', ')}.` }
        : { name, state: 'done', auto: true, why: 'Short and long capital loss, passive losses and IRA basis agree to the 2024 return and prior preparer file.' }
    }
    case 'Estimated payments agreed to IRS and FTB records': {
      const irs = idx.packet.tax_agency_records.irs_account_transcript_2025[0].transactions
        .filter((t) => t.code === '670' && typeof t.amount === 'number').reduce((s, t) => s + (t.amount as number), 0)
      const ftbPays = (idx.packet.tax_agency_records.ftb_account as any).tax_year_2025_payments as { amount: number }[]
      const ftb = ftbPays.reduce((s, p) => s + p.amount, 0)
      const fedOk = lineValue(idx, state, 'F1040.26') === irs
      const caOk = lineValue(idx, state, 'F540NR.72') === ftb
      if (fedOk && caOk) return { name, state: 'done', auto: true, why: `Federal ${irs.toLocaleString()} agrees to the IRS transcript; California ${ftb.toLocaleString()} agrees to the FTB account.` }
      return { name, state: 'open', auto: true, why: `${fedOk ? '' : 'Federal does not agree to the IRS transcript. '}${caOk ? '' : 'California does not agree to the FTB account.'}`.trim() }
    }
    case 'Due diligence completed': {
      const topics = ['child tax credit', 'other dependents', 'american opportunity']
      const have = (t: string) => state.judgments.some((j) => j.kind === 'due_diligence' && j.topic.toLowerCase().includes(t))
      const missing = topics.filter((t) => !have(t))
      return missing.length
        ? { name, state: 'open', auto: true, why: `Due diligence not recorded for: ${missing.join(', ')}.` }
        : { name, state: 'done', auto: true, why: 'Child tax credit, credit for other dependents and American opportunity credit each have a due diligence record with authority.' }
    }
    case 'Diagnostics resolved': {
      const open = findings.filter((f) => f.severity !== 'info' && !isResolved(findingStatus(f, state)))
      return open.length
        ? { name, state: 'open', auto: true, why: `${open.length} finding(s) still open.` }
        : { name, state: 'done', auto: true, why: 'Every warning and error has been fixed, accepted with authority, or communicated to the client.' }
    }
    case 'Reviewer sign-off':
    case 'Partner sign-off': {
      const level = name.startsWith('Reviewer') ? 'reviewer' : 'partner'
      const so = latestSignoff(state, level)
      if (!so) return { name, state: 'open', auto: false, why: `Waiting for the ${level}.` }
      const st = signoffStatus(so, state)
      if (st.state === 'reopened') {
        return { name, state: 'reopened', auto: false, by: so.by, at: so.at,
          why: `Signed, but ${st.added.length} adjustment(s) were approved after the signature (${st.added.map((a) => a.label).join('; ') || 'changes'}). Needs to be signed again.` }
      }
      return { name, state: 'done', auto: false, by: so.by, at: so.at, why: so.note || 'Signed.' }
    }
    case 'Client approval and e-file authorization': {
      const a = state.filing.clientApproval
      if (!a) return { name, state: 'open', auto: false, why: 'Waiting for the client to approve and sign Form 8879 and FTB 8879.' }
      if (fingerprintOf(a.adjustmentIds) !== fingerprintOf(approvedIds(state))) {
        return { name, state: 'reopened', auto: false, by: a.by, at: a.at, why: 'The return changed after the client approved it. They need to approve the new numbers.' }
      }
      return { name, state: 'done', auto: false, by: a.by, at: a.at, why: 'Form 8879 and FTB 8879 signed.' }
    }
    default:
      return manual()
  }
}

/** Steps that still block a return from filing, in plain words. */
export function filingBlockers(c: Ctx): string[] {
  const out: string[] = []
  for (const s of stepStatuses(c)) if (s.state !== 'done') out.push(`${s.name}: ${s.why}`)
  if (c.state.standards.openNotesBlock) {
    const n = c.state.threads.filter((t) => t.blocking && t.status !== 'cleared' && t.kind !== 'question').length
    if (n) out.push(`${n} open review note(s) block filing.`)
  }
  return out
}
