# Miraflores Workpaper

A web-native tax workpaper for one household's 2025 return (Okafor-Lindqvist), built for the MiraFlores AI "Redesign the Tax Workpaper" case study. It loads the pipeline packet as delivered, saves everything in the browser, and has a role switcher.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # the independent checks and the business rules, against the real packet
npm run build      # static site in dist/, deploy anywhere (Vercel, Netlify, GitHub Pages)
```

Nothing needs a server. The packet is `public/packet.json`; the app fetches it on load.

## Try it in two minutes

1. Open **Issues**. Every red card is something the engine got wrong that the workpaper found itself.
2. Click **Select all with a fix**, then **Propose fixes**. It is one action, so **Undo** (top bar) takes all of it back.
3. Switch **Viewing as** to **Daniel Ortiz (reviewer)** and open **Changes**. Approve small ones. The big ones say a partner has to approve them. Switch to **Helen Strand** and approve those.
4. Open **Notes & people** and sign as reviewer, then partner. Now approve one more adjustment and watch the sign-off **reopen**.
5. Click any number (try `Schedule C gross receipts` under **The return → Business**) to see its source document with the exact field highlighted, how it was built, and everything recorded about it.
6. **Filing & after → Replay the season** plays the scripted events through the real rules: the client cannot approve until review is done; the federal e-file is rejected if Theo's SSN is still wrong (in the real file it was), and accepted first time once the workpaper's fix is approved; then the return freezes, later changes become amendments, and the IRS notice arrives with the response already assembled.
7. Open two browser tabs, pick different people in each: you will see each other working (presence) and each other's changes live.

## What is in it

| Area | Where |
|---|---|
| Trace any number to its source, with the field highlighted on a simulated document; record how it was verified; link items; attach files, messages, notes | click any figure; **Documents** |
| Show how a number was built; reconcile figures that should agree; books to taxable income; state split | evidence drawer → *How it was built*; each **area** page; **CPA schedules** |
| Adjust without losing the original; see what changed since you last looked; compare versions; what-ifs; bulk actions with undo | **Changes**, **Issues**, top-bar Undo |
| Flag swings from last year; judgment and election log with authority; proof of completeness | **CPA schedules → Return summary**, **Filing → Judgments**, **Documents**, area "considered" records |
| Client questions that become evidence; review notes that block filing; sign-offs that reopen; enforced roles; assignments; client approval and e-sign | **Notes & people**, **Filing**, **Client** (view as Ngozi or Erik) |
| Extension, filing, e-file rejection, client's copy, freeze at filing, amend on top, answer a notice, carry forward | **Filing & after** |
| Firm standards, masked sensitive data with a view log, time against budget, search | **Firm & standards**, `⌘K` |
| The records a CPA expects (16 of them) | **CPA schedules** |

## How it works, briefly

- `src/packet/` reads the packet and builds indexes (document → lines it fed, line → what reads it).
- `src/checks/` are the **independent checks**. They recompute from the printed documents and never read the engine's own diagnostics. `npm test` runs them against the real packet.
- `src/store/` is an **event log**. The only thing saved is who did what, when, and why. State is rebuilt by replaying events, which is what gives history, time travel, undo and the frozen copy at filing. `rules.ts` is where roles and the firm's standards are enforced.
- `src/domain/` is the logic (tax effect estimates, sign-off validity, required steps, filing simulation).
- `src/pages/` and `src/ui/` are the screens.

See `docs/ONE_PAGER.md` for the core idea and data model and `docs/ERRORS.md` for the errors found.

## Honest limits

- Roles are enforced in the browser, not on a server. The storage layer is one small file (`src/store/db.ts`); swapping it for a real backend is the next step.
- The engine cannot be re-run, so tax effects are estimates from its per-dollar rates at the v3 numbers. They do not model thresholds a change might cross, or AMT interplay.
- No page images were provided, so source documents are drawn from the printed text; highlights are placed by matching text, not the synthetic coordinates. The document is addressed by (document, page, field), so real scans can replace the drawing without changing any link.
- E-file is simulated with one rule taken from the real file: the federal return is rejected until Theo's SSN matches his card.
