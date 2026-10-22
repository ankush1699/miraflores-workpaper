# The mistakes we found

The tax software calculated the Okafor-Lindqvist family’s 2025 return. The workpaper did not trust it: its own checks re-read every document and recalculated. The tax software’s own 11 warnings caught **none** of the mistakes below.

**What it means for the family**

| | Tax software said | After fixing the clear mistakes |
|---|---|---|
| Federal | family owes $4,220 | family gets $8,997 back |
| California | family gets $8,256 back | family gets $11,261 back |

Amounts are estimates using the tax software’s own tax rates, because the software itself can’t be re-run. “Saves” means the family owes less once the mistake is fixed; “adds” means they owe more.

## Mistakes that change the tax (16)

| # | What was wrong | Federal | California |
|---|---|---|---|
| 1 | Erik’s business income counted $12,400 twice (card payments) | saves $4,402 | saves $384 |
| 2 | Mileage log page 3 is a second scan of another page (3,700 miles counted twice) | adds $919 | adds $80 |
| 3 | Company-share sales taxed as if the shares cost $0 ($47,620 taxed twice) | saves $15,536 | saves $1,618 |
| 4 | The same $1,840 of bank interest is counted twice | saves $640 | saves $127 |
| 5 | One Bitcoin sale taxed as if it cost $0 | saves $1,312 | saves $104 |
| 6 | A page of a broker statement was never read, so one sale is missing | saves $21 | saves $2 |
| 7 | A $11,000 heating system at the rental was deducted all at once instead of over 27.5 years | adds $3,364 | adds $694 |
| 8 | Mortgage interest of $2,150 counted twice | adds $559 | adds $103 |
| 9 | Property tax deduction includes $6,912 that belongs to the home’s seller | adds $1,462 | adds $332 |
| 10 | Donated car claimed at $6,000, but the charity sold it for $2,900 | adds $806 | adds $149 |
| 11 | Tax payments made during the year: $13,000 on the return, but the IRS shows $12,000 | adds $1,000 | no change |
| 12 | A $3,500 California payment was applied to last year, not this year | no change | adds $3,500 |
| 13 | $88,831 of pay earned after moving to Texas was taxed by California | no change | saves $5,685 |
| 14 | Family phone and internet deducted in full; the client says only part is business | adds $464 | adds $41 |
| 15 | A personal Spotify subscription ($216) was booked as a business expense | adds $77 | adds $7 |
| 16 | Swedish bank interest converted at last year’s exchange rate | adds $43 | adds $9 |

## Other mistakes and things that needed checking (10)

- **Theo’s Social Security number was mistyped by the client** (Sources disagree)
- **Little Sprouts Learning Center’s tax ID misread: two digits swapped** (Document read wrongly)
- **A handwritten donation receipt was hard to read ($1,500 or $7,500?)** (Document read wrongly)
- **Client said no investments were sold; the documents show hundreds of sales** (Sources disagree)
- **Landlord insurance of $1,850 rests on the questionnaire alone** (Sources disagree)
- **D13 "Form 3922 - ESPP transfer (Corvane)" was used, but nothing in it reached the return** (Numbers don't add up)
- **D15 "Lindqvist Studio - transaction detail for selected accounts" was used, but nothing in it reached the return** (Numbers don't add up)
- **D47 "Invoice - Delta Breeze Heating & Air (1450 Fremont Way)" was used, but nothing in it reached the return** (Numbers don't add up)
- **D54 "Buyer closing statement - 7709 Barton Ridge Dr (purchase 07/08/2025)" was used, but nothing in it reached the return** (Numbers don't add up)
- **D73 "Halvorsen Data paystub - pay date 07/18/2025 (Ngozi Okafor)" was used, but nothing in it reached the return** (Numbers don't add up)

## Each one explained

### 1. Erik’s business income counted $12,400 twice (card payments)

The tax software added the $12,400 Paywell 1099-K to the books' $151,300 of revenue because it could not match the card payments to a deposit. The books already include them: Atlas paid $41,200 in total, and $12,400 of that came through Paywell (D15 p3). The books tie exactly to the five 1099-NECs ($142,000) plus $9,300 from small clients with no 1099 = $151,300. Gross receipts should be $151,300, not $163,700.

**Type:** Tax software mistake

**How the app found it:** Reconciliation panel on Business: books vs 1099-NEC vs 1099-K; trace of SchC.1 shows the 1099-K as a separate input.

**Where to look in the app:** line:SchC.1, ev:ev-0103, ev:ev-0127, doc:D15#page3, doc:D17, doc:D21

### 2. Mileage log page 3 is a second scan of another page (3,700 miles counted twice)

Page 3 is labelled "second scan of the May-Aug sheet", and its trips match the earlier page line for line. The tax software adds every page total, so business miles came out 11,800 instead of 8,100. At 0.7 per mile that overstates the car deduction by $2,590.

**Type:** Document read wrongly

**How the app found it:** Document viewer shows the page text next to its extracted total; the duplicate-page comparison flags it before the number is trusted.

**Where to look in the app:** line:SchC.44a, line:SchC.9, doc:D23#page3, doc:D23#page2, msg:msg-03

### 3. Company-share sales taxed as if the shares cost $0 ($47,620 taxed twice)

Northlake reported the three RSU lots as noncovered with no cost basis. The Corvane supplemental statement (D11) gives the adjusted basis (RSU-2502 $19,100, RSU-2505 $19,100, RSU-2308 $9,420). The tax software's rule says it uses the supplemental statement when it matches the lot, but none was matched, so Schedule D treats the full proceeds as gain, on top of the RSU income already in W-2 box 1. That taxes the same income twice.

**Type:** Tax software mistake

**How the app found it:** Documents → "where it landed": D11 shows no lines reading it. The 8949 lot trace shows a basis of 0.00 with no supplemental source.

**Where to look in the app:** line:F8949.B.N1, line:F8949.B.N3, line:F8949.E.N4, doc:D11#page2, doc:D28#page3, ev:ev-0066, ev:ev-0068, ev:ev-0070

### 4. The same $1,840 of bank interest is counted twice

The Northlake Securities composite (D28, account ending 7731) already includes a 1099-INT line from Northlake Bank for the sweep program. The stand-alone Northlake Bank 1099-INT (D29) is the same form for the same account and amount. Each was read as its own payer (SchB.1.1 and SchB.1.2), so interest is overstated by $1,840. Net investment income tax is overstated too.

**Type:** Tax software mistake

**How the app found it:** Documents → "where it landed" lists both documents feeding Schedule B at the same amount; the interest-payer tie-out matches account endings.

**Where to look in the app:** line:SchB.1.1, line:SchB.1.2, doc:D28#page1, doc:D29, ev:ev-0492, ev:ev-0538

### 5. One Bitcoin sale taxed as if it cost $0

Coinhaven had no basis for the 0.05 BTC because it was transferred in from another exchange. The tax software used 0 and the transfer-in date, so the $5,325 sale was taxed as a short-term gain. Erik says (msg-07) he bought it in March 2021 for about $3,050, which makes it long-term with a gain of $2,275. Support so far is the client's recollection plus a bank line to "CryptoNorth" on 03/15/2021. Get the bank statement before relying on it.

**Type:** Tax software mistake

**How the app found it:** Open question thread on the lot: the client message becomes evidence on the number, with a confidence of 0.60 on the original read.

**Where to look in the app:** line:F8949.H.C6, ev:ev-0918, ev:ev-0919, msg:msg-07, doc:D35, doc:D34

### 6. A page of a broker statement was never read, so one sale is missing

The corrected Meridian 1099 (D31) has a supplemental page 32 with a fractional-share sale (Ironwood REIT, proceeds $250, basis $310). The pipeline skipped it (Page 32 ('Additional transactions') was not read by the pipeline.). The 1099-B summary says 71,965.00 but the lots add to 71,715.00, a difference of exactly $250. Small loss (−$60), but a completeness gap: the same gap could hide something larger on another statement.

**Type:** Document read wrongly

**How the app found it:** Document index shows extraction status "partial" with the reason; sales detail shows the summary-vs-detail difference.

**Where to look in the app:** doc:D31#page32, ev:ev-0703, doc:D30

### 7. A $11,000 heating system at the rental was deducted all at once instead of over 27.5 years

The owner statement lumps HVAC inside repairs, and the tax software took the whole $13,300 as an expense. The invoice (D47) is for removing the failed furnace and condenser and installing a new heat pump system with air handler and line set, and Erik confirmed the whole system was replaced. That is an improvement (a restoration of the property), so it is capitalized and depreciated over 27.5 years: about $150.00 for 2025 (placed in service August 2025, mid-month).

**Type:** Tax software mistake

**How the app found it:** Rentals area: each Schedule E expense lists the source line items; D46 shows the HVAC line inside "Repairs". The depreciation list has no asset for it.

**Where to look in the app:** line:SchE.14A, line:SchE.18A, doc:D46#page1, doc:D47, call:call-01, qa:qa-37

### 8. Mortgage interest of $2,150 counted twice

The Lonestar Form 1098 box 1 ($13,900) says it includes interest paid at payoff on 11/20/2025, and the payoff statement says its interest "is reported on the 2025 Form 1098". The tax software's rule adds interest from every 1098 and every lender statement, so $2,150 is deducted twice.

**Type:** Tax software mistake

**How the app found it:** Trace of SchA.8a lists four inputs; the payoff statement (D56) is one of them and its printed text says it is already on the 1098.

**Where to look in the app:** line:SchA.8a, ev:ev-1029, ev:ev-1032, doc:D55, doc:D56

### 9. Property tax deduction includes $6,912 that belongs to the home’s seller

The Travis County bill for all of 2025 was $13,420, paid from escrow in December. At closing on 07/08 the seller credited the buyers $6,912 for 01/01 to 07/07 (D54), because the seller owned the home then. The Okafor-Lindqvists' own share is $6,508. Because the SALT total sits above the $40,000 cap, the federal deduction only falls by $5,622; California has no cap, so it falls by the full $6,912.

**Type:** Tax software mistake

**How the app found it:** Closing statement and tax receipt side by side in the trace for SchA.5b; the property-tax area shows the proration check.

**Where to look in the app:** line:SchA.5b, doc:D54, doc:D58, ev:ev-1027, ev:ev-1038

### 10. Donated car claimed at $6,000, but the charity sold it for $2,900

The tax software took the value from the client's questionnaire (Kelley Blue Book "about 6,000") and ignored the Form 1098-C. The 1098-C says the car was sold at arm's length on 09/09/2025 for $2,900 and no goods or services were provided. When the charity sells a car over $500 without a significant use, the deduction is capped at the gross sale proceeds. This is also one of the two items the IRS asks about in the 2028 Letter 566.

**Type:** Tax software mistake

**How the app found it:** The line's sources list the questionnaire answer (qa-39) but not the 1098-C; the evidence drawer shows the 1098-C box 4c next to the claim.

**Where to look in the app:** line:F8283.A1.vehicle, doc:D66, ev:ev-1054, qa:qa-39, call:call-01, agency:/notices/1

### 11. Tax payments made during the year: $13,000 on the return, but the IRS shows $12,000

Three payments have confirmations (D67). For the fourth the tax software used the client's answer, "paid January 14, 2026, 4,000 I think" (qa-41). The IRS account transcript pulled on 03/12 shows 3,000 on 2026-01-15. The transcript is third-party evidence; the client answer was a guess. Payments are overstated by $1,000, which understates the balance due by the same amount.

**Type:** Sources disagree

**How the app found it:** Payments area: each payment has a verification stamp; the transcript is attached and compared to the questionnaire.

**Where to look in the app:** line:F1040.26, qa:qa-41, agency:/irs_account_transcript_2025/0, doc:D67, doc:D69

### 12. A $3,500 California payment was applied to last year, not this year

The tax software's rule counts every FTB payment dated 04/01/2025 to 01/15/2026. The Web Pay confirmation (D68) and the FTB account both show the 2025-09-15 payment of $3,500 designated as tax year 2024, "held as a 2024 credit". On the return as filed it should not count toward 2025. The client can ask FTB to move it, which is a follow-up action, not a return number.

**Type:** Tax software mistake

**How the app found it:** Payments area lists each payment with its designated tax year from the source document.

**Where to look in the app:** line:F540NR.72, doc:D68, ev:ev-1076, ev:ev-1075, agency:/ftb_account

### 13. $88,831 of pay earned after moving to Texas was taxed by California

For the part-year return the tax software took California wages straight from W-2 box 16. Halvorsen's payroll kept California as the work state through 09/30 (a mistake the client mentions in qa-45), but Ngozi moved to Austin on 07/15. The paystub (D73) shows California taxable wages of $22,469 through 07/15. Wages for work done in Texas after the move are not California-source. California wages should be $107,100 (Corvane, all earned in California) + $22,469 = $129,569, not $218,400. The withholding credit (box 17) is unaffected.

**Type:** Tax software mistake

**How the app found it:** Residency timeline beside the California area; the Halvorsen W-2 note and the paystub sit on the same trace.

**Where to look in the app:** line:SchCA540NR.1.E, doc:D09, doc:D73, ev:ev-1081, qa:qa-45, household:ngozi

### 14. Family phone and internet deducted in full; the client says only part is business

The tax software took the books' telephone ($2,160) and internet ($1,320) in full. On the March 26 call Erik said the family mobile plan is about 70% business and the shared home internet about 50%. Allowed: $2,172, so $1,308 is personal.

**Type:** Tax software mistake

**How the app found it:** Client call notes are attached to the evidence for SchC.25, so the percentages sit next to the number.

**Where to look in the app:** line:SchC.25, ev:ev-0101, ev:ev-0095, call:call-01, doc:D15#page2

### 15. A personal Spotify subscription ($216) was booked as a business expense

The transaction detail (D15) lists it inside Software and subscriptions, and Erik confirmed on the call that it was booked by mistake. The tax software took the account total as is.

**Type:** Tax software mistake

**How the app found it:** Books-to-tax view lists the account detail under each P&L line.

**Where to look in the app:** line:SchC.27a.1, doc:D15#page1, call:call-01

### 16. Swedish bank interest converted at last year’s exchange rate

SEK 18,450 at 9.86 is $1,871; the tax software used 10.56 and got $1,747. Small, but it is the kind of silent default a reviewer would never see without opening the line's inputs.

**Type:** Tax software mistake

**How the app found it:** Trace drawer lists the exchange rate as a named input (ref:fx.SEK.2024_average), so the wrong year is visible.

**Where to look in the app:** line:SchB.1.6, ev:ev-0960, ref:param.fx

### 17. Theo’s Social Security number was mistyped by the client

The client typed 666-74-3309 in the organizer. The photographed card (D71) and the 2024 return (666-74-3390) both say 666-74-3390; two digits are swapped. This is exactly why the federal e-file was rejected on 07/13 (R0000-504-02: dependent's TIN and name must match). Nothing in the pipeline compared the organizer to the card, and the CTC for Theo depends on it.

**Type:** Sources disagree

**How the app found it:** Household record with a cross-check of every identifier against the documents; the e-file rejection is linked to the same finding.

**Where to look in the app:** household:theo, doc:D71, doc:D06#page1, msg:msg-10, agency:/efile/0

### 18. Little Sprouts Learning Center’s tax ID misread: two digits swapped

Two digits are swapped. The pipeline was confident (0.97), so nothing flagged it. The wrong number flows to F2441.1b (care provider on Form 2441). The credit is zero this year because of the employer's dependent-care benefits, but a wrong provider EIN invites a notice and fails due diligence.

**Type:** Document read wrongly

**How the app found it:** Every extracted value is checked against the printed page text, independent of its confidence score.

**Where to look in the app:** ev:ev-1045, doc:D62#page1, line:F2441.1b

### 19. A handwritten donation receipt was hard to read ($1,500 or $7,500?)

The receipt's first digit is ambiguous in print: it could be 1,500 or 7,500. The pipeline picked 1,500 at 0.41. On 07/01 the client wrote that the parish confirmed 1,500 by phone and the bank statement matches (check #2207, 12/21/2025) (msg-08). That settles it, but only if the bank statement is kept: the parish's word and the client's message are not third-party records.

**Type:** Document read wrongly

**How the app found it:** Confidence is shown on every extracted value, and anything under 0.8 opens a verification task.

**Where to look in the app:** ev:ev-1049, doc:D64, msg:msg-08, line:SchA.11

### 20. Client said no investments were sold; the documents show hundreds of sales

qa-14 answers "No". The brokerage statements show 283 stock and fund sales (Northlake, Meridian, Brightpath) and the Coinhaven 1099-DA shows 12 digital asset sales. The documents win, but the answer matters for completeness: if the client thinks the direct-indexing account is "not selling", something else may also be missing from their mental list.

**Type:** Sources disagree

**How the app found it:** The questionnaire is shown beside the area it relates to, and the tax software's own conflict diagnostic is linked to the finding that supersedes it.

**Where to look in the app:** qa:qa-14, qa:qa-15, doc:D28, doc:D31, doc:D74, doc:D34

### 21. Landlord insurance of $1,850 rests on the questionnaire alone

The only support for SchE.9A is the client's answer (qa-36: "paid directly to the insurer"). There is no invoice or policy statement in the file. It is plausible (last year was 1,800) but unverified.

**Type:** Sources disagree

**How the app found it:** Verification stamps: a number whose only source is a client answer shows "confirmed with client" and nothing stronger.

**Where to look in the app:** line:SchE.9A, qa:qa-36, py:/return_2024/lines/SchE.9A

### 22. D13 "Form 3922 - ESPP transfer (Corvane)" was used, but nothing in it reached the return

The tax software lists D13 as an input of v3, yet no return line reads any of its 6 extracted values. Either the document truly needs no action, or the tax software ignored something it said. Open the document, look at each value, and record what you concluded.

**Type:** Numbers don't add up

**How the app found it:** Document index shows, for each document, the exact lines it fed. An empty "landed on" cell next to "used" is the signal.

**Where to look in the app:** doc:D13

### 23. D15 "Lindqvist Studio - transaction detail for selected accounts" was used, but nothing in it reached the return

The tax software lists D15 as an input of v3, yet no return line reads any of its 6 extracted values. Either the document truly needs no action, or the tax software ignored something it said. Open the document, look at each value, and record what you concluded.

**Type:** Numbers don't add up

**How the app found it:** Document index shows, for each document, the exact lines it fed. An empty "landed on" cell next to "used" is the signal.

**Where to look in the app:** doc:D15

### 24. D47 "Invoice - Delta Breeze Heating & Air (1450 Fremont Way)" was used, but nothing in it reached the return

The tax software lists D47 as an input of v3, yet no return line reads any of its 2 extracted values. Either the document truly needs no action, or the tax software ignored something it said. Open the document, look at each value, and record what you concluded.

**Type:** Numbers don't add up

**How the app found it:** Document index shows, for each document, the exact lines it fed. An empty "landed on" cell next to "used" is the signal.

**Where to look in the app:** doc:D47

### 25. D54 "Buyer closing statement - 7709 Barton Ridge Dr (purchase 07/08/2025)" was used, but nothing in it reached the return

The tax software lists D54 as an input of v3, yet no return line reads any of its 4 extracted values. Either the document truly needs no action, or the tax software ignored something it said. Open the document, look at each value, and record what you concluded.

**Type:** Numbers don't add up

**How the app found it:** Document index shows, for each document, the exact lines it fed. An empty "landed on" cell next to "used" is the signal.

**Where to look in the app:** doc:D54

### 26. D73 "Halvorsen Data paystub - pay date 07/18/2025 (Ngozi Okafor)" was used, but nothing in it reached the return

The tax software lists D73 as an input of v3, yet no return line reads any of its 2 extracted values. Either the document truly needs no action, or the tax software ignored something it said. Open the document, look at each value, and record what you concluded.

**Type:** Numbers don't add up

**How the app found it:** Document index shows, for each document, the exact lines it fed. An empty "landed on" cell next to "used" is the signal.

**Where to look in the app:** doc:D73

## Decisions the software made without asking anyone

These are not clear mistakes. A person has to decide, and the app records the decision and the rule it relied on.

- **Erik’s $14,400 health insurance deduction may not be allowed.** The client says both of Ngozi's employers offer family coverage and Erik chose his own plan (qa-25). The self-employed health insurance deduction is not allowed for months in which the taxpayer could have joined a plan subsidized by a spouse's employer.
- **Woodworks distributions exceed stock basis: $21,215 taxed as capital gain.** Rolling basis forward: 2022 $21,300 (a client worksheet, never verified) + 2023 income $14,100 - distributions $20,000 + 2024 income $16,900 - distributions $30,000 = $2,300, which agrees to the tax software's opening basis of $2,300. In 2025 income of $18,485 is added and $42,000 is distributed, so $21,215 is gain.
- **Form 8867 (paid preparer due diligence) not completed.** The child tax credit and credit for other dependents are claimed (CTC 2,200 for Theo; ODC 500 for Ada, phased down to $400 by income). The firm's own rules require due diligence to be documented for these, and the tax software says only the preparer can complete the checklist.
- **California AMT is not computed by the tax software.** The ISO exercise on 07/30/2025 (1,000 shares, spread $40,000) triggers federal AMT of $3,871. California has its own AMT (Schedule P 540NR) and the exercise happened after the move to Texas.
- **SEP contribution of $18,000 exceeds the deductible limit by $2,786.** The client deposited $18,000 on 04/10/2026 (D26) for 2025. The limit is 20% of net profit less half of self-employment tax, $15,214 on the tax software's numbers.
- **Election: 100% special depreciation vs section 179 vs regular MACRS on the $38,000 equipment.** The tax software defaulted to 100% special depreciation for the March purchases. Its alternatives: section 179 leaves federal tax unchanged but changes California by −$1,050 (California allows 179 up to 25,000 but not bonus); electing out of bonus into 5-year MACRS raises federal tax by $10,245 and lowers California by $260.

## Not part of this return, but the client must be told

- **Forms 1099-NEC for two contractors were never filed.** Mara Quintero (retoucher) $4,800 and Dev Patel (web developer) $2,600 were each paid more than $600 by ACH.
- **FinCEN 114 (FBAR) for the Swedish account is due separately.** The Sparbanken account peaked at SEK 1,452,300 (about $149,567), well above the $10,000 FBAR threshold.
- **Form 3520 for the 2023 foreign inheritance was never resolved.** The prior preparer's open items end with "2023 Form 3520 (foreign inheritance over 100,000) - discussed? (no note of resolution)".
- **Ada files her own return and must be claimed as a dependent here, not there.** Ada (19, full-time student) prepares her own return with consumer software.
- **Lindqvist Family Woodworks, Inc.: composite return filed by someone else.** 2025 Form 1120-S and Oregon composite return, prepared by Willamette CPA Group (not this firm).
- **Ridgeline Real Estate Fund III LP: composite return filed by someone else.** 2025 Form 1065 and Arizona composite return, prepared by fund administrator.
