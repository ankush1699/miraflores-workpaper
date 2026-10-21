import { lineIn, numeric } from '../packet'
import type { Finding } from './types'
import type { Check } from './engineChecks'
import { docText, evNumber, parseMoney, usd } from './helpers'

// Checks that are about the client's story, the records around the return, and the
// things the engagement does not cover. They matter to a reviewer as much as a wrong number.

/* ------------------------------------------------------ answers vs documents */

const questionnaireConflicts: Check = {
  id: 'questionnaire-vs-documents',
  title: 'Client answers agree with the documents',
  run(idx) {
    const out: Finding[] = []
    const lots = idx.current.lines.filter((l) => l.rule === 'R-8949-LOT')
    const stockLots = lots.filter((l) => !/^(H|K)\./.test(l.line)).length
    const coinLots = lots.length - stockLots
    out.push({
      id: 'qa-14-sales',
      area: 'investments_and_digital_assets', severity: 'warning', kind: 'data_conflict',
      title: 'Client said no investments were sold; the documents show hundreds of sales',
      detail:
        `qa-14 answers "No". The brokerage statements show ${stockLots} stock and fund sales (Northlake, Meridian, Brightpath) and the Coinhaven 1099-DA shows ${coinLots} digital asset sales. ` +
        `The documents win, but the answer matters for completeness: if the client thinks the direct-indexing account is "not selling", something else may also be missing from their mental list.`,
      surfacedBy: 'The questionnaire is shown beside the area it relates to, and the engine\'s own conflict diagnostic is linked to the finding that supersedes it.',
      refs: ['qa:qa-14', 'qa:qa-15', 'doc:D28', 'doc:D31', 'doc:D74', 'doc:D34'],
      ask: 'You answered that no investments were sold, but your statements show many sales. Which accounts did you consider when answering?',
    })
    const hasRollover = lineIn(idx, 'F8606.2')
    if (hasRollover && numeric(hasRollover) === 7000) {
      out.push({
        id: 'qa-31-ira-basis',
        area: 'wages_and_stock_compensation', severity: 'info', kind: 'data_conflict',
        title: 'Client says no prior IRA basis; the 2024 Form 8606 and Form 5498 show 7,000',
        detail:
          `qa-31: "Prior basis: none that I know of - we started doing this in 2025". But the 2024 return carries 7,000 of basis on Form 8606 line 14 and Form 5498 for 2024 ` +
          `(D42) shows a 7,000 contribution made 02/12/2025 for 2024. With that basis, the 14,026 converted in 2025 is only 26 taxable. If the client were right, ` +
          `taxable conversion would be 7,026. Documents win; record the agreement and keep the 5498 on file, which the prior preparer never obtained.`,
        surfacedBy: 'Carryovers and basis table agrees 8606 basis to the prior return and to the 5498; the questionnaire answer is attached to the same line.',
        refs: ['line:F8606.2', 'line:F8606.18', 'qa:qa-31', 'doc:D42', 'doc:D43', 'py:/basis_records/ira_nondeductible_basis_ngozi'],
      })
    }
    const ins = lineIn(idx, 'SchE.9A')
    if (ins && ins.sources.every((s) => s.startsWith('qa-'))) {
      out.push({
        id: 'qa-36-landlord-insurance',
        area: 'rentals_and_sale', severity: 'warning', kind: 'data_conflict',
        title: `Landlord insurance of ${usd(numeric(ins))} rests on the questionnaire alone`,
        detail: `The only support for SchE.9A is the client's answer (qa-36: "paid directly to the insurer"). There is no invoice or policy statement in the file. It is plausible (last year was 1,800) but unverified.`,
        surfacedBy: 'Verification stamps: a number whose only source is a client answer shows "confirmed with client" and nothing stronger.',
        refs: ['line:SchE.9A', 'qa:qa-36', 'py:/return_2024/lines/SchE.9A'],
        ask: 'Please upload the 2025 declarations page or premium receipt for the Fremont Way landlord policy.',
      })
    }
    return out
  },
}

/* ----------------------------------------------------- pass-throughs / basis */

const scorpBasis: Check = {
  id: 'scorp-basis',
  title: 'S corporation stock basis rolled forward from the K-1s',
  run(idx) {
    const begin = lineIn(idx, 'F7203.1')
    const excess = lineIn(idx, 'F7203.excess')
    if (!begin || !excess || numeric(excess) <= 0) return []
    const rows = (idx.packet.prior_years.basis_records.scorp_lindqvist_family_woodworks as any[]) ?? []
    const b2022 = rows.find((r) => r.year === 2022)?.ending_stock_basis as number
    const in2023 = evNumber(idx, 'D40', 'box1')
    const out2023 = evNumber(idx, 'D40', 'box16d')
    const in2024 = idx.packet.prior_years.return_2024.K1_1120S.box1
    const out2024 = idx.packet.prior_years.return_2024.K1_1120S.box16D
    const rolled = b2022 + in2023 - out2023 + in2024 - out2024
    return [{
      id: 'scorp-distributions-over-basis',
      area: 'pass_throughs_and_basis', severity: 'warning', kind: 'judgment',
      title: `Woodworks distributions exceed stock basis: ${usd(numeric(excess))} taxed as capital gain`,
      detail:
        `Rolling basis forward: 2022 ${usd(b2022)} (a client worksheet, never verified) + 2023 income ${usd(in2023)} - distributions ${usd(out2023)} + 2024 income ${usd(in2024)} - distributions ${usd(out2024)} = ${usd(rolled)}, ` +
        `which agrees to the engine's opening basis of ${usd(numeric(begin))}. In 2025 income of ${usd(18485)} is added and ${usd(42000)} is distributed, so ${usd(numeric(excess))} is gain. ` +
        `It only exists because the 2023 K-1 was missing last year and distributions were never checked against basis. Before filing, ask Woodworks' CPA about shareholder loans and the basis schedule: any loan basis would remove the gain. ` +
        `The 2025 K-1 notes 1,580 of Oregon tax paid for Erik is inside box 16D.`,
      surfacedBy: 'Basis table by year with gaps shown as gaps; the engine\'s own diagnostic about the missing 2023 K-1 disappears when D40 arrives and this one takes its place.',
      refs: ['line:F7203.1', 'line:F7203.excess', 'doc:D40', 'doc:D39', 'py:/basis_records/scorp_lindqvist_family_woodworks'],
      ask: 'Please ask the Woodworks CPA for each shareholder\'s stock and loan basis schedule through 2025.',
    }]
  },
}

const ridgelineBasis: Check = {
  id: 'ridgeline-basis',
  title: 'Partnership capital account rolls forward',
  run(idx) {
    const begin = evNumber(idx, 'D37', 'cap_begin')
    const end = idx.current.carryovers_out.federal['ridgeline_capital_account_end']
    const income = 8400 + 120 + 1350
    const rolled = begin + income - 6000 - 210
    if (end === rolled) return [{
      id: 'ridgeline-outside-basis',
      area: 'pass_throughs_and_basis', severity: 'info', kind: 'tie_out',
      title: 'Ridgeline capital account ties, but outside basis was never computed',
      detail:
        `Capital account: 60,000 + income ${usd(income)} - distributions 6,000 - foreign taxes 210 = ${usd(rolled)}, agreeing to the K-1. That is the book capital account. ` +
        `Outside basis (needed to test whether the 6,000 distribution and the passive losses are limited) has no history; the 2024 return noted "never computed". ` +
        `Carry it as an open item for next year's preparer.`,
      surfacedBy: 'Basis table row for Ridgeline shows outside basis as a real gap, not zero.',
      refs: ['doc:D37', 'py:/basis_records/partnership_ridgeline', 'line:SchE.28B'],
    }]
    return []
  },
}

/* --------------------------------------------------------- judgment items */

const dueDiligence: Check = {
  id: 'due-diligence',
  title: 'Due diligence recorded for credits claimed',
  run(idx) {
    const line = lineIn(idx, 'F8867.status')
    if (!line) return []
    return [{
      id: 'form-8867',
      area: 'deductions_and_credits', severity: 'warning', kind: 'judgment',
      title: 'Form 8867 (paid preparer due diligence) not completed',
      detail:
        `The child tax credit and credit for other dependents are claimed (CTC 2,200 for Theo; ODC 500 for Ada, phased down to ${usd(numeric(lineIn(idx, 'F1040.19')))} by income). ` +
        `The firm's own rules require due diligence to be documented for these, and the engine says only the preparer can complete the checklist. ` +
        `Ada is 19, a full-time student who lived at home 12 months by the client's account, and files her own return with the dependent box checked (related return, not in this packet). Theo's SSN needs fixing first.`,
      surfacedBy: 'Judgment page: due diligence is a checklist per credit with the facts it relies on, and it is a required step before sign-off.',
      refs: ['line:F8867.status', 'line:F1040.19', 'household:ada', 'household:theo'],
    }]
  },
}

const californiaAmt: Check = {
  id: 'ca-amt',
  title: 'California AMT considered',
  run(idx) {
    const iso = lineIn(idx, 'F6251.2i')
    if (!iso) return []
    return [{
      id: 'ca-amt-not-computed',
      area: 'california', severity: 'warning', kind: 'judgment',
      title: 'California AMT is not computed by the engine',
      detail:
        `The ISO exercise on 07/30/2025 (1,000 shares, spread ${usd(numeric(iso))}) triggers federal AMT of ${usd(numeric(lineIn(idx, 'F6251.11')))}. California has its own AMT (Schedule P 540NR) ` +
        `and the exercise happened after the move to Texas. Allocation of the ISO adjustment between California and Texas is a judgment call that needs a recorded conclusion; the engine writes 0 for California AMT.`,
      surfacedBy: 'California area lists what the engine did not compute as an explicit open item instead of a silent zero.',
      refs: ['line:F540NR.61', 'line:F6251.2i', 'doc:D12'],
    }]
  },
}

const equipmentElection: Check = {
  id: 'equipment-election',
  title: 'Equipment depreciation election considered',
  run(idx) {
    const alt = idx.packet.what_if.alternatives
    const s179 = alt.find((a) => a.id === 'equipment_section179')
    const macrs = alt.find((a) => a.id === 'equipment_no_bonus')
    if (!s179 || !macrs) return []
    return [{
      id: 'election-equipment',
      area: 'business', severity: 'info', kind: 'judgment',
      title: 'Election: 100% special depreciation vs section 179 vs regular MACRS on the $38,000 equipment',
      detail:
        `The engine defaulted to 100% special depreciation for the March purchases. Its alternatives: section 179 leaves federal tax unchanged but changes California by ${usd(s179.california.total_tax_change)} ` +
        `(California allows 179 up to 25,000 but not bonus); electing out of bonus into 5-year MACRS raises federal tax by ${usd(macrs.federal.total_tax_change)} and lowers California by ${usd(-macrs.california.total_tax_change)}. ` +
        `Because California tax is lower with 179 and federal is identical, it is worth recording a decision. Note the California advantage is mostly for the part-year resident share, and the 2026 return is California-source only.`,
      surfacedBy: 'What-if panel: each engine alternative with federal and California effect side by side, and a place to record which election was made and why.',
      refs: ['whatif:equipment_section179', 'whatif:equipment_no_bonus', 'line:F4562-C.14', 'doc:D22'],
    }]
  },
}

/* ------------------------------------------------------------ outside scope */

const outsideScope: Check = {
  id: 'outside-filings',
  title: 'Every filing outside this return identified',
  run(idx) {
    const out: Finding[] = []
    const contractors = docText(idx, 'D27')
    const people = [...contractors.matchAll(/([A-Z][a-z]+ [A-Z][a-z]+) \(([^)]+)\) ([\d,]+\.\d\d)/g)]
    if (people.length) {
      out.push({
        id: 'outside-1099-nec',
        area: 'business', severity: 'warning', kind: 'outside_scope',
        title: 'Forms 1099-NEC for two contractors were never filed',
        detail:
          people.map((m) => `${m[1]} (${m[2]}) ${usd(parseMoney(m[3]))}`).join(' and ') +
          ` were each paid more than $600 by ACH. The 2025 1099-NEC due date was 02/02/2026 and has passed; qa-23 says the client did not know. ` +
          `The engagement letter excludes information returns the business must issue, so we do not prepare them, but we must tell the client in writing and note the late-filing penalty exposure. ` +
          `Erik asked on the 03/26 call what to do.`,
        surfacedBy: 'Completeness page: "outside filings identified" lists each one with the source and who owns it.',
        refs: ['doc:D27', 'doc:D01#page1', 'qa:qa-22', 'qa:qa-23', 'call:call-01'],
        ask: 'Do you want us to refer you to a service to file the late 1099-NECs for Mara Quintero and Dev Patel?',
      })
    }
    const max = lineIn(idx, 'F8938.1.max')
    if (max) {
      out.push({
        id: 'outside-fbar',
        area: 'investments_and_digital_assets', severity: 'warning', kind: 'outside_scope',
        title: 'FinCEN 114 (FBAR) for the Swedish account is due separately',
        detail:
          `The Sparbanken account peaked at SEK 1,452,300 (about ${usd(numeric(max))}), well above the $10,000 FBAR threshold. The FBAR is outside the engagement (D01) ` +
          `and was filed separately by the client last year (prior preparer note). Its automatic extended due date is 10/15/2026. Form 8938 (${usd(numeric(max))} at the Treasury year-end rate) is on the return. ` +
          `Note the maximum balance must be converted at the year-end rate for both forms.`,
        surfacedBy: 'Firm deadlines are on the timeline; the FBAR date sits next to the return\'s own extended date.',
        refs: ['line:F8938.1.max', 'doc:D36', 'doc:D01#page1', 'qa:qa-07', 'py:/prior_preparer_workpaper/notes'],
      })
    }
    if (/3520/.test(docText(idx, 'D07'))) {
      out.push({
        id: 'outside-3520',
        area: 'intake_and_engagement', severity: 'warning', kind: 'outside_scope',
        title: 'Form 3520 for the 2023 foreign inheritance was never resolved',
        detail:
          `The prior preparer's open items end with "2023 Form 3520 (foreign inheritance over 100,000) - discussed? (no note of resolution)". The Sparbanken account was opened 09/2023 with an inheritance from Birgitta Lindqvist, a foreign person. ` +
          `A U.S. person who receives more than $100,000 from a foreign estate must file Form 3520; the late-filing penalty runs 5% a month up to 25%. This is an inherited exposure, outside this return, and the client should hear about it now.`,
        surfacedBy: 'Prior-preparer open items are imported as tasks, each needing a resolution; this one has none.',
        refs: ['doc:D07#page3', 'doc:D36', 'py:/prior_preparer_workpaper/open_items_left_by_prior_preparer'],
        ask: 'Was Form 3520 filed for the 2023 inheritance from Birgitta Lindqvist? If not, we recommend speaking with a tax controversy specialist about late filing.',
      })
    }
    const ada = idx.packet.household.related_returns.find((r) => r.who.startsWith('Ada'))
    if (ada) {
      out.push({
        id: 'related-ada-return',
        area: 'deductions_and_credits', severity: 'info', kind: 'outside_scope',
        title: 'Ada files her own return and must be claimed as a dependent here, not there',
        detail:
          `Ada (19, full-time student) prepares her own return with consumer software. It must show "someone can claim you as a dependent", and it cannot claim the American opportunity credit; ` +
          `the 1098-T is on the parents' side, where the credit is fully phased out at this income. The two returns have to agree on who claims Ada, so link them.`,
        surfacedBy: 'Related returns are linked items on the household record, with the thing they must agree on.',
        refs: ['household:ada', 'line:F8863.7', 'doc:D59', 'doc:D60'],
      })
    }
    const comp = idx.packet.household.related_returns.filter((r) => /composite/.test(r.return))
    for (const r of comp) {
      out.push({
        id: `related-${r.who.slice(0, 8).toLowerCase().replace(/\W/g, '')}`,
        area: 'pass_throughs_and_basis', severity: 'info', kind: 'outside_scope',
        title: `${r.who}: composite return filed by someone else`,
        detail: `${r.return}, prepared by ${r.prepared_by}. Only the K-1 is in this packet. The Oregon/Arizona composite tax already paid on Erik's behalf means no separate nonresident filing is needed; note it so it is not rediscovered later.`,
        surfacedBy: 'Related returns are linked items on the household record.',
        refs: ['doc:D39', 'doc:D38'],
      })
    }
    return out
  },
}

export const otherChecks: Check[] = [
  questionnaireConflicts, scorpBasis, ridgelineBasis,
  dueDiligence, californiaAmt, equipmentElection, outsideScope,
]
