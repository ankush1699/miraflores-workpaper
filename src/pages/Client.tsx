import { useState } from 'react'
import { usd } from '../checks/helpers'
import { approvedIds, fingerprintOf, latestSignoff, signoffStatus } from '../domain/derived'
import { finalBalances } from '../domain/filing'
import { Masked, Pill, day, when } from '../ui/Common'
import { useStore } from '../store/Store'
import { PageHeader } from '../ui/Shell'
import { ThreadCard } from '../ui/Threads'

/** What a client sees: what the firm needs from them, the numbers in plain words, and one place to approve. */
export function ClientPage() {
  const { idx, state, findings, actor, commit, say, uid } = useStore()
  const [pinT, setPinT] = useState('')
  const [pinS, setPinS] = useState('')
  const [file, setFile] = useState<{ name: string; dataUrl: string } | null>(null)
  const finals = finalBalances(idx, state, findings)
  const questions = state.threads.filter((t) => t.kind === 'question')
  const waiting = questions.filter((t) => !t.answeredBy && t.status !== 'cleared')
  const reviewed = (['reviewer', 'partner'] as const).every((l) => { const s = latestSignoff(state, l); return s && signoffStatus(s, state).state === 'valid' })
  const approval = state.filing.clientApproval
  const approvalValid = approval && fingerprintOf(approval.adjustmentIds) === fingerprintOf(approvedIds(state))
  const fedOk = state.filing.submissions.some((s) => s.jurisdiction === 'federal' && s.status === 'accepted')
  const caOk = state.filing.submissions.some((s) => s.jurisdiction === 'california' && s.status === 'accepted')
  const person = idx.packet.household.people.find((p) => p.name === actor.name)

  const approve = () => {
    const r = commit([{ type: 'filing.approve', data: { adjustmentIds: approvedIds(state), pins: { taxpayer: pinT, spouse: pinS } } }])
    say(r.ok ? 'Thank you. The firm can now file your return.' : r.error ?? 'Could not approve')
  }
  const upload = () => {
    if (!file) return
    const r = commit([{ type: 'attach.add', data: { id: uid('att'), target: 'doc:client-upload', kind: 'file', name: file.name, text: '', dataUrl: file.dataUrl } }])
    if (r.ok) { say('Uploaded. Thank you.'); setFile(null) }
  }
  const pick = (f: File | undefined) => {
    if (!f) return
    if (f.size > 1_500_000) return say('Please keep files under 1.5 MB here.')
    const rd = new FileReader()
    rd.onload = () => setFile({ name: f.name, dataUrl: String(rd.result) })
    rd.readAsDataURL(f)
  }
  const owe = (n: number) => (n >= 0 ? `${usd(n)} to pay` : `${usd(-n)} refund`)

  return (
    <div className="page stack">
      <PageHeader title={`Hello, ${actor.name.split(' ')[0]}`}>Your 2025 federal and California tax returns. This page shows what we need from you and where things stand. It does not show our internal review notes.</PageHeader>

      <section className="card">
        <h2>Where things stand</h2>
        <ul className="timeline">
          <li className="done">We received your documents and questionnaire</li>
          <li className={reviewed ? 'done' : 'next'}>{reviewed ? 'Our review is complete' : 'We are reviewing your return'}</li>
          <li className={approvalValid ? 'done' : reviewed ? 'next' : ''}>{approvalValid ? `You approved and signed on ${day(approval!.at)}` : 'Your approval and e-file signature'}</li>
          <li className={fedOk ? 'done' : ''}>Federal return {fedOk ? 'accepted by the IRS' : 'filed with the IRS'}</li>
          <li className={caOk ? 'done' : ''}>California return {caOk ? 'accepted by the FTB' : 'filed with the FTB'}</li>
        </ul>
      </section>

      <section className="card">
        <h2>What we need from you {waiting.length > 0 && <Pill tone="bad">{waiting.length}</Pill>}</h2>
        {questions.length === 0 ? <p className="muted">Nothing right now.</p> : <div className="stack">{questions.map((t) => <ThreadCard key={t.id} t={t} showTarget={false} />)}</div>}
        <div style={{ marginTop: 10 }}>
          <label className="field"><span>Send us a document (under 1.5 MB)</span><input type="file" onChange={(e) => pick(e.target.files?.[0])} /></label>
          <button className="btn" disabled={!file} onClick={upload}>Upload {file?.name ?? ''}</button>
        </div>
      </section>

      <section className="card">
        <h2>Your return in plain numbers</h2>
        <table className="tbl"><tbody>
          <tr><td>Federal</td><td className="num"><strong>{owe(finals.federalBalance)}</strong></td></tr>
          <tr><td>California</td><td className="num"><strong>{owe(finals.californiaBalance)}</strong></td></tr>
          <tr><td>Total federal tax for 2025</td><td className="num">{usd(finals.federalTax)}</td></tr>
          <tr><td>Total California tax for 2025</td><td className="num">{usd(finals.californiaTax)}</td></tr>
        </tbody></table>
        {!approvalValid && <p className="small muted">These numbers are not final until you approve them. If we change anything after you approve, we will ask you to approve again.</p>}
      </section>

      <section className="card">
        <h2>Approve and sign</h2>
        {!reviewed && <p className="muted">We will ask for your signature as soon as our review is complete.</p>}
        {reviewed && approvalValid && <div className="alert good">Signed {when(approval!.at)}. Form 8879 and FTB 8879 are on file.</div>}
        {reviewed && approval && !approvalValid && <div className="alert warn">Your return changed after you signed. Please approve the new numbers.</div>}
        {reviewed && !approvalValid && (
          <>
            <p className="small">By entering your five-digit PINs you authorize us to e-file your 2025 federal and California returns with the numbers above. Your prior-year AGI for verification: {usd(idx.packet.household.prior_year_agi_for_esignature)}.</p>
            <div className="grid cols-2">
              <label className="field"><span>Taxpayer PIN (Ngozi)</span><input type="text" inputMode="numeric" maxLength={5} value={pinT} onChange={(e) => setPinT(e.target.value.replace(/\D/g, ''))} /></label>
              <label className="field"><span>Spouse PIN (Erik)</span><input type="text" inputMode="numeric" maxLength={5} value={pinS} onChange={(e) => setPinS(e.target.value.replace(/\D/g, ''))} /></label>
            </div>
            <button className="btn primary" disabled={pinT.length !== 5 || pinS.length !== 5} onClick={approve}>I approve and sign</button>
          </>
        )}
      </section>

      {state.filing.frozen && (
        <section className="card">
          <h2>Your copy of the return</h2>
          <p className="small">Filed {day(state.filing.frozen.at)}. Keep this with your records for at least seven years.</p>
          <table className="tbl"><tbody>
            <tr><td>Federal result</td><td className="num">{owe(finals.federalBalance)}</td></tr>
            <tr><td>California result</td><td className="num">{owe(finals.californiaBalance)}</td></tr>
            {state.filing.payments.map((p, i) => <tr key={i}><td>{p.agency} payment, {day(p.at)}</td><td className="num">{usd(p.amount)}</td></tr>)}
            {state.filing.refund && <tr><td>California refund, {day(state.filing.refund.at)}</td><td className="num">{usd(state.filing.refund.amount)}</td></tr>}
          </tbody></table>
          <button className="btn no-print" style={{ marginTop: 8 }} onClick={() => window.print()}>Print your copy</button>
        </section>
      )}

      {person && (
        <section className="card"><h2>Your details on file</h2>
          <table className="tbl"><tbody><tr><td>Name</td><td>{person.name}</td></tr><tr><td>SSN</td><td><Masked value={person.ssn} kind="ssn" label={`${person.name} SSN`} /></td></tr><tr><td>Email</td><td>{person.email}</td></tr></tbody></table>
        </section>
      )}
    </div>
  )
}
