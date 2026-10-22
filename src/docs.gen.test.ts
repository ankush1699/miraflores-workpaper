import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { it } from 'vitest'
import { runAllChecks } from './checks'
import { findingEffect } from './domain/recon'
import { areaLabel, buildIndex } from './packet'
import type { Packet } from './packet/types'

// Regenerates docs/ERRORS.md from the same findings the app shows.
//   GEN_DOCS=1 npx vitest run src/docs.gen.test.ts
it.runIf(process.env.GEN_DOCS)('writes docs/ERRORS.md', () => {
  const idx = buildIndex(JSON.parse(readFileSync('public/packet.json', 'utf8')) as Packet)
  const { findings } = runAllChecks(idx)
  const money = (n: number) => `$${Math.abs(n).toLocaleString('en-US')}`
  const impact = (n: number) => (n === 0 ? 'no change' : `${n < 0 ? 'saves' : 'adds'} ${money(n)}`)
  const KIND: Record<string, string> = {
    engine_error: 'Tax software mistake', extraction_error: 'Document read wrongly', data_conflict: 'Sources disagree',
    tie_out: "Numbers don't add up", judgment: 'Needs a decision', outside_scope: 'Tell the client',
  }
  const real = findings.filter((f) => f.severity !== 'info' && f.kind !== 'outside_scope' && f.kind !== 'judgment')
  const withMoney = real.filter((f) => { const e = findingEffect(idx, f); return f.fix && (e.federalBalance || e.californiaBalance) })
  const noMoney = real.filter((f) => !withMoney.includes(f))
  const judg = findings.filter((f) => f.kind === 'judgment')
  const outside = findings.filter((f) => f.kind === 'outside_scope')
  const fed = withMoney.reduce((t, f) => t + findingEffect(idx, f).federalBalance, 0)
  const ca = withMoney.reduce((t, f) => t + findingEffect(idx, f).californiaBalance, 0)
  const fedStart = idx.current.summary.federal.balance_due, caStart = idx.current.summary.california.balance_due
  const owe = (n: number) => (n >= 0 ? `owes ${money(n)}` : `gets ${money(n)} back`)

  const out: string[] = [
    '# The mistakes we found', '',
    'The tax software calculated the Okafor-Lindqvist family’s 2025 return. The workpaper did not trust it: its own checks re-read every document and recalculated. ' +
    `The tax software’s own 11 warnings caught **none** of the mistakes below.`, '',
    '**What it means for the family**', '',
    '| | Tax software said | After fixing the clear mistakes |', '|---|---|---|',
    `| Federal | family ${owe(fedStart)} | family ${owe(fedStart + fed)} |`,
    `| California | family ${owe(caStart)} | family ${owe(caStart + ca)} |`, '',
    'Amounts are estimates using the tax software’s own tax rates, because the software itself can’t be re-run. “Saves” means the family owes less once the mistake is fixed; “adds” means they owe more.', '',
    `## Mistakes that change the tax (${withMoney.length})`, '',
    '| # | What was wrong | Federal | California |', '|---|---|---|---|',
  ]
  withMoney.forEach((f, i) => {
    const e = findingEffect(idx, f)
    out.push(`| ${i + 1} | ${f.title.replace(/\|/g, '/')} | ${impact(e.federalBalance)} | ${impact(e.californiaBalance)} |`)
  })
  out.push('', `## Other mistakes and things that needed checking (${noMoney.length})`, '')
  noMoney.forEach((f) => out.push(`- **${f.title}** (${KIND[f.kind]})`))
  out.push('', '## Each one explained', '')
  ;[...withMoney, ...noMoney].forEach((f, i) => {
    out.push(`### ${i + 1}. ${f.title}`, '', f.detail, '', `**Type:** ${KIND[f.kind]}`, '', `**How the app found it:** ${f.surfacedBy}`, '', `**Where to look in the app:** ${f.refs.join(', ')}`, '')
  })
  out.push('## Decisions the software made without asking anyone', '', 'These are not clear mistakes. A person has to decide, and the app records the decision and the rule it relied on.', '')
  judg.forEach((f) => out.push(`- **${f.title}.** ${f.detail.split('. ').slice(0, 2).join('. ')}.`))
  out.push('', '## Not part of this return, but the client must be told', '')
  outside.forEach((f) => out.push(`- **${f.title}.** ${f.detail.split('. ')[0]}.`))
  mkdirSync('docs', { recursive: true })
  writeFileSync('docs/ERRORS.md', out.join('\n') + '\n')
})
