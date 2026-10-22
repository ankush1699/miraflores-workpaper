# Miraflores Workpaper

**Live app:** https://ankush1699.github.io/miraflores-workpaper/

A workpaper is the tool an accountant uses to check a tax return before filing it, and to prove every number is right. This one is built for one family's 2025 return (the Okafor-Lindqvists), for the MiraFlores AI case study.

The tax software says the family **owes $4,220**. This app re-checks every number against the documents, finds the software's mistakes, and shows that once they're fixed the family actually **gets about $9,000 back**.

- **The idea and data model, on one page:** [docs/ONE_PAGER.md](docs/ONE_PAGER.md)
- **Every mistake found, and how the app found it:** [docs/ERRORS.md](docs/ERRORS.md)

## Try it in five minutes

No login, no install. Open the link above. Your work saves in your own browser.

1. **Home** explains what this is and shows five steps to file. Follow them top to bottom.
2. Open **Problems**. These are the mistakes the app found by itself. Open one with **Details** to see the proof.
3. Click **Fix all clear problems**. One click on **↶ Undo** takes them all back.
4. Click **You are…** (top right) and switch to **Daniel Ortiz, Reviewer**. In **Fixes & approvals**, try to approve everything: the app refuses, because changes over $1,000 need the partner. Switch to **Helen Strand, Partner** and approve them.
5. Click any underlined number to see the exact document it came from.
6. In **Filing → Replay the season**, play what happened after the calculation (client signature, e-file, payments, an IRS letter in 2028) through the same rules.

**? Help** explains every tax word. **⋯ → Start over** clears everything.

## What the case study asked for, and where it is

| Asked for | Where to find it |
|---|---|
| Trace any number to its source; record how it was checked; link items; attach evidence | Click any number |
| Show how a number was built; reconcile figures; business books to tax; state split; checks that don't trust the software | Click a number → *How it's calculated*; each topic under **The return**; **Problems**; **Reports** |
| Change without losing the original; see what changed; compare versions; what-ifs; bulk actions with undo | **Fixes & approvals**, **Problems**, ↶ Undo |
| Flag big changes from last year; record decisions with the rule relied on; prove nothing was missed | **Reports → Return summary**, **Filing → Judgments**, **Documents** |
| Client questions that become evidence; review notes that block filing; sign-offs that reopen; roles; several people at once | **Notes & sign-offs**, **You are…**, open two tabs as two people |
| Extension, e-file and rejection, client's copy, freeze at filing, amendments, answering a notice, next year | **Filing** |
| Firm rules, sensitive data with a view log, time against budget, search | **Settings & security**, ⌘K |
| The records a CPA expects | **Reports** (16 of them) |

## How it's built

| Part | What I used | Why |
|---|---|---|
| The app | React + TypeScript, built with Vite | Standard and reliable; produces a small site that runs anywhere |
| Saving work | The browser's own database (IndexedDB) | No server or login needed |
| How data is stored | A log of every action, replayed to get the current state | History, undo, version comparison and the frozen copy at filing all come from one place |
| Two people at once | BroadcastChannel (browser tabs talk to each other) | Live updates between two people |
| Tests | Vitest: 16 tests on the real data | Proves the checks find the right mistakes with the right amounts |
| Hosting | GitHub Pages | A free public link |

I used **Claude Code** as an AI coding assistant to write the code faster. The design and product decisions are mine: storing actions instead of values, keeping it in the browser, the firm's rules, and simplifying the app for a first-time user.

### Run it yourself

```bash
npm install
npm run dev     # local version
npm test        # the checks and the rules, on the real data
npm run build   # static site in dist/
```

### Where things are in the code

- `src/checks/`: the independent checks. They re-read the documents and recalculate; they never read the software's own warnings.
- `src/store/`: the action log, and `rules.ts`, where roles and the firm's rules are enforced.
- `src/domain/`: tax-effect estimates, signature checks, the filing steps.
- `src/pages/` and `src/ui/`: the screens.

## Honest limits

- Permissions are checked in the browser, not on a server. Storage is one small file (`src/store/db.ts`), so a real backend can replace it.
- The tax software can't be re-run, so tax effects are estimates using its own per-dollar rates. They don't model limits that a large change might cross.
- No scanned images were provided, so documents are drawn from their printed text, and values are highlighted by matching that text. Each value is addressed by document, page and field, so real scans could replace the drawing without breaking any link.
- E-filing is simulated. The federal return is rejected if Theo's Social Security number is still wrong, as happened in the real file.
