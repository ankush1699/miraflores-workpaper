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
  const sign = (n: number) => `${n >= 0 ? '+' : '−'}$${Math.abs(n).toLocaleString('en-US')}`
  const errors = findings.filter((f) => f.severity !== 'info' && f.kind !== 'outside_scope' && f.kind !== 'judgment')
  const judg = findings.filter((f) => f.kind === 'judgment')
  const outside = findings.filter((f) => f.kind === 'outside_scope')
  const out: string[] = [
    '# Errors found in the Okafor-Lindqvist packet', '',
    `The workpaper's independent checks found **${errors.length} errors and checks** by recomputing from the printed documents. The engine's own diagnostics (11 on v3) flagged none of the engine errors. ` +
    'Effects are estimates from the engine\'s per-dollar rates at the v3 numbers (+ means the client owes more).', '',
    '| # | What was wrong | Area | Federal | California | Surfaced by |', '|---|---|---|---|---|---|',
  ]
  errors.forEach((f, i) => {
    const e = findingEffect(idx, f)
    out.push(`| ${i + 1} | ${f.title.replace(/\|/g, '/')} | ${areaLabel(f.area)} | ${f.fix ? sign(e.federalBalance) : 'n/a'} | ${f.fix ? sign(e.californiaBalance) : 'n/a'} | ${f.surfacedBy.split(';')[0].replace(/\|/g, '/')} |`)
  })
  out.push('', '## Detail', '')
  errors.forEach((f, i) => {
    out.push(`### ${i + 1}. ${f.title}`, '', f.detail, '', `**Kind:** ${f.kind.replace('_', ' ')} · **Evidence:** ${f.refs.join(', ')}`, '', `**How the design surfaced it:** ${f.surfacedBy}`, '')
  })
  out.push('## Judgment calls the engine made silently', '')
  judg.forEach((f) => out.push(`- **${f.title}.** ${f.detail.split('. ').slice(0, 2).join('. ')}.`))
  out.push('', '## Outside the engagement, but the client has to hear it', '')
  outside.forEach((f) => out.push(`- **${f.title}.** ${f.detail.split('. ')[0]}.`))
  mkdirSync('docs', { recursive: true })
  writeFileSync('docs/ERRORS.md', out.join('\n') + '\n')
})
