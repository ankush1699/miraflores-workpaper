import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildIndex } from '../packet'
import type { Packet } from '../packet/types'
import { runAllChecks } from './index'
import { footEngine } from './review'

const packet = JSON.parse(readFileSync('public/packet.json', 'utf8')) as Packet
const idx = buildIndex(packet)
const { findings, ran } = runAllChecks(idx)
const byId = (id: string) => findings.find((f) => f.id === id)

describe('independent checks on the Okafor-Lindqvist packet', () => {
  it('prints what it found', () => {
    for (const f of findings) {
      const amt = f.fix?.drafts.map((d) => `${d.target} Δline=${d.lineDelta ?? '-'}`).join('; ') ?? ''
      console.log(`[${f.severity}] ${f.id} :: ${f.title} :: ${amt}`)
    }
    console.log('checks run:', ran.length, 'flagged:', ran.filter((r) => r.findingIds.length).length)
  })

  it('catches the double-counted 1099-K', () => {
    expect(byId('schc-gross-double-count')?.fix?.drafts[0].lineDelta).toBe(-12400)
  })
  it('catches the unmatched RSU basis (three lots, 47,620)', () => {
    const f = byId('rsu-basis-unmatched')
    expect(f?.fix?.drafts).toHaveLength(3)
    expect(f?.fix?.drafts.reduce((s, d) => s + (d.lineDelta ?? 0), 0)).toBe(-47620)
  })
  it('catches the doubled mileage page', () => {
    const d = byId('mileage-duplicate-page')?.fix?.drafts
    expect(d?.[0].lineDelta).toBe(-3700)
    expect(d?.[1].lineDelta).toBe(-2590)
  })
  it('catches duplicate interest, mortgage interest, vehicle value, property tax', () => {
    expect(byId('interest-double-count')?.fix?.drafts[0].lineDelta).toBe(-1840)
    expect(byId('mortgage-payoff-interest-twice')?.fix?.drafts[0].lineDelta).toBe(-2150)
    expect(byId('vehicle-gift-value')?.fix?.drafts[0].lineDelta).toBe(-3100)
    expect(byId('property-tax-seller-share')?.fix?.drafts[0].lineDelta).toBe(-6912)
  })
  it('catches payments, wages, identifiers', () => {
    expect(byId('estimates-q4-amount')?.fix?.drafts[0].lineDelta).toBe(-1000)
    expect(byId('ca-estimate-wrong-year')?.fix?.drafts[0].lineDelta).toBe(-3500)
    expect(byId('ca-wages-after-move')?.fix?.drafts[0].lineDelta).toBe(-88831)
    expect(byId('theo-ssn-typo')?.fix?.drafts[0].textFix?.to).toBe('666-74-3390')
    expect(findings.some((f) => f.id.startsWith('id-misread-'))).toBe(true)
  })
  it('catches the crypto lot and the missing Meridian lot', () => {
    expect(byId('crypto-c6')?.fix?.drafts[0].lineDelta).toBe(2275 - 5325)
    expect(byId('meridian-p32-unread')?.fix?.drafts[0].lineDelta).toBe(-60)
  })
  it('flags documents used but not landed', () => {
    const ids = findings.filter((f) => f.id.startsWith('doc-not-landed-')).map((f) => f.id.slice(15))
    console.log('not landed:', ids.join(', '))
    expect(ids).toContain('D15')
  })
  it('engine arithmetic foots', () => {
    const r = footEngine(idx)
    console.log('foot', r.checked, r.breaks)
    expect(r.breaks.length).toBe(0)
  })
})
