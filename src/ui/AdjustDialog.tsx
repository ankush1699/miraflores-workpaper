import { useEffect, useMemo, useState } from 'react'
import type { AdjustmentDraft, Effect, Jurisdiction, TaxCategory } from '../checks/types'
import { usd } from '../checks/helpers'
import { taxEffectOf, biggestSwing } from '../domain/taxEffect'
import { useStore } from '../store/Store'
import { EffectText, RefChip } from './Common'
import { useUi } from './Ui'

const CATEGORY_LABEL: Record<TaxCategory, string> = {
  wages: 'Wages', interest: 'Interest or dividends', schc_profit: 'Schedule C profit', stcg: 'Short-term gain',
  ltcg: 'Long-term gain', ordinary_income: 'Other income', adjustment: 'Adjustment to income',
  salt: 'State and local tax deduction', itemized: 'Other itemized deduction', ca_source_income: 'California-source income',
  credit: 'Credit (dollar for dollar)', payment: 'Payment (dollar for dollar)', none: 'No tax effect',
}

/** Turn a finding's draft or a hand-typed change into a proposal that records who, why and the tax effect. */
export function AdjustDialog() {
  const { adjust, closeAdjust } = useUi()
  const { idx, state, commit, uid, say, actor } = useStore()
  const rates = idx.current.tax_effect_rates

  const finding = adjust?.kind === 'finding' ? adjust.finding : null
  const lineKey = adjust?.kind === 'line' ? adjust.lineKey : null
  const line = lineKey ? idx.lineMaps.get(idx.current.version)?.get(lineKey) : undefined

  const [reason, setReason] = useState('')
  const [authority, setAuthority] = useState('')
  const [delta, setDelta] = useState('')
  const [category, setCategory] = useState<TaxCategory>('ordinary_income')
  const [effectAmount, setEffectAmount] = useState('')
  const [fed, setFed] = useState(true)
  const [ca, setCa] = useState(true)

  useEffect(() => {
    if (finding) {
      setReason(finding.detail)
      setAuthority(finding.fix?.authority ?? '')
    } else {
      setReason(''); setAuthority(''); setDelta(''); setEffectAmount(''); setCategory('ordinary_income'); setFed(true); setCa(true)
    }
  }, [adjust]) // eslint-disable-line react-hooks/exhaustive-deps

  const drafts: AdjustmentDraft[] = useMemo(() => {
    if (finding?.fix) return finding.fix.drafts
    if (!line) return []
    const d = Number(delta) || 0
    const amt = effectAmount === '' ? d : Number(effectAmount) || 0
    const js: Jurisdiction[] = [...(fed ? (['federal'] as const) : []), ...(ca ? (['california'] as const) : [])]
    const effects: Effect[] = category === 'none' ? [] : [{ category, amount: amt, jurisdictions: js }]
    return [{ target: `line:${line.key}`, label: line.label, lineDelta: d, effects }]
  }, [finding, line, delta, effectAmount, category, fed, ca])

  if (!adjust) return null

  const effects = drafts.map((d) => taxEffectOf(d.effects, rates))
  const total = effects.reduce((s, e) => ({ f: s.f + e.federalBalance, c: s.c + e.californiaBalance }), { f: 0, c: 0 })
  const needsPartner = effects.some((e) => biggestSwing(e) > state.standards.partnerOver)

  const submit = () => {
    const batchId = uid('batch')
    const evidence = finding?.refs ?? (line ? [`line:${line.key}`] : [])
    const items = drafts.map((d) => ({
      type: 'adjust.propose',
      data: {
        id: uid('adj'), batchId, target: d.target, label: d.label, lineDelta: d.lineDelta, textFix: d.textFix,
        effects: d.effects, reason, authority, findingId: finding?.id, evidence,
      },
    }))
    const r = commit(items)
    if (!r.ok) return say(r.error ?? 'Could not propose')
    say(needsPartner ? 'Proposed. A partner has to approve this one.' : 'Proposed. A reviewer can approve it.')
    closeAdjust()
  }

  return (
    <div className="modal" onClick={closeAdjust}>
      <div className="box" onClick={(e) => e.stopPropagation()}>
        <div className="row spread"><h2>{finding ? 'Propose the fix' : 'Adjust this number'}</h2><button className="btn small" onClick={closeAdjust}>Close ✕</button></div>
        {finding && <p className="muted" style={{ marginTop: 4 }}>{finding.title}</p>}
        <p className="small muted">The original value is never overwritten. This adds a proposal on top of it, which someone else approves.</p>

        {line && !finding && (
          <div className="stack" style={{ marginTop: 8 }}>
            <div className="row"><strong>{line.label}</strong><span className="muted mono">{line.key}</span><span className="muted">now {usd(Number(line.value))}</span></div>
            <label className="field"><span>Change to this line (+ or −)</span><input type="number" value={delta} onChange={(e) => setDelta(e.target.value)} placeholder="e.g. -2150" /></label>
            <div className="row wrap" style={{ alignItems: 'flex-end' }}>
              <label className="field grow"><span>Tax category</span>
                <select value={category} onChange={(e) => setCategory(e.target.value as TaxCategory)}>
                  {Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
              <label className="field grow"><span>Change in that category (blank = same as above)</span><input type="number" value={effectAmount} onChange={(e) => setEffectAmount(e.target.value)} /></label>
            </div>
            <div className="row">
              <label className="row small"><input type="checkbox" checked={fed} onChange={(e) => setFed(e.target.checked)} /> Federal</label>
              <label className="row small"><input type="checkbox" checked={ca} onChange={(e) => setCa(e.target.checked)} /> California</label>
            </div>
          </div>
        )}

        {finding && (
          <table className="tbl" style={{ marginTop: 8 }}>
            <tbody>
              {drafts.map((d, i) => (
                <tr key={i}>
                  <td><RefChip r={d.target} /></td>
                  <td>{d.label}{d.textFix && <div className="small muted">“{d.textFix.from}” → “{d.textFix.to}”</div>}</td>
                  <td className="num">{d.lineDelta !== undefined ? `${d.lineDelta > 0 ? '+' : ''}${d.lineDelta.toLocaleString()}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="alert info" style={{ margin: '10px 0' }}>
          Estimated effect on the amount owed: federal <EffectText n={total.f} />, California <EffectText n={total.c} />.
          <div className="small muted">Estimate from the engine's per-dollar rates at the v3 numbers. The real system recomputes.</div>
          {needsPartner && <div className="small"><strong>Over ${state.standards.partnerOver.toLocaleString()}: needs a partner to approve.</strong></div>}
        </div>

        <label className="field"><span>Why</span><textarea value={reason} onChange={(e) => setReason(e.target.value)} /></label>
        <label className="field"><span>Authority relied on</span><input type="text" value={authority} onChange={(e) => setAuthority(e.target.value)} placeholder="Code section, regulation, form instruction, or document" /></label>
        <div className="row spread">
          <span className="muted small">Proposed by {actor.name}</span>
          <button className="btn primary" disabled={!reason.trim() || (drafts.some((d) => d.effects.length) && !authority.trim())} onClick={submit}>Propose</button>
        </div>
      </div>
    </div>
  )
}
