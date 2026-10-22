# The idea, in one page

## The problem

MiraFlores' tax software reads a family's documents and calculates their return. Before it is filed, an accountant has to check it and be able to prove every number. Today that proof lives in spreadsheets, emails and people's memory.

For the Okafor-Lindqvist family, the software says they **owe $4,220**. That number is wrong. Once the mistakes are fixed, they actually **get about $9,000 back** federally. Without a good workpaper, nobody would know.

## The core idea

**Don't store the numbers. Store what happened to them.**

A spreadsheet keeps only the latest value of each cell. This workpaper keeps a record of every action: who looked at a number, what they changed, why, and who approved it. Everything else is built on that record.

That gives five things a CPA needs:

1. **Every number can be clicked.** It shows the document and the exact spot it came from, how it was calculated, and everything ever done to it.
2. **Nothing is overwritten.** A correction sits on top of the original, with who made it, the reason, the tax rule, and how much tax it changes. The original is always one click away.
3. **History comes for free.** Because every action is recorded, the app can show what changed since you last looked, compare any two moments, undo a whole batch of actions, and lock an exact copy when the return is filed.
4. **A signature means something.** When the reviewer or partner signs, the app remembers exactly what they approved. If a number changes afterwards, their signature reopens and says what changed.
5. **The app checks the software instead of trusting it.** My own checks re-read the documents and recalculate. They found 22 real mistakes the software missed (13 calculation mistakes, 4 misread documents, 5 places where sources disagree). Fixing the clear ones changes the family's federal result by about $13,000.

## The data model, simply

| Piece | What it is |
|---|---|
| **The packet** | The data MiraFlores gave: documents, the values read from them, the software's three calculations, client answers, last year's return, IRS records. Read-only; never changed. |
| **A reference** | A short address for anything that can be evidence: a line on the return, a value on a document page, a client message, last year's figure. A real scanned document would be addressed the same way. |
| **An event** | The only thing saved: who did what, when, and why (proposed a fix, approved it, asked the client, signed, filed). |
| **The current state** | Built by replaying all the events in order. Fixes, notes, questions, verifications, signatures and the filing status all come from this. |
| **A problem** | Something one of the 30 checks found, with its evidence, the tax effect, and a proposed fix that someone else has to approve. |

## Decisions and trade-offs

- **It runs in the browser, with no server.** Anyone can open a link and use it straight away, and work is saved in the browser. *Trade-off:* permissions are checked in the browser, not on a server. Storage is one small file, so moving to a real backend later is a swap, not a rewrite.
- **Tax effects are estimates.** The software can't be re-run, so the app multiplies each change by the software's own tax rates. It always labels these as estimates.
- **The firm's rules are enforced, not just written.** Nobody approves their own work. Changes over $1,000 need the partner. The two signatures must come from two different people. Staff without clearance see sensitive numbers masked, and every unmasked view is logged. The firm administrator can change these rules.
- **Built for a first-time user.** Plain words instead of tax jargon, a five-step path to filing on the home page, and a help panel that explains every term.

**Built with** React and TypeScript, the browser's own database (IndexedDB) for saving, and 16 automated tests that run the checks on the real data. I used Claude Code as an AI coding assistant to write the code faster; the design and product decisions above are mine.
