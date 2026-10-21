# Errors found in the Okafor-Lindqvist packet

The workpaper's independent checks found **26 errors and checks** by recomputing from the printed documents. The engine's own diagnostics (11 on v3) flagged none of the engine errors. Effects are estimates from the engine's per-dollar rates at the v3 numbers (+ means the client owes more).

| # | What was wrong | Area | Federal | California | Surfaced by |
|---|---|---|---|---|---|
| 1 | Schedule C gross receipts counted $12,400 twice | Business (Lindqvist Studio) | −$4,402 | −$384 | Reconciliation panel on Business: books vs 1099-NEC vs 1099-K |
| 2 | Mileage log page 3 is a second scan of another page (3,700 miles counted twice) | Business (Lindqvist Studio) | +$919 | +$80 | Document viewer shows the page text next to its extracted total |
| 3 | RSU sales taxed with zero basis: gain overstated by $47,620 | Investments & digital assets | −$15,536 | −$1,618 | Documents → "where it landed": D11 shows no lines reading it. The 8949 lot trace shows a basis of 0.00 with no supplemental source. |
| 4 | The $1,840 Northlake bank-sweep interest is on Schedule B twice | Investments & digital assets | −$640 | −$127 | Documents → "where it landed" lists both documents feeding Schedule B at the same amount |
| 5 | Bitcoin lot C6 taxed with zero basis and the wrong holding period | Investments & digital assets | −$1,312 | −$104 | Open question thread on the lot: the client message becomes evidence on the number, with a confidence of 0.60 on the original read. |
| 6 | Meridian page 32 was never read: one sale is missing and the summary does not tie by $250 | Investments & digital assets | −$21 | −$2 | Document index shows extraction status "partial" with the reason |
| 7 | The $11,000 HVAC replacement at Fremont Way was deducted as a repair | Rentals & the condo sale | +$3,364 | +$694 | Rentals area: each Schedule E expense lists the source line items |
| 8 | Payoff interest of $2,150 added on top of a 1098 that already includes it | Deductions & credits | +$559 | +$103 | Trace of SchA.8a lists four inputs |
| 9 | Real estate tax deducted includes $6,912 that belongs to the seller | Deductions & credits | +$1,462 | +$332 | Closing statement and tax receipt side by side in the trace for SchA.5b |
| 10 | Subaru donation claimed at $6,000; the charity sold it for $2,900 | Deductions & credits | +$806 | +$149 | The line's sources list the questionnaire answer (qa-39) but not the 1098-C |
| 11 | Estimated payments $13,000 but the IRS shows $12,000 | Return totals & payments | +$1,000 | +$0 | Payments area: each payment has a verification stamp |
| 12 | California estimated payments include $3,500 that FTB applied to tax year 2024 | California (540NR) | +$0 | +$3,500 | Payments area lists each payment with its designated tax year from the source document. |
| 13 | $88,831 of Texas-period wages treated as California-source | California (540NR) | +$0 | −$5,685 | Residency timeline beside the California area |
| 14 | Theo's SSN: organizer 666-74-3309, Social Security card 666-74-3390 | Intake & engagement | +$0 | +$0 | Household record with a cross-check of every identifier against the documents |
| 15 | Phone and internet deducted at 100%; client says 70% and 50% business | Business (Lindqvist Studio) | +$464 | +$41 | Client call notes are attached to the evidence for SchC.25, so the percentages sit next to the number. |
| 16 | Spotify Family ($216) is in business software but is personal | Business (Lindqvist Studio) | +$77 | +$7 | Books-to-tax view lists the account detail under each P&L line. |
| 17 | Swedish interest converted at the 2024 average rate (10.56) instead of 2025 (9.86) | Investments & digital assets | +$43 | +$9 | Trace drawer lists the exchange rate as a named input (ref:fx.SEK.2024_average), so the wrong year is visible. |
| 18 | Little Sprouts Learning Center: tax ID read as 74-3829516, printed as 74-3829156 (confidence 0.97) | Deductions & credits | +$0 | +$0 | Every extracted value is checked against the printed page text, independent of its confidence score. |
| 19 | Handwritten donation receipt - St. Brigid Parish: amount read at confidence 0.41 | Deductions & credits | n/a | n/a | Confidence is shown on every extracted value, and anything under 0.8 opens a verification task. |
| 20 | Client said no investments were sold; the documents show hundreds of sales | Investments & digital assets | n/a | n/a | The questionnaire is shown beside the area it relates to, and the engine's own conflict diagnostic is linked to the finding that supersedes it. |
| 21 | Landlord insurance of $1,850 rests on the questionnaire alone | Rentals & the condo sale | n/a | n/a | Verification stamps: a number whose only source is a client answer shows "confirmed with client" and nothing stronger. |
| 22 | D13 "Form 3922 - ESPP transfer (Corvane)" was used, but nothing in it reached the return | Partner review | n/a | n/a | Document index shows, for each document, the exact lines it fed. An empty "landed on" cell next to "used" is the signal. |
| 23 | D15 "Lindqvist Studio - transaction detail for selected accounts" was used, but nothing in it reached the return | Partner review | n/a | n/a | Document index shows, for each document, the exact lines it fed. An empty "landed on" cell next to "used" is the signal. |
| 24 | D47 "Invoice - Delta Breeze Heating & Air (1450 Fremont Way)" was used, but nothing in it reached the return | Partner review | n/a | n/a | Document index shows, for each document, the exact lines it fed. An empty "landed on" cell next to "used" is the signal. |
| 25 | D54 "Buyer closing statement - 7709 Barton Ridge Dr (purchase 07/08/2025)" was used, but nothing in it reached the return | Partner review | n/a | n/a | Document index shows, for each document, the exact lines it fed. An empty "landed on" cell next to "used" is the signal. |
| 26 | D73 "Halvorsen Data paystub - pay date 07/18/2025 (Ngozi Okafor)" was used, but nothing in it reached the return | Partner review | n/a | n/a | Document index shows, for each document, the exact lines it fed. An empty "landed on" cell next to "used" is the signal. |

## Detail

### 1. Schedule C gross receipts counted $12,400 twice

The engine added the $12,400 Paywell 1099-K to the books' $151,300 of revenue because it could not match the card payments to a deposit. The books already include them: Atlas paid $41,200 in total, and $12,400 of that came through Paywell (D15 p3). The books tie exactly to the five 1099-NECs ($142,000) plus $9,300 from small clients with no 1099 = $151,300. Gross receipts should be $151,300, not $163,700.

**Kind:** engine error · **Evidence:** line:SchC.1, ev:ev-0103, ev:ev-0127, doc:D15#page3, doc:D17, doc:D21

**How the design surfaced it:** Reconciliation panel on Business: books vs 1099-NEC vs 1099-K; trace of SchC.1 shows the 1099-K as a separate input.

### 2. Mileage log page 3 is a second scan of another page (3,700 miles counted twice)

Page 3 is labelled "second scan of the May-Aug sheet", and its trips match the earlier page line for line. The engine adds every page total, so business miles came out 11,800 instead of 8,100. At 0.7 per mile that overstates the car deduction by $2,590.

**Kind:** extraction error · **Evidence:** line:SchC.44a, line:SchC.9, doc:D23#page3, doc:D23#page2, msg:msg-03

**How the design surfaced it:** Document viewer shows the page text next to its extracted total; the duplicate-page comparison flags it before the number is trusted.

### 3. RSU sales taxed with zero basis: gain overstated by $47,620

Northlake reported the three RSU lots as noncovered with no cost basis. The Corvane supplemental statement (D11) gives the adjusted basis (RSU-2502 $19,100, RSU-2505 $19,100, RSU-2308 $9,420). The engine's rule says it uses the supplemental statement when it matches the lot, but none was matched, so Schedule D treats the full proceeds as gain, on top of the RSU income already in W-2 box 1. That taxes the same income twice.

**Kind:** engine error · **Evidence:** line:F8949.B.N1, line:F8949.B.N3, line:F8949.E.N4, doc:D11#page2, doc:D28#page3, ev:ev-0066, ev:ev-0068, ev:ev-0070

**How the design surfaced it:** Documents → "where it landed": D11 shows no lines reading it. The 8949 lot trace shows a basis of 0.00 with no supplemental source.

### 4. The $1,840 Northlake bank-sweep interest is on Schedule B twice

The Northlake Securities composite (D28, account ending 7731) already includes a 1099-INT line from Northlake Bank for the sweep program. The stand-alone Northlake Bank 1099-INT (D29) is the same form for the same account and amount. Each was read as its own payer (SchB.1.1 and SchB.1.2), so interest is overstated by $1,840. Net investment income tax is overstated too.

**Kind:** engine error · **Evidence:** line:SchB.1.1, line:SchB.1.2, doc:D28#page1, doc:D29, ev:ev-0492, ev:ev-0538

**How the design surfaced it:** Documents → "where it landed" lists both documents feeding Schedule B at the same amount; the interest-payer tie-out matches account endings.

### 5. Bitcoin lot C6 taxed with zero basis and the wrong holding period

Coinhaven had no basis for the 0.05 BTC because it was transferred in from another exchange. The engine used 0 and the transfer-in date, so the $5,325 sale was taxed as a short-term gain. Erik says (msg-07) he bought it in March 2021 for about $3,050, which makes it long-term with a gain of $2,275. Support so far is the client's recollection plus a bank line to "CryptoNorth" on 03/15/2021. Get the bank statement before relying on it.

**Kind:** engine error · **Evidence:** line:F8949.H.C6, ev:ev-0918, ev:ev-0919, msg:msg-07, doc:D35, doc:D34

**How the design surfaced it:** Open question thread on the lot: the client message becomes evidence on the number, with a confidence of 0.60 on the original read.

### 6. Meridian page 32 was never read: one sale is missing and the summary does not tie by $250

The corrected Meridian 1099 (D31) has a supplemental page 32 with a fractional-share sale (Ironwood REIT, proceeds $250, basis $310). The pipeline skipped it (Page 32 ('Additional transactions') was not read by the pipeline.). The 1099-B summary says 71,965.00 but the lots add to 71,715.00, a difference of exactly $250. Small loss (−$60), but a completeness gap: the same gap could hide something larger on another statement.

**Kind:** extraction error · **Evidence:** doc:D31#page32, ev:ev-0703, doc:D30

**How the design surfaced it:** Document index shows extraction status "partial" with the reason; sales detail shows the summary-vs-detail difference.

### 7. The $11,000 HVAC replacement at Fremont Way was deducted as a repair

The owner statement lumps HVAC inside repairs, and the engine took the whole $13,300 as an expense. The invoice (D47) is for removing the failed furnace and condenser and installing a new heat pump system with air handler and line set, and Erik confirmed the whole system was replaced. That is an improvement (a restoration of the property), so it is capitalized and depreciated over 27.5 years: about $150.00 for 2025 (placed in service August 2025, mid-month).

**Kind:** engine error · **Evidence:** line:SchE.14A, line:SchE.18A, doc:D46#page1, doc:D47, call:call-01, qa:qa-37

**How the design surfaced it:** Rentals area: each Schedule E expense lists the source line items; D46 shows the HVAC line inside "Repairs". The depreciation list has no asset for it.

### 8. Payoff interest of $2,150 added on top of a 1098 that already includes it

The Lonestar Form 1098 box 1 ($13,900) says it includes interest paid at payoff on 11/20/2025, and the payoff statement says its interest "is reported on the 2025 Form 1098". The engine's rule adds interest from every 1098 and every lender statement, so $2,150 is deducted twice.

**Kind:** engine error · **Evidence:** line:SchA.8a, ev:ev-1029, ev:ev-1032, doc:D55, doc:D56

**How the design surfaced it:** Trace of SchA.8a lists four inputs; the payoff statement (D56) is one of them and its printed text says it is already on the 1098.

### 9. Real estate tax deducted includes $6,912 that belongs to the seller

The Travis County bill for all of 2025 was $13,420, paid from escrow in December. At closing on 07/08 the seller credited the buyers $6,912 for 01/01 to 07/07 (D54), because the seller owned the home then. The Okafor-Lindqvists' own share is $6,508. Because the SALT total sits above the $40,000 cap, the federal deduction only falls by $5,622; California has no cap, so it falls by the full $6,912.

**Kind:** engine error · **Evidence:** line:SchA.5b, doc:D54, doc:D58, ev:ev-1027, ev:ev-1038

**How the design surfaced it:** Closing statement and tax receipt side by side in the trace for SchA.5b; the property-tax area shows the proration check.

### 10. Subaru donation claimed at $6,000; the charity sold it for $2,900

The engine took the value from the client's questionnaire (Kelley Blue Book "about 6,000") and ignored the Form 1098-C. The 1098-C says the car was sold at arm's length on 09/09/2025 for $2,900 and no goods or services were provided. When the charity sells a car over $500 without a significant use, the deduction is capped at the gross sale proceeds. This is also one of the two items the IRS asks about in the 2028 Letter 566.

**Kind:** engine error · **Evidence:** line:F8283.A1.vehicle, doc:D66, ev:ev-1054, qa:qa-39, call:call-01, agency:/notices/1

**How the design surfaced it:** The line's sources list the questionnaire answer (qa-39) but not the 1098-C; the evidence drawer shows the 1098-C box 4c next to the claim.

### 11. Estimated payments $13,000 but the IRS shows $12,000

Three payments have confirmations (D67). For the fourth the engine used the client's answer, "paid January 14, 2026, 4,000 I think" (qa-41). The IRS account transcript pulled on 03/12 shows 3,000 on 2026-01-15. The transcript is third-party evidence; the client answer was a guess. Payments are overstated by $1,000, which understates the balance due by the same amount.

**Kind:** data conflict · **Evidence:** line:F1040.26, qa:qa-41, agency:/irs_account_transcript_2025/0, doc:D67, doc:D69

**How the design surfaced it:** Payments area: each payment has a verification stamp; the transcript is attached and compared to the questionnaire.

### 12. California estimated payments include $3,500 that FTB applied to tax year 2024

The engine's rule counts every FTB payment dated 04/01/2025 to 01/15/2026. The Web Pay confirmation (D68) and the FTB account both show the 2025-09-15 payment of $3,500 designated as tax year 2024, "held as a 2024 credit". On the return as filed it should not count toward 2025. The client can ask FTB to move it, which is a follow-up action, not a return number.

**Kind:** engine error · **Evidence:** line:F540NR.72, doc:D68, ev:ev-1076, ev:ev-1075, agency:/ftb_account

**How the design surfaced it:** Payments area lists each payment with its designated tax year from the source document.

### 13. $88,831 of Texas-period wages treated as California-source

For the part-year return the engine took California wages straight from W-2 box 16. Halvorsen's payroll kept California as the work state through 09/30 (a mistake the client mentions in qa-45), but Ngozi moved to Austin on 07/15. The paystub (D73) shows California taxable wages of $22,469 through 07/15. Wages for work done in Texas after the move are not California-source. California wages should be $107,100 (Corvane, all earned in California) + $22,469 = $129,569, not $218,400. The withholding credit (box 17) is unaffected.

**Kind:** engine error · **Evidence:** line:SchCA540NR.1.E, doc:D09, doc:D73, ev:ev-1081, qa:qa-45, household:ngozi

**How the design surfaced it:** Residency timeline beside the California area; the Halvorsen W-2 note and the paystub sit on the same trace.

### 14. Theo's SSN: organizer 666-74-3309, Social Security card 666-74-3390

The client typed 666-74-3309 in the organizer. The photographed card (D71) and the 2024 return (666-74-3390) both say 666-74-3390; two digits are swapped. This is exactly why the federal e-file was rejected on 07/13 (R0000-504-02: dependent's TIN and name must match). Nothing in the pipeline compared the organizer to the card, and the CTC for Theo depends on it.

**Kind:** data conflict · **Evidence:** household:theo, doc:D71, doc:D06#page1, msg:msg-10, agency:/efile/0

**How the design surfaced it:** Household record with a cross-check of every identifier against the documents; the e-file rejection is linked to the same finding.

### 15. Phone and internet deducted at 100%; client says 70% and 50% business

The engine took the books' telephone ($2,160) and internet ($1,320) in full. On the March 26 call Erik said the family mobile plan is about 70% business and the shared home internet about 50%. Allowed: $2,172, so $1,308 is personal.

**Kind:** engine error · **Evidence:** line:SchC.25, ev:ev-0101, ev:ev-0095, call:call-01, doc:D15#page2

**How the design surfaced it:** Client call notes are attached to the evidence for SchC.25, so the percentages sit next to the number.

### 16. Spotify Family ($216) is in business software but is personal

The transaction detail (D15) lists it inside Software and subscriptions, and Erik confirmed on the call that it was booked by mistake. The engine took the account total as is.

**Kind:** engine error · **Evidence:** line:SchC.27a.1, doc:D15#page1, call:call-01

**How the design surfaced it:** Books-to-tax view lists the account detail under each P&L line.

### 17. Swedish interest converted at the 2024 average rate (10.56) instead of 2025 (9.86)

SEK 18,450 at 9.86 is $1,871; the engine used 10.56 and got $1,747. Small, but it is the kind of silent default a reviewer would never see without opening the line's inputs.

**Kind:** engine error · **Evidence:** line:SchB.1.6, ev:ev-0960, ref:param.fx

**How the design surfaced it:** Trace drawer lists the exchange rate as a named input (ref:fx.SEK.2024_average), so the wrong year is visible.

### 18. Little Sprouts Learning Center: tax ID read as 74-3829516, printed as 74-3829156 (confidence 0.97)

Two digits are swapped. The pipeline was confident (0.97), so nothing flagged it. The wrong number flows to F2441.1b (care provider on Form 2441). The credit is zero this year because of the employer's dependent-care benefits, but a wrong provider EIN invites a notice and fails due diligence.

**Kind:** extraction error · **Evidence:** ev:ev-1045, doc:D62#page1, line:F2441.1b

**How the design surfaced it:** Every extracted value is checked against the printed page text, independent of its confidence score.

### 19. Handwritten donation receipt - St. Brigid Parish: amount read at confidence 0.41

The receipt's first digit is ambiguous in print: it could be 1,500 or 7,500. The pipeline picked 1,500 at 0.41. On 07/01 the client wrote that the parish confirmed 1,500 by phone and the bank statement matches (check #2207, 12/21/2025) (msg-08). That settles it, but only if the bank statement is kept: the parish's word and the client's message are not third-party records.

**Kind:** extraction error · **Evidence:** ev:ev-1049, doc:D64, msg:msg-08, line:SchA.11

**How the design surfaced it:** Confidence is shown on every extracted value, and anything under 0.8 opens a verification task.

### 20. Client said no investments were sold; the documents show hundreds of sales

qa-14 answers "No". The brokerage statements show 283 stock and fund sales (Northlake, Meridian, Brightpath) and the Coinhaven 1099-DA shows 12 digital asset sales. The documents win, but the answer matters for completeness: if the client thinks the direct-indexing account is "not selling", something else may also be missing from their mental list.

**Kind:** data conflict · **Evidence:** qa:qa-14, qa:qa-15, doc:D28, doc:D31, doc:D74, doc:D34

**How the design surfaced it:** The questionnaire is shown beside the area it relates to, and the engine's own conflict diagnostic is linked to the finding that supersedes it.

### 21. Landlord insurance of $1,850 rests on the questionnaire alone

The only support for SchE.9A is the client's answer (qa-36: "paid directly to the insurer"). There is no invoice or policy statement in the file. It is plausible (last year was 1,800) but unverified.

**Kind:** data conflict · **Evidence:** line:SchE.9A, qa:qa-36, py:/return_2024/lines/SchE.9A

**How the design surfaced it:** Verification stamps: a number whose only source is a client answer shows "confirmed with client" and nothing stronger.

### 22. D13 "Form 3922 - ESPP transfer (Corvane)" was used, but nothing in it reached the return

The engine lists D13 as an input of v3, yet no return line reads any of its 6 extracted values. Either the document truly needs no action, or the engine ignored something it said. Open the document, look at each value, and record what you concluded.

**Kind:** tie out · **Evidence:** doc:D13

**How the design surfaced it:** Document index shows, for each document, the exact lines it fed. An empty "landed on" cell next to "used" is the signal.

### 23. D15 "Lindqvist Studio - transaction detail for selected accounts" was used, but nothing in it reached the return

The engine lists D15 as an input of v3, yet no return line reads any of its 6 extracted values. Either the document truly needs no action, or the engine ignored something it said. Open the document, look at each value, and record what you concluded.

**Kind:** tie out · **Evidence:** doc:D15

**How the design surfaced it:** Document index shows, for each document, the exact lines it fed. An empty "landed on" cell next to "used" is the signal.

### 24. D47 "Invoice - Delta Breeze Heating & Air (1450 Fremont Way)" was used, but nothing in it reached the return

The engine lists D47 as an input of v3, yet no return line reads any of its 2 extracted values. Either the document truly needs no action, or the engine ignored something it said. Open the document, look at each value, and record what you concluded.

**Kind:** tie out · **Evidence:** doc:D47

**How the design surfaced it:** Document index shows, for each document, the exact lines it fed. An empty "landed on" cell next to "used" is the signal.

### 25. D54 "Buyer closing statement - 7709 Barton Ridge Dr (purchase 07/08/2025)" was used, but nothing in it reached the return

The engine lists D54 as an input of v3, yet no return line reads any of its 4 extracted values. Either the document truly needs no action, or the engine ignored something it said. Open the document, look at each value, and record what you concluded.

**Kind:** tie out · **Evidence:** doc:D54

**How the design surfaced it:** Document index shows, for each document, the exact lines it fed. An empty "landed on" cell next to "used" is the signal.

### 26. D73 "Halvorsen Data paystub - pay date 07/18/2025 (Ngozi Okafor)" was used, but nothing in it reached the return

The engine lists D73 as an input of v3, yet no return line reads any of its 2 extracted values. Either the document truly needs no action, or the engine ignored something it said. Open the document, look at each value, and record what you concluded.

**Kind:** tie out · **Evidence:** doc:D73

**How the design surfaced it:** Document index shows, for each document, the exact lines it fed. An empty "landed on" cell next to "used" is the signal.

## Judgment calls the engine made silently

- **Erik's $14,400 health insurance deduction may not be allowed.** The client says both of Ngozi's employers offer family coverage and Erik chose his own plan (qa-25). The self-employed health insurance deduction is not allowed for months in which the taxpayer could have joined a plan subsidized by a spouse's employer.
- **Woodworks distributions exceed stock basis: $21,215 taxed as capital gain.** Rolling basis forward: 2022 $21,300 (a client worksheet, never verified) + 2023 income $14,100 - distributions $20,000 + 2024 income $16,900 - distributions $30,000 = $2,300, which agrees to the engine's opening basis of $2,300. In 2025 income of $18,485 is added and $42,000 is distributed, so $21,215 is gain.
- **Form 8867 (paid preparer due diligence) not completed.** The child tax credit and credit for other dependents are claimed (CTC 2,200 for Theo; ODC 500 for Ada, phased down to $400 by income). The firm's own rules require due diligence to be documented for these, and the engine says only the preparer can complete the checklist.
- **California AMT is not computed by the engine.** The ISO exercise on 07/30/2025 (1,000 shares, spread $40,000) triggers federal AMT of $3,871. California has its own AMT (Schedule P 540NR) and the exercise happened after the move to Texas.
- **SEP contribution of $18,000 exceeds the deductible limit by $2,786.** The client deposited $18,000 on 04/10/2026 (D26) for 2025. The limit is 20% of net profit less half of self-employment tax, $15,214 on the engine's numbers.
- **Election: 100% special depreciation vs section 179 vs regular MACRS on the $38,000 equipment.** The engine defaulted to 100% special depreciation for the March purchases. Its alternatives: section 179 leaves federal tax unchanged but changes California by −$1,050 (California allows 179 up to 25,000 but not bonus); electing out of bonus into 5-year MACRS raises federal tax by $10,245 and lowers California by $260.

## Outside the engagement, but the client has to hear it

- **Forms 1099-NEC for two contractors were never filed.** Mara Quintero (retoucher) $4,800 and Dev Patel (web developer) $2,600 were each paid more than $600 by ACH.
- **FinCEN 114 (FBAR) for the Swedish account is due separately.** The Sparbanken account peaked at SEK 1,452,300 (about $149,567), well above the $10,000 FBAR threshold.
- **Form 3520 for the 2023 foreign inheritance was never resolved.** The prior preparer's open items end with "2023 Form 3520 (foreign inheritance over 100,000) - discussed? (no note of resolution)".
- **Ada files her own return and must be claimed as a dependent here, not there.** Ada (19, full-time student) prepares her own return with consumer software.
- **Lindqvist Family Woodworks, Inc.: composite return filed by someone else.** 2025 Form 1120-S and Oregon composite return, prepared by Willamette CPA Group (not this firm).
- **Ridgeline Real Estate Fund III LP: composite return filed by someone else.** 2025 Form 1065 and Arizona composite return, prepared by fund administrator.
