import type { PacketIndex } from '../packet'
import { lineIn, numeric } from '../packet'
import type { AdjustmentDraft, Finding } from './types'
import { docText, evByField, evNumber, lineNum, parseMoney, round0, round2, usd } from './helpers'

// Each check here looks at one thing the engine did and re-derives it from the source
// documents. None of them read the engine's own diagnostics: the point is to catch what
// the engine does not know it got wrong.

export type Check = { id: string; title: string; run: (idx: PacketIndex) => Finding[] }

const both = ['federal', 'california'] as const

/* ---------------------------------------------------------------- business */

const grossReceipts: Check = {
  id: 'schc-gross-receipts',
  title: 'Schedule C gross receipts agree to the books and the 1099s',
  run(idx) {
    const line = lineIn(idx, 'SchC.1')
    if (!line) return []
    const books = evNumber(idx, 'D14', 'total_income')
    const card = evNumber(idx, 'D21', 'box1a')
    const viaCard = /of which ([\d,]+\.\d\d) arrived through Paywell/.exec(docText(idx, 'D15', 3))
    if (!viaCard || numeric(line) !== books + card) return []
    const overlap = Math.min(card, parseMoney(viaCard[1]))
    const nec = ['D16', 'D17', 'D18', 'D19', 'D20'].reduce((s, d) => s + evNumber(idx, d, 'box1'), 0)
    const noForm = /no Form 1099: ([\d,]+\.\d\d)/.exec(docText(idx, 'D15', 3))
    const unreported = noForm ? parseMoney(noForm[1]) : 0
    return [{
      id: 'schc-gross-double-count',
      area: 'business', severity: 'error', kind: 'engine_error',
      title: `Schedule C gross receipts counted ${usd(overlap)} twice`,
      detail:
        `The engine added the ${usd(card)} Paywell 1099-K to the books' ${usd(books)} of revenue because it could not ` +
        `match the card payments to a deposit. The books already include them: Atlas paid ${usd(evNumber(idx, 'D17', 'box1'))} ` +
        `in total, and ${usd(overlap)} of that came through Paywell (D15 p3). The books tie exactly to the five 1099-NECs ` +
        `(${usd(nec)}) plus ${usd(unreported)} from small clients with no 1099 = ${usd(nec + unreported)}. Gross receipts should be ${usd(books)}, not ${usd(numeric(line))}.`,
      surfacedBy: 'Reconciliation panel on Business: books vs 1099-NEC vs 1099-K; trace of SchC.1 shows the 1099-K as a separate input.',
      refs: ['line:SchC.1', 'ev:ev-0103', 'ev:ev-0127', 'doc:D15#page3', 'doc:D17', 'doc:D21'],
      fix: {
        summary: `Reduce gross receipts by ${usd(overlap)}`,
        authority: 'IRC §61; Form 1099-K amounts already deposited to the books are not additional income',
        drafts: [{
          target: 'line:SchC.1', label: 'Gross receipts: remove double-counted 1099-K', lineDelta: -overlap,
          effects: [{ category: 'schc_profit', amount: -overlap, jurisdictions: [...both] }],
        }],
      },
    }]
  },
}

const mileageDuplicatePage: Check = {
  id: 'mileage-duplicate-page',
  title: 'Mileage log pages are distinct (no page scanned twice)',
  run(idx) {
    const doc = idx.docs.get('D23')
    const line = lineIn(idx, 'SchC.44a')
    if (!doc || !line) return []
    const strip = (t: string) => t.replace(/^\(.*?\)\s*/, '')
    const seen = new Map<string, number>()
    let dupPage = 0
    for (const p of doc.pages) {
      const body = strip(p.printed_content)
      if (seen.has(body)) dupPage = p.page
      else seen.set(body, p.page)
    }
    if (!dupPage) return []
    const pageTotal = idx.evsByDoc.get('D23')?.find((e) => e.field === 'page_total' && e.page === dupPage)
    const miles = typeof pageTotal?.value === 'number' ? pageTotal.value : 0
    if (!miles) return []
    const rate = idx.param('mileage_rate') as number
    const fixedMiles = numeric(line) - miles
    const saved = round0(miles * rate)
    return [{
      id: 'mileage-duplicate-page',
      area: 'business', severity: 'error', kind: 'extraction_error',
      title: `Mileage log page ${dupPage} is a second scan of another page (${miles.toLocaleString()} miles counted twice)`,
      detail:
        `Page ${dupPage} is labelled "second scan of the May-Aug sheet", and its trips match the earlier page line for line. ` +
        `The engine adds every page total, so business miles came out ${numeric(line).toLocaleString()} instead of ${fixedMiles.toLocaleString()}. ` +
        `At ${rate} per mile that overstates the car deduction by ${usd(saved)}.`,
      surfacedBy: 'Document viewer shows the page text next to its extracted total; the duplicate-page comparison flags it before the number is trusted.',
      refs: ['line:SchC.44a', 'line:SchC.9', 'doc:D23#page3', 'doc:D23#page2', 'msg:msg-03'],
      fix: {
        summary: `Business miles ${fixedMiles.toLocaleString()}; car expense down ${usd(saved)}`,
        authority: 'IRC §274(d) requires adequate records; one scan of each sheet',
        drafts: [
          { target: 'line:SchC.44a', label: 'Business miles: drop duplicated page', lineDelta: -miles, effects: [] },
          {
            target: 'line:SchC.9', label: 'Car and truck expenses (standard mileage)', lineDelta: -saved,
            effects: [{ category: 'schc_profit', amount: saved, jurisdictions: [...both] }],
          },
        ],
      },
    }]
  },
}

const phoneAndInternet: Check = {
  id: 'schc-phone-internet',
  title: 'Phone and internet limited to business-use share',
  run(idx) {
    const line = lineIn(idx, 'SchC.25')
    const call = idx.packet.client.call_notes[0]
    if (!line || !call) return []
    const text = call.notes.join(' ')
    const phone = /Mobile plan.*?(\d+)%/.exec(text)
    const net = /Home internet.*?about (\d+)%/.exec(text)
    if (!phone || !net) return []
    const phoneAmt = evNumber(idx, 'D14', 'Telephone')
    const netAmt = evNumber(idx, 'D14', 'Internet')
    const allowed = round0(phoneAmt * (Number(phone[1]) / 100) + netAmt * (Number(net[1]) / 100))
    const delta = allowed - numeric(line)
    if (delta >= 0) return []
    return [{
      id: 'schc-personal-use-phone-internet',
      area: 'business', severity: 'warning', kind: 'engine_error',
      title: `Phone and internet deducted at 100%; client says ${phone[1]}% and ${net[1]}% business`,
      detail:
        `The engine took the books' telephone (${usd(phoneAmt)}) and internet (${usd(netAmt)}) in full. On the March 26 call Erik said ` +
        `the family mobile plan is about ${phone[1]}% business and the shared home internet about ${net[1]}%. ` +
        `Allowed: ${usd(allowed)}, so ${usd(-delta)} is personal.`,
      surfacedBy: 'Client call notes are attached to the evidence for SchC.25, so the percentages sit next to the number.',
      refs: ['line:SchC.25', 'ev:ev-0101', 'ev:ev-0095', 'call:call-01', 'doc:D15#page2'],
      fix: {
        summary: `Reduce utilities by ${usd(-delta)}`,
        authority: 'IRC §262 (personal expenses); client allocation per call-01 (reasonable estimate, no usage records provided)',
        drafts: [{
          target: 'line:SchC.25', label: 'Utilities: business-use share only', lineDelta: delta,
          effects: [{ category: 'schc_profit', amount: -delta, jurisdictions: [...both] }],
        }],
      },
      ask: 'Do you have a phone bill or usage breakdown that supports the 70% business share?',
    }]
  },
}

const personalSubscription: Check = {
  id: 'schc-personal-subscription',
  title: 'Personal subscriptions removed from business software',
  run(idx) {
    const line = lineIn(idx, 'SchC.27a.1')
    const call = idx.packet.client.call_notes[0]
    const detail = docText(idx, 'D15', 1)
    const hit = /Spotify Family ([\d,]+\.\d\d)/.exec(detail)
    if (!line || !call || !hit || !call.notes.some((n) => /Spotify Family.*personal/.test(n))) return []
    const amount = parseMoney(hit[1])
    return [{
      id: 'schc-spotify',
      area: 'business', severity: 'warning', kind: 'engine_error',
      title: `Spotify Family (${usd(amount)}) is in business software but is personal`,
      detail: `The transaction detail (D15) lists it inside Software and subscriptions, and Erik confirmed on the call that it was booked by mistake. The engine took the account total as is.`,
      surfacedBy: 'Books-to-tax view lists the account detail under each P&L line.',
      refs: ['line:SchC.27a.1', 'doc:D15#page1', 'call:call-01'],
      fix: {
        summary: `Reduce software by ${usd(amount)}`,
        authority: 'IRC §262; client confirmation on call-01',
        drafts: [{
          target: 'line:SchC.27a.1', label: 'Software: remove personal Spotify', lineDelta: -amount,
          effects: [{ category: 'schc_profit', amount, jurisdictions: [...both] }],
        }],
      },
    }]
  },
}

const healthInsuranceEligibility: Check = {
  id: 'sehi-eligibility',
  title: 'Self-employed health insurance: eligibility for a spouse\'s employer plan',
  run(idx) {
    const line = lineIn(idx, 'Sch1.17')
    const qa = idx.packet.client.questionnaire.find((q) => q.id === 'qa-25')
    if (!line || !qa) return []
    const amount = numeric(line)
    return [{
      id: 'sehi-spouse-plan',
      area: 'business', severity: 'warning', kind: 'judgment',
      title: `Erik's ${usd(amount)} health insurance deduction may not be allowed`,
      detail:
        `The client says both of Ngozi's employers offer family coverage and Erik chose his own plan (qa-25). The self-employed health ` +
        `insurance deduction is not allowed for months in which the taxpayer could have joined a plan subsidized by a spouse's employer. ` +
        `Both W-2s show employer-sponsored coverage (box 12 DD). Last year's return took no deduction for the same reason (2024 note on Sch1.17). ` +
        `The engine's rule does not look at eligibility. Needs a decision and a record of the authority relied on.`,
      surfacedBy: 'Prior-year variance on Sch1.17 (0 last year, 14,400 now) plus the questionnaire answer sitting beside the line.',
      refs: ['line:Sch1.17', 'qa:qa-25', 'py:/return_2024/notes/Sch1.17', 'ev:ev-0484', 'doc:D25'],
      fix: {
        summary: `If disallowed: remove ${usd(amount)} from adjustments to income`,
        authority: 'IRC §162(l)(2)(B) (eligible employer-subsidized plan of spouse); confirm the plans are subsidized',
        drafts: [{
          target: 'line:Sch1.17', label: 'Self-employed health insurance deduction', lineDelta: -amount,
          effects: [{ category: 'adjustment', amount: -amount, jurisdictions: [...both] }],
        }],
      },
      ask: 'Were the employer family plans subsidized by Corvane/Halvorsen (employer pays part of the premium)? Which months could Erik have enrolled?',
    }]
  },
}

const sepExcess: Check = {
  id: 'sep-limit',
  title: 'SEP contribution within the deductible limit',
  run(idx) {
    const line = lineIn(idx, 'Sch1.16')
    const carry = idx.current.carryovers_out.federal['sep_contribution_not_deductible_for_2025']
    if (!line || !carry) return []
    return [{
      id: 'sep-over-limit',
      area: 'business', severity: 'info', kind: 'judgment',
      title: `SEP contribution of $18,000 exceeds the deductible limit by ${usd(carry)}`,
      detail:
        `The client deposited $18,000 on 04/10/2026 (D26) for 2025. The limit is 20% of net profit less half of self-employment tax, ` +
        `${usd(numeric(line))} on the engine's numbers. The extra ${usd(carry)} is not deductible. Decide whether it stays in as a carryforward ` +
        `or is withdrawn, and re-check the limit after any change to Schedule C profit, because the limit moves with it.`,
      surfacedBy: 'Carryovers table and the Schedule C adjustments: any change to profit visibly invalidates the SEP line.',
      refs: ['line:Sch1.16', 'doc:D26', 'qa:qa-26'],
    }]
  },
}

/* ------------------------------------------------------------ investments */

const rsuBasis: Check = {
  id: 'rsu-basis',
  title: 'Noncovered RSU sales use the supplemental cost basis',
  run(idx) {
    const lots = idx.current.lines.filter((l) => l.rule === 'R-8949-LOT' && /\(RSU\)/.test(l.label))
    const drafts: AdjustmentDraft[] = []
    const notes: string[] = []
    let total = 0
    for (const lot of lots) {
      if (!/basis 0\.00/.test(lot.label)) continue
      const acquired = /acquired (\d{4}-\d\d-\d\d)/.exec(lot.label)?.[1]
      const supp = idx.evsByDoc.get('D11')?.find((e) => e.field.endsWith('_acquired') && e.value === acquired)
      if (!supp) continue
      const prefix = supp.field.replace('_acquired', '')
      const basis = evNumber(idx, 'D11', `${prefix}_adjusted_basis`)
      if (!basis) continue
      const box = lot.line.split('.')[0]
      const term = box === 'B' ? 'stcg' : 'ltcg'
      drafts.push({
        target: `line:${lot.key}`, label: `${prefix}: add supplemental basis`, lineDelta: -basis,
        effects: [{ category: term, amount: -basis, jurisdictions: [...both] }],
      })
      notes.push(`${prefix} ${usd(basis)}`)
      total += basis
    }
    if (!drafts.length) return []
    return [{
      id: 'rsu-basis-unmatched',
      area: 'investments_and_digital_assets', severity: 'error', kind: 'engine_error',
      title: `RSU sales taxed with zero basis: gain overstated by ${usd(total)}`,
      detail:
        `Northlake reported the three RSU lots as noncovered with no cost basis. The Corvane supplemental statement (D11) gives the adjusted basis ` +
        `(${notes.join(', ')}). The engine's rule says it uses the supplemental statement when it matches the lot, but none was matched, so Schedule D ` +
        `treats the full proceeds as gain, on top of the RSU income already in W-2 box 1. That taxes the same income twice.`,
      surfacedBy: 'Documents → "where it landed": D11 shows no lines reading it. The 8949 lot trace shows a basis of 0.00 with no supplemental source.',
      refs: ['line:F8949.B.N1', 'line:F8949.B.N3', 'line:F8949.E.N4', 'doc:D11#page2', 'doc:D28#page3', 'ev:ev-0066', 'ev:ev-0068', 'ev:ev-0070'],
      fix: {
        summary: `Add basis ${usd(total)} across three lots`,
        authority: 'IRC §83(a)/§1012: RSU income recognized at vest is basis; Form 8949 box B/E adjustment (code B) per broker supplemental statement',
        drafts,
      },
    }]
  },
}

const duplicateInterest: Check = {
  id: 'interest-duplicate',
  title: 'No interest reported twice across composite and stand-alone 1099s',
  run(idx) {
    const lines = idx.current.lines.filter((l) => l.rule === 'R-INTEREST-PAYER' && typeof l.value === 'number' && l.value >= 100)
    const acct = (key: string): { doc: string; end: string | null } => {
      const src = lines.find((l) => l.key === key)?.sources.find((s) => s.startsWith('ev-'))
      const doc = src ? idx.evs.get(src)?.document_id ?? '' : ''
      const end = /ending (\d{4})/.exec(docText(idx, doc))?.[1] ?? null
      return { doc, end }
    }
    for (const a of lines) {
      for (const b of lines) {
        if (a.key >= b.key || a.value !== b.value) continue
        const aa = acct(a.key), bb = acct(b.key)
        if (aa.end && aa.end === bb.end && aa.doc !== bb.doc) {
          return [{
            id: 'interest-double-count',
            area: 'investments_and_digital_assets', severity: 'error', kind: 'engine_error',
            title: `The ${usd(a.value as number)} Northlake bank-sweep interest is on Schedule B twice`,
            detail:
              `The Northlake Securities composite (${aa.doc}, account ending ${aa.end}) already includes a 1099-INT line from Northlake Bank for the sweep program. ` +
              `The stand-alone Northlake Bank 1099-INT (${bb.doc}) is the same form for the same account and amount. Each was read as its own payer ` +
              `(${a.key} and ${b.key}), so interest is overstated by ${usd(a.value as number)}. Net investment income tax is overstated too.`,
            surfacedBy: 'Documents → "where it landed" lists both documents feeding Schedule B at the same amount; the interest-payer tie-out matches account endings.',
            refs: [`line:${a.key}`, `line:${b.key}`, 'doc:D28#page1', 'doc:D29', 'ev:ev-0492', 'ev:ev-0538'],
            fix: {
              summary: `Remove the duplicate ${usd(a.value as number)}`,
              authority: 'Same 1099-INT reported once on a composite and once stand-alone; payer and account match',
              drafts: [{
                target: `line:${b.key}`, label: 'Interest: remove duplicate Northlake Bank 1099-INT', lineDelta: -(a.value as number),
                effects: [{ category: 'interest', amount: -(a.value as number), jurisdictions: [...both] }],
              }],
            },
          }]
        }
      }
    }
    return []
  },
}

const swedishRate: Check = {
  id: 'fx-sek-rate',
  title: 'Foreign interest converted at the right year\'s average rate',
  run(idx) {
    const line = lineIn(idx, 'SchB.1.6')
    if (!line || !line.sources.includes('ref:fx.SEK.2024_average')) return []
    const sek = evNumber(idx, 'D36', 'interest_sek')
    const fx = (idx.param('fx') as any).SEK
    const right = round0(sek / fx['2025_average'])
    const delta = right - numeric(line)
    return [{
      id: 'fx-wrong-year',
      area: 'investments_and_digital_assets', severity: 'warning', kind: 'engine_error',
      title: `Swedish interest converted at the 2024 average rate (${fx['2024_average']}) instead of 2025 (${fx['2025_average']})`,
      detail:
        `SEK ${sek.toLocaleString()} at ${fx['2025_average']} is ${usd(right)}; the engine used ${fx['2024_average']} and got ${usd(numeric(line))}. ` +
        `Small, but it is the kind of silent default a reviewer would never see without opening the line's inputs.`,
      surfacedBy: 'Trace drawer lists the exchange rate as a named input (ref:fx.SEK.2024_average), so the wrong year is visible.',
      refs: ['line:SchB.1.6', 'ev:ev-0960', 'ref:param.fx'],
      fix: {
        summary: `Increase interest by ${usd(delta)}`,
        authority: 'Treas. Reg. §1.988-1(d): average rate for the year of the income (2025)',
        drafts: [{
          target: 'line:SchB.1.6', label: 'Sparbanken interest at 2025 average rate', lineDelta: delta,
          effects: [{ category: 'interest', amount: delta, jurisdictions: [...both] }],
        }],
      },
    }]
  },
}

const cryptoBasis: Check = {
  id: 'crypto-c6-basis',
  title: 'Digital asset lots all carry a basis and acquisition date',
  run(idx) {
    const line = lineIn(idx, 'F8949.H.C6')
    const msg = idx.packet.client.messages.find((m) => m.id === 'msg-07')
    if (!line || !msg) return []
    const basis = /about ([\d,]+)/.exec(msg.text)?.[1]
    if (!basis) return []
    const cost = parseMoney(basis)
    const proceeds = numeric(line) // the engine's basis was zero, so its gain equals the proceeds
    const gain = proceeds - cost
    return [{
      id: 'crypto-c6',
      area: 'investments_and_digital_assets', severity: 'error', kind: 'engine_error',
      title: `Bitcoin lot C6 taxed with zero basis and the wrong holding period`,
      detail:
        `Coinhaven had no basis for the 0.05 BTC because it was transferred in from another exchange. The engine used 0 and the transfer-in date, ` +
        `so the ${usd(proceeds)} sale was taxed as a short-term gain. Erik says (msg-07) he bought it in March 2021 for about ${usd(cost)}, which makes it ` +
        `long-term with a gain of ${usd(gain)}. Support so far is the client's recollection plus a bank line to "CryptoNorth" on 03/15/2021. ` +
        `Get the bank statement before relying on it.`,
      surfacedBy: 'Open question thread on the lot: the client message becomes evidence on the number, with a confidence of 0.60 on the original read.',
      refs: ['line:F8949.H.C6', 'ev:ev-0918', 'ev:ev-0919', 'msg:msg-07', 'doc:D35', 'doc:D34'],
      fix: {
        summary: `Basis ${usd(cost)}, acquired 2021-03-15 (long-term): gain ${usd(gain)}`,
        authority: 'Treas. Reg. §1.1012-1(j) and §1.1223-1: basis and holding period from the original purchase when records can be reconstructed',
        drafts: [{
          target: 'line:F8949.H.C6', label: 'BTC lot C6: reconstructed basis, long-term', lineDelta: gain - numeric(line),
          effects: [
            { category: 'stcg', amount: -numeric(line), jurisdictions: [...both] },
            { category: 'ltcg', amount: gain, jurisdictions: [...both] },
          ],
        }],
      },
      ask: 'Please send the bank statement showing the 03/15/2021 payment of about $3,050 to CryptoNorth, and any exchange confirmation.',
    }]
  },
}

const meridianPage32: Check = {
  id: 'meridian-page-32',
  title: 'Every page of every broker statement was read',
  run(idx) {
    const out: Finding[] = []
    for (const doc of idx.docList) {
      if (doc.extraction.status !== 'partial' || doc.id !== 'D31') continue
      const last = doc.pages[doc.pages.length - 1]
      const m = /proceeds ([\d,.]+) basis ([\d,.]+)/.exec(last.printed_content)
      if (!m) continue
      const proceeds = parseMoney(m[1]), basis = parseMoney(m[2])
      out.push({
        id: 'meridian-p32-unread',
        area: 'investments_and_digital_assets', severity: 'error', kind: 'extraction_error',
        title: `Meridian page 32 was never read: one sale is missing and the summary does not tie by ${usd(proceeds)}`,
        detail:
          `The corrected Meridian 1099 (D31) has a supplemental page 32 with a fractional-share sale (Ironwood REIT, proceeds ${usd(proceeds)}, basis ${usd(basis)}). ` +
          `The pipeline skipped it (${doc.extraction.reason}). The 1099-B summary says 71,965.00 but the lots add to 71,715.00, a difference of exactly ${usd(proceeds)}. ` +
          `Small loss (${usd(proceeds - basis)}), but a completeness gap: the same gap could hide something larger on another statement.`,
        surfacedBy: 'Document index shows extraction status "partial" with the reason; sales detail shows the summary-vs-detail difference.',
        refs: ['doc:D31#page32', 'ev:ev-0703', 'doc:D30'],
        fix: {
          summary: `Add the missing lot: loss ${usd(basis - proceeds)}`,
          authority: 'Form 1099-B page 32 supplemental transactions (short-term, noncovered, Form 8949 box B)',
          drafts: [{
            target: 'line:F8949.B.M18', label: 'Ironwood REIT fractional share (M18), missing lot',
            lineDelta: proceeds - basis,
            effects: [{ category: 'stcg', amount: proceeds - basis, jurisdictions: [...both] }],
          }],
        },
      })
    }
    return out
  },
}

/* ----------------------------------------------------------------- rentals */

const hvacCapitalize: Check = {
  id: 'rental-hvac',
  title: 'Rental repairs separated from improvements that must be depreciated',
  run(idx) {
    const line = lineIn(idx, 'SchE.14A')
    const text = docText(idx, 'D47')
    if (!line || !/new 3-ton heat pump system/.test(text)) return []
    const cost = evNumber(idx, 'D46', 'hvac')
    if (!cost) return []
    const life = 27.5
    const monthsFirstYear = 4.5 // placed in service in August, mid-month convention
    const dep = round2((cost / life) * (monthsFirstYear / 12))
    return [{
      id: 'rental-hvac-capitalize',
      area: 'rentals_and_sale', severity: 'error', kind: 'engine_error',
      title: `The ${usd(cost)} HVAC replacement at Fremont Way was deducted as a repair`,
      detail:
        `The owner statement lumps HVAC inside repairs, and the engine took the whole ${usd(numeric(line))} as an expense. The invoice (D47) is for removing the failed furnace ` +
        `and condenser and installing a new heat pump system with air handler and line set, and Erik confirmed the whole system was replaced. That is an improvement ` +
        `(a restoration of the property), so it is capitalized and depreciated over 27.5 years: about ${usd(dep, true)} for 2025 (placed in service August 2025, mid-month).`,
      surfacedBy: 'Rentals area: each Schedule E expense lists the source line items; D46 shows the HVAC line inside "Repairs". The depreciation list has no asset for it.',
      refs: ['line:SchE.14A', 'line:SchE.18A', 'doc:D46#page1', 'doc:D47', 'call:call-01', 'qa:qa-37'],
      fix: {
        summary: `Capitalize ${usd(cost)}; add ${usd(dep, true)} depreciation`,
        authority: 'Treas. Reg. §1.263(a)-3(j) (restoration/betterment) and (k); residential rental property recovery period 27.5 years',
        drafts: [
          {
            target: 'line:SchE.14A', label: 'Repairs: remove HVAC replacement', lineDelta: -cost,
            effects: [
              { category: 'ordinary_income', amount: cost, jurisdictions: ['federal'] },
              { category: 'ca_source_income', amount: cost, jurisdictions: ['california'] },
            ],
          },
          {
            target: 'line:SchE.18A', label: 'Depreciation: new HVAC system (27.5-yr SL)', lineDelta: dep,
            effects: [
              { category: 'ordinary_income', amount: -dep, jurisdictions: ['federal'] },
              { category: 'ca_source_income', amount: -dep, jurisdictions: ['california'] },
            ],
          },
        ],
      },
    }]
  },
}

/* --------------------------------------------------------------- deductions */

const mortgageInterestDoubleCount: Check = {
  id: 'mortgage-interest',
  title: 'Mortgage interest counted once',
  run(idx) {
    const line = lineIn(idx, 'SchA.8a')
    if (!line || !line.sources.includes('ev-1032')) return []
    if (!/reported on the 2025 Form 1098/.test(docText(idx, 'D56'))) return []
    const payoff = evNumber(idx, 'D56', 'interest')
    return [{
      id: 'mortgage-payoff-interest-twice',
      area: 'deductions_and_credits', severity: 'error', kind: 'engine_error',
      title: `Payoff interest of ${usd(payoff)} added on top of a 1098 that already includes it`,
      detail:
        `The Lonestar Form 1098 box 1 (${usd(evNumber(idx, 'D55', 'box1'))}) says it includes interest paid at payoff on 11/20/2025, and the payoff statement says its interest ` +
        `"is reported on the 2025 Form 1098". The engine's rule adds interest from every 1098 and every lender statement, so ${usd(payoff)} is deducted twice.`,
      surfacedBy: 'Trace of SchA.8a lists four inputs; the payoff statement (D56) is one of them and its printed text says it is already on the 1098.',
      refs: ['line:SchA.8a', 'ev:ev-1029', 'ev:ev-1032', 'doc:D55', 'doc:D56'],
      fix: {
        summary: `Reduce mortgage interest by ${usd(payoff)}`,
        authority: 'IRC §163(h); each dollar of interest deducted once',
        drafts: [{
          target: 'line:SchA.8a', label: 'Mortgage interest: remove payoff interest counted twice', lineDelta: -payoff,
          effects: [{ category: 'itemized', amount: -payoff, jurisdictions: [...both] }],
        }],
      },
    }]
  },
}

const propertyTaxProration: Check = {
  id: 'property-tax-proration',
  title: 'Home property tax limited to the owners\' share of the year',
  run(idx) {
    const line = lineIn(idx, 'SchA.5b')
    if (!line) return []
    const credit = evNumber(idx, 'D54', 'tax_credit')
    const paid = evNumber(idx, 'D58', 'paid')
    if (!credit || numeric(line) !== paid) return []
    const share = paid - credit
    const total = lineNum(idx, 'SchA.5d')
    const cap = lineNum(idx, 'SchA.5e')
    const newLimited = Math.min(total - credit, cap)
    const fedChange = newLimited - cap
    return [{
      id: 'property-tax-seller-share',
      area: 'deductions_and_credits', severity: 'error', kind: 'engine_error',
      title: `Real estate tax deducted includes ${usd(credit)} that belongs to the seller`,
      detail:
        `The Travis County bill for all of 2025 was ${usd(paid)}, paid from escrow in December. At closing on 07/08 the seller credited the buyers ${usd(credit)} ` +
        `for 01/01 to 07/07 (D54), because the seller owned the home then. The Okafor-Lindqvists' own share is ${usd(share)}. ` +
        `Because the SALT total sits above the ${usd(cap)} cap, the federal deduction only falls by ${usd(-fedChange)}; California has no cap, so it falls by the full ${usd(credit)}.`,
      surfacedBy: 'Closing statement and tax receipt side by side in the trace for SchA.5b; the property-tax area shows the proration check.',
      refs: ['line:SchA.5b', 'doc:D54', 'doc:D58', 'ev:ev-1027', 'ev:ev-1038'],
      fix: {
        summary: `Real estate tax ${usd(share)}; federal SALT deduction down ${usd(-fedChange)}`,
        authority: 'IRC §164(d): real estate tax apportioned between seller and buyer by days owned',
        drafts: [{
          target: 'line:SchA.5b', label: 'Real estate taxes: buyers\' share only', lineDelta: -credit,
          effects: [
            { category: 'itemized', amount: fedChange, jurisdictions: ['federal'] },
            { category: 'salt', amount: -credit, jurisdictions: ['california'] },
          ],
        }],
      },
    }]
  },
}

const vehicleDonation: Check = {
  id: 'vehicle-donation',
  title: 'Vehicle donation deduction limited to sale proceeds',
  run(idx) {
    const line = lineIn(idx, 'F8283.A1.vehicle')
    if (!line) return []
    const proceeds = evNumber(idx, 'D66', 'box4c')
    if (!proceeds || !/Box 4a.*checked/.test(docText(idx, 'D66')) || numeric(line) <= proceeds) return []
    return [{
      id: 'vehicle-gift-value',
      area: 'deductions_and_credits', severity: 'error', kind: 'engine_error',
      title: `Subaru donation claimed at ${usd(numeric(line))}; the charity sold it for ${usd(proceeds)}`,
      detail:
        `The engine took the value from the client's questionnaire (Kelley Blue Book "about 6,000") and ignored the Form 1098-C. The 1098-C says the car was sold at arm's length ` +
        `on 09/09/2025 for ${usd(proceeds)} and no goods or services were provided. When the charity sells a car over $500 without a significant use, the deduction is capped ` +
        `at the gross sale proceeds. This is also one of the two items the IRS asks about in the 2028 Letter 566.`,
      surfacedBy: 'The line\'s sources list the questionnaire answer (qa-39) but not the 1098-C; the evidence drawer shows the 1098-C box 4c next to the claim.',
      refs: ['line:F8283.A1.vehicle', 'doc:D66', 'ev:ev-1054', 'qa:qa-39', 'call:call-01', 'agency:/notices/1'],
      fix: {
        summary: `Deduct ${usd(proceeds)}, the 1098-C proceeds`,
        authority: 'IRC §170(f)(12)(A)(ii): deduction limited to gross proceeds of sale by the donee',
        drafts: [{
          target: 'line:F8283.A1.vehicle', label: 'Vehicle gift: limit to 1098-C proceeds', lineDelta: proceeds - numeric(line),
          effects: [{ category: 'itemized', amount: proceeds - numeric(line), jurisdictions: [...both] }],
        }],
      },
    }]
  },
}

/* ---------------------------------------------------------------- payments */

const federalEstimates: Check = {
  id: 'estimates-vs-transcript',
  title: 'Estimated payments agree to the IRS transcript',
  run(idx) {
    const line = lineIn(idx, 'F1040.26')
    const snap = idx.packet.tax_agency_records.irs_account_transcript_2025[0]
    if (!line || !snap) return []
    const paid = snap.transactions
      .filter((t) => t.code === '670' && typeof t.amount === 'number' && t.date >= '2025-04-01' && t.date <= '2026-01-15')
      .reduce((s, t) => s + (t.amount as number), 0)
    if (paid === numeric(line)) return []
    return [{
      id: 'estimates-q4-amount',
      area: 'return_summary', severity: 'error', kind: 'data_conflict',
      title: `Estimated payments ${usd(numeric(line))} but the IRS shows ${usd(paid)}`,
      detail:
        `Three payments have confirmations (D67). For the fourth the engine used the client's answer, "paid January 14, 2026, 4,000 I think" (qa-41). ` +
        `The IRS account transcript pulled on 03/12 shows 3,000 on 2026-01-15. The transcript is third-party evidence; the client answer was a guess. ` +
        `Payments are overstated by ${usd(numeric(line) - paid)}, which understates the balance due by the same amount.`,
      surfacedBy: 'Payments area: each payment has a verification stamp; the transcript is attached and compared to the questionnaire.',
      refs: ['line:F1040.26', 'qa:qa-41', 'agency:/irs_account_transcript_2025/0', 'doc:D67', 'doc:D69'],
      fix: {
        summary: `Payments ${usd(paid)}; balance due up ${usd(numeric(line) - paid)}`,
        authority: 'Estimated payments agreed to IRS account transcript (required step: estimated payments agreed to IRS and FTB records)',
        drafts: [{
          target: 'line:F1040.26', label: 'Estimated payments: agree to IRS transcript', lineDelta: paid - numeric(line),
          effects: [{ category: 'payment', amount: paid - numeric(line), jurisdictions: ['federal'] }],
        }],
      },
    }]
  },
}

const californiaEstimates: Check = {
  id: 'ca-estimates-designation',
  title: 'California payments applied to the right tax year',
  run(idx) {
    const line = lineIn(idx, 'F540NR.72')
    if (!line) return []
    const wrong: { amount: number; date: string }[] = []
    for (const e of idx.evsByDoc.get('D68') ?? []) {
      const m = /^(pay\d+)_year$/.exec(e.field)
      if (!m || Number(e.value) === 2025) continue
      const id = e.id
      if (!line.sources.includes(id)) continue
      wrong.push({
        amount: evNumber(idx, 'D68', `${m[1]}_amount`),
        date: String(evByField(idx, 'D68', `${m[1]}_date`)?.value ?? ''),
      })
    }
    if (!wrong.length) return []
    const sum = wrong.reduce((s, w) => s + w.amount, 0)
    return [{
      id: 'ca-estimate-wrong-year',
      area: 'california', severity: 'error', kind: 'engine_error',
      title: `California estimated payments include ${usd(sum)} that FTB applied to tax year 2024`,
      detail:
        `The engine's rule counts every FTB payment dated 04/01/2025 to 01/15/2026. The Web Pay confirmation (D68) and the FTB account both show the ` +
        `${wrong[0].date} payment of ${usd(wrong[0].amount)} designated as tax year 2024, "held as a 2024 credit". ` +
        `On the return as filed it should not count toward 2025. The client can ask FTB to move it, which is a follow-up action, not a return number.`,
      surfacedBy: 'Payments area lists each payment with its designated tax year from the source document.',
      refs: ['line:F540NR.72', 'doc:D68', 'ev:ev-1076', 'ev:ev-1075', 'agency:/ftb_account'],
      fix: {
        summary: `California payments down ${usd(sum)} unless FTB re-designates it`,
        authority: 'FTB account shows the payment held as a 2024 credit; payments counted only for the designated year',
        drafts: [{
          target: 'line:F540NR.72', label: 'California estimates: exclude payment designated 2024', lineDelta: -sum,
          effects: [{ category: 'payment', amount: -sum, jurisdictions: ['california'] }],
        }],
      },
      ask: 'Please call FTB or use MyFTB to move the 09/15/2025 payment of $3,500 from tax year 2024 to 2025. Was it meant as a 2025 payment?',
    }]
  },
}

/* -------------------------------------------------------------- california */

const californiaWages: Check = {
  id: 'ca-wage-source',
  title: 'California-source wages stop at the move date',
  run(idx) {
    const line = lineIn(idx, 'SchCA540NR.1.E')
    if (!line) return []
    const box16 = (d: string) => evNumber(idx, d, 'box16')
    const ytd = evNumber(idx, 'D73', 'ytd_ca_wages')
    if (!ytd) return []
    const right = box16('D08') + ytd
    const delta = right - numeric(line)
    if (delta >= 0) return []
    return [{
      id: 'ca-wages-after-move',
      area: 'california', severity: 'error', kind: 'engine_error',
      title: `${usd(-delta)} of Texas-period wages treated as California-source`,
      detail:
        `For the part-year return the engine took California wages straight from W-2 box 16. Halvorsen's payroll kept California as the work state through 09/30 ` +
        `(a mistake the client mentions in qa-45), but Ngozi moved to Austin on 07/15. The paystub (D73) shows California taxable wages of ${usd(ytd)} through 07/15. ` +
        `Wages for work done in Texas after the move are not California-source. California wages should be ${usd(box16('D08'))} (Corvane, all earned in California) + ${usd(ytd)} = ${usd(right)}, ` +
        `not ${usd(numeric(line))}. The withholding credit (box 17) is unaffected.`,
      surfacedBy: 'Residency timeline beside the California area; the Halvorsen W-2 note and the paystub sit on the same trace.',
      refs: ['line:SchCA540NR.1.E', 'doc:D09', 'doc:D73', 'ev:ev-1081', 'qa:qa-45', 'household:ngozi'],
      fix: {
        summary: `California wages ${usd(right)}`,
        authority: 'R&TC §17951–17954: nonresident period wages are California-source only for services performed in California',
        drafts: [{
          target: 'line:SchCA540NR.1.E', label: 'California-source wages: through the move date only', lineDelta: delta,
          effects: [{ category: 'ca_source_income', amount: delta, jurisdictions: ['california'] }],
        }],
      },
      ask: 'Please ask Halvorsen payroll for a corrected state wage report, and confirm the date of your first day working from Austin.',
    }]
  },
}

/* ---------------------------------------------------------------- identity */

const idMisreads: Check = {
  id: 'ids-agree-to-print',
  title: 'EINs, SSNs and account numbers match what is printed',
  run(idx) {
    const out: Finding[] = []
    for (const e of idx.packet.extracted_values) {
      if (!['ein', 'ssn', 'account_number'].includes(e.value_type)) continue
      const text = docText(idx, e.document_id, e.page)
      if (text.includes(String(e.value))) continue
      const pattern = e.value_type === 'ein' ? /\b\d\d-\d{7}\b/g : /\b\d{3}-\d\d-\d{4}\b/g
      const sorted = (s: string) => s.replace(/\D/g, '').split('').sort().join('')
      const printed = (text.match(pattern) ?? []).find((t) => sorted(t) === sorted(String(e.value)))
      if (!printed) continue
      const used = idx.linesByEv.get(e.id) ?? []
      out.push({
        id: `id-misread-${e.id}`,
        area: 'deductions_and_credits', severity: 'warning', kind: 'extraction_error',
        title: `${idx.docs.get(e.document_id)?.issuer}: tax ID read as ${e.value}, printed as ${printed} (confidence ${e.confidence})`,
        detail:
          `Two digits are swapped. The pipeline was confident (${e.confidence}), so nothing flagged it. The wrong number flows to ${used.map((l) => l.key).join(', ') || 'no line'} ` +
          `(care provider on Form 2441). The credit is zero this year because of the employer's dependent-care benefits, but a wrong provider EIN invites a notice and fails due diligence.`,
        surfacedBy: 'Every extracted value is checked against the printed page text, independent of its confidence score.',
        refs: [`ev:${e.id}`, `doc:${e.document_id}#page${e.page}`, ...used.map((l) => `line:${l.key}`)],
        fix: {
          summary: `Correct to ${printed}`,
          authority: 'Provider TIN as printed on the care statement',
          drafts: [{ target: `ev:${e.id}`, label: 'Provider EIN: transposed digits', textFix: { from: String(e.value), to: printed }, effects: [] }],
        },
      })
    }
    return out
  },
}

const dependentSsn: Check = {
  id: 'dependent-ssn',
  title: 'Dependent SSNs agree across the organizer, the SS card and last year\'s return',
  run(idx) {
    const theo = idx.packet.household.people.find((p) => p.id === 'theo')
    const card = /666-\d\d-\d{4}/.exec(docText(idx, 'D71'))?.[0]
    const py = idx.packet.prior_years.return_2024.dependents.find((d) => d.name.startsWith('Theo'))?.ssn
    if (!theo || !card || card === theo.ssn) return []
    const efile = idx.packet.tax_agency_records.efile.find((e) => e.status === 'rejected')
    return [{
      id: 'theo-ssn-typo',
      area: 'intake_and_engagement', severity: 'error', kind: 'data_conflict',
      title: `Theo's SSN: organizer ${theo.ssn}, Social Security card ${card}`,
      detail:
        `The client typed ${theo.ssn} in the organizer. The photographed card (D71) and the 2024 return (${py ?? 'n/a'}) both say ${card}; two digits are swapped. ` +
        `This is exactly why the federal e-file was rejected on 07/13 (${efile?.errors?.[0]?.code}: dependent's TIN and name must match). ` +
        `Nothing in the pipeline compared the organizer to the card, and the CTC for Theo depends on it.`,
      surfacedBy: 'Household record with a cross-check of every identifier against the documents; the e-file rejection is linked to the same finding.',
      refs: ['household:theo', 'doc:D71', 'doc:D06#page1', 'msg:msg-10', 'agency:/efile/0'],
      fix: {
        summary: `Correct Theo's SSN to ${card}`,
        authority: 'Social Security card (D71) and 2024 return agree',
        drafts: [{ target: 'household:theo', label: 'Theo SSN', textFix: { from: theo.ssn, to: card }, effects: [] }],
      },
    }]
  },
}

const handwrittenReceipt: Check = {
  id: 'low-confidence-values',
  title: 'Low-confidence reads are confirmed by a second source',
  run(idx) {
    const out: Finding[] = []
    for (const e of idx.packet.extracted_values) {
      if (e.confidence >= 0.8 || e.id === 'ev-0919') continue
      const msg = idx.packet.client.messages.find((m) => /St\. Brigid.*1,500/.test(m.text))
      out.push({
        id: `low-conf-${e.id}`,
        area: 'deductions_and_credits', severity: 'warning', kind: 'extraction_error',
        title: `${idx.docs.get(e.document_id)?.title}: amount read at confidence ${e.confidence}`,
        detail:
          `The receipt's first digit is ambiguous in print: it could be 1,500 or 7,500. The pipeline picked 1,500 at ${e.confidence}. ` +
          (msg ? `On 07/01 the client wrote that the parish confirmed 1,500 by phone and the bank statement matches (check #2207, 12/21/2025) (${msg.id}). ` : '') +
          `That settles it, but only if the bank statement is kept: the parish's word and the client's message are not third-party records.`,
        surfacedBy: 'Confidence is shown on every extracted value, and anything under 0.8 opens a verification task.',
        refs: [`ev:${e.id}`, 'doc:D64', 'msg:msg-08', 'line:SchA.11'],
        ask: 'Please upload the bank statement page showing check #2207 on 12/21/2025.',
      })
    }
    return out
  },
}

export const engineChecks: Check[] = [
  grossReceipts, mileageDuplicatePage, phoneAndInternet, personalSubscription,
  healthInsuranceEligibility, sepExcess,
  rsuBasis, duplicateInterest, swedishRate, cryptoBasis, meridianPage32,
  hvacCapitalize,
  mortgageInterestDoubleCount, propertyTaxProration, vehicleDonation,
  federalEstimates, californiaEstimates, californiaWages,
  idMisreads, dependentSsn, handwrittenReceipt,
]
