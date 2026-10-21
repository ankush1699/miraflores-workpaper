# Core idea and data model

## The idea

A workpaper exists to answer four questions about a return: **where did each number come from, what was done to it, who checked it, and what is still open?** A spreadsheet answers them badly because it stores *values*. This workpaper stores *what happened*.

1. **Every number is a node with its evidence attached.** A figure points to the lines it was built from, to the exact field on the exact document page it was read from, to the way it was verified, and to every note, question, adjustment and decision recorded against it. Click any number and you get all of that in one drawer.
2. **The engine's numbers are never overwritten.** A change is an *adjustment* that sits on top: who, why, the authority relied on, and the estimated tax effect (the change times the engine's own per-dollar rate, since the engine cannot be re-run). The original is always one click away.
3. **Everything that happens is an event, and state is the replay of events.** That one decision gives history, "what changed since I last looked", comparison of any two moments, undo of any action (including bulk ones), and a frozen copy at filing, without separate features for each.
4. **A signature covers what the signer saw.** Sign-offs and the client's e-signature store the set of approved adjustments they covered. If the set changes, they reopen and say what changed.
5. **The workpaper does not trust the engine, so it checks.** Independent checks recompute from the printed documents. They found things the engine's own diagnostics did not (see `docs/ERRORS.md`). Each check shows what it looked at, even when it found nothing.

## Data model

```
Packet (read-only, as delivered)
  documents ── pages ── printed_content
  extracted_values  (document, page, field, value, confidence)
  return_versions   (v1, v2, v3 → lines → inputs, sources, rule)
  client, prior_years, agency records, firm, timeline

Reference   a short address for anything evidence can point at
            line:SchC.1 · ev:ev-0103 · doc:D15#page3 · qa:qa-14 · msg:msg-07
            py:/return_2024/lines/F1040.11 · agency:/efile/0 · household:theo
            (a real scanned document would be addressed the same way)

Event       { id, at, actor, type, data, group }    ← the only thing saved
  adjust.propose / adjust.decide / adjust.revert
  verify.add · attach.add · link.add
  thread.open / reply / status          (review notes, client questions)
  signoff.add · step.attest · judgment.add · finding.decide
  filing.extension / approve / submission / freeze / payment / notice / rollforward
  standards.set · assign.set · time.log · sensitive.view · seen.mark · undo

State       reduce(events) →
  Adjustment  { target, lineDelta | textFix, effects[], effect, reason, authority, status, amendment? }
  Thread      { target, kind: review | question | internal, blocking, status, messages }
  Signoff     { level, by, adjustmentIds[] }          ← reopens if the set changes
  Judgment    { kind, topic, decision, authority }
  Verification, Attachment, Link, FindingDecision, VarianceNote, ...
  FilingState { extension, clientApproval, submissions[], frozen, payments, notice, rollForward }

Finding     produced by an independent check, not stored:
            { evidence refs, estimated effect, proposed fix (draft adjustments), how it was surfaced }
```

## Decisions and trade-offs

- **Browser-only, event-sourced.** No server or accounts, so a reviewer can open a link and use it; everything persists in the browser and two tabs see each other live. The trade-off is that roles are enforced in the client, not on a backend. Persistence is one small file (`store/db.ts`), so a server is a swap, not a rewrite.
- **Estimates, not recomputation.** The engine can't be re-run, so tax effects are labelled estimates at the v3 numbers and never presented as the return.
- **Findings are code, not data.** Each check is a small, tested function over the packet. They are specific to this household where they have to be, but they work from document text and extracted values, not from hard-coded answers.
- **Rules are enforced when a thing is saved, not only hidden in menus.** Self-review, the partner threshold, clearance, who is active on the engagement, and what a client can do are all checked in `store/rules.ts`, and the firm administrator can change the standards they read.
