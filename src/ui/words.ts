import type { Finding } from '../checks/types'
import type { Role } from '../domain/people'

// One place for the words people see, so every page says the same thing in plain English.

export const SEVERITY: Record<Finding['severity'], { label: string; tone: 'bad' | 'warn' | 'info'; hint: string }> = {
  error: { label: 'Must fix', tone: 'bad', hint: 'The return is wrong until this is fixed.' },
  warning: { label: 'Worth a look', tone: 'warn', hint: 'Needs a person to check or decide.' },
  info: { label: 'FYI', tone: 'info', hint: 'Good to know; no action required.' },
}

export const KIND: Record<Finding['kind'], string> = {
  engine_error: 'Software mistake',
  extraction_error: 'Reading mistake',
  data_conflict: 'Conflicting info',
  judgment: 'Decision needed',
  outside_scope: 'Tell the client',
  tie_out: "Doesn't add up",
}

/** What each person does, in a sentence, and what the app lets them do. */
export const ROLE_STORY: Record<Role, { does: string; can: string; cannot: string }> = {
  preparer: {
    does: 'Builds the return day to day.',
    can: 'Check numbers, propose fixes, ask the client questions, log time.',
    cannot: 'Approve their own fixes or sign off.',
  },
  reviewer: {
    does: 'Checks the preparer’s work.',
    can: 'Approve fixes up to $1,000 of tax, write review notes, sign as reviewer.',
    cannot: 'Approve bigger fixes or sign as partner.',
  },
  partner: {
    does: 'Senior accountant who takes final responsibility.',
    can: 'Approve any fix, sign as partner, file the return.',
    cannot: 'Sign as reviewer too: the two signatures need two people.',
  },
  firm_administrator: {
    does: 'Runs the office: rules, people and security.',
    can: 'Change the firm’s rules, assign work, read the security log.',
    cannot: 'Change any tax numbers.',
  },
  quality_reviewer: {
    does: 'Audits finished returns afterwards.',
    can: 'Write quality notes and read the security log.',
    cannot: 'Change numbers. Starts work in January 2027.',
  },
  client: {
    does: 'The taxpayer.',
    can: 'Answer questions, upload documents, approve and e-sign the return.',
    cannot: 'See the firm’s internal notes.',
  },
}

export const GLOSSARY: [string, string][] = [
  ['Workpaper', 'The accountant’s file that proves a tax return is right: where each number came from, what was changed, and who checked it.'],
  ['Tax software', 'MiraFlores’ program that read the documents and calculated the return. It can make mistakes, which is why this app exists.'],
  ['Problem', 'Something this app’s own checks found wrong or worth a look.'],
  ['Fix', 'A proposed change to a number. The original is kept; the fix sits on top and records who, why and the tax effect.'],
  ['Preparer / Reviewer / Partner', 'The three levels of people at the firm. The preparer does the work, the reviewer checks it, the partner signs.'],
  ['Sign-off', 'A person confirming they reviewed the return. If a number changes afterwards, the sign-off reopens.'],
  ['E-file', 'Sending the return to the IRS (federal) or FTB (California) electronically. It can be rejected, for example if an SSN is wrong.'],
  ['Form 8879', 'The form the client signs to let the firm e-file for them.'],
  ['Extension', 'Extra time to file (here to October 15). It is not extra time to pay.'],
  ['W-2', 'Salary statement from an employer.'],
  ['1099-NEC', 'Statement from a client who paid a freelancer.'],
  ['1099-K', 'Statement from a card-payment company listing card payments received.'],
  ['1099-B / 1099-DA', 'Statement from a broker (stocks) or crypto exchange listing sales.'],
  ['1099-INT / 1099-DIV', 'Statements of bank interest and investment dividends.'],
  ['K-1', 'Your share of a partnership’s or small company’s income.'],
  ['Basis', 'What you paid for something. Profit on a sale is the price minus the basis.'],
  ['Schedule C', 'The part of the return for a one-person business.'],
  ['Schedule E', 'The part of the return for rental property and K-1 income.'],
  ['Depreciation', 'Spreading the cost of a building or equipment over several years instead of deducting it all at once.'],
  ['AGI', 'Adjusted gross income: total income after a few adjustments, before deductions.'],
  ['Itemized deductions', 'Mortgage interest, property tax, charity and similar. Used instead of the standard deduction when larger.'],
  ['Part-year resident', 'Someone who moved states during the year. California taxes them fully only for the months they lived there.'],
  ['Estimated payments', 'Tax paid during the year by people with income that has no withholding.'],
]
