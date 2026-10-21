// Types for the packet as MiraFlores delivers it. They only cover the fields the
// workpaper actually reads; the JSON has more. See readme.sections inside the packet.

/** A pointer to anything evidence can point at, e.g. "line:F1040.1a" or "ev:ev-0016". */
export type Ref = string

export interface Person {
  id: string
  role: 'taxpayer' | 'spouse' | 'dependent'
  name: string
  ssn: string
  dob: string
  relationship?: string
  ip_pin?: string | null
  phone?: string
  email?: string
  occupation?: string
  note?: string
  own_income?: string
  full_time_student?: boolean
  months_lived_with_you?: number
}

export interface Household {
  filing_status: string
  tax_year: number
  entered_by: string
  people: Person[]
  addresses: { from: string; to: string | null; address: string; type: string }[]
  residency: { state: string; from: string; to: string; status: string }[]
  bank_account_for_refund_or_payment: { routing: string; account: string; type: string; bank: string }
  prior_year_agi_for_esignature: number
  related_returns: { who: string; return: string; prepared_by: string; in_this_packet: boolean | string }[]
}

export interface DocPage {
  page: number
  printed_content: string
}

export interface Doc {
  id: string
  title: string
  document_type: string
  issuer: string
  belongs_to: string
  tax_year: number
  received_at: string
  uploaded_by: 'client' | 'firm'
  file_name: string
  page_count: number
  pages: DocPage[]
  marked_corrected?: boolean
  extraction: { status: 'extracted' | 'partial' | 'not_extracted'; values: number; reason: string | null }
}

export type ValueType =
  | 'money' | 'date' | 'text' | 'integer' | 'quantity' | 'percent'
  | 'boolean' | 'code' | 'ssn' | 'ein' | 'account_number'

export interface ExtractedValue {
  id: string
  document_id: string
  page: number
  field: string
  label: string
  value: string | number | boolean | null
  value_type: ValueType
  text_as_read: string
  position: { x0: number; y0: number; x1: number; y1: number }
  confidence: number
}

export interface ReturnLine {
  key: string
  jurisdiction: 'federal' | 'california'
  form: string
  line: string
  label: string
  value: number | string | null
  rule: string
  inputs: string[]
  sources: string[]
  note?: string
}

export interface TaxRate {
  federal_per_dollar: number
  california_per_dollar: number
}

export interface Diagnostic {
  code: string
  severity: 'info' | 'warning'
  message: string
  refs: string[]
}

export interface ChangeFromPrevious {
  key: string
  change: 'added' | 'changed' | 'removed'
  old: unknown
  new: unknown
}

export interface Totals {
  agi?: number
  total_agi?: number
  ca_agi?: number
  taxable_income: number
  total_tax: number
  payments: number
  balance_due: number
  penalty: number
}

export interface AssetYear {
  prior_accumulated: number
  depreciation_2025: number
  accumulated_end: number
}

export interface Asset {
  asset_id: string
  description: string
  activity: string
  cost: number
  land_value_not_depreciated: number | null
  placed_in_service: string
  method: string
  life_years: number
  federal: AssetYear
  california: AssetYear
  amt: { depreciation_2025: number; difference_from_regular: number }
  disposed: string | null
  sources: string[]
  disposition?: Record<string, unknown>
}

export interface ReturnVersion {
  version: string
  computed_at: string
  trigger: string
  documents_used: string[]
  documents_superseded: string[]
  summary: { federal: Totals; california: Totals }
  tax_effect_rates: Record<string, TaxRate>
  carryovers_out: { federal: Record<string, number | null>; california: Record<string, unknown> }
  assets: Asset[]
  diagnostics: Diagnostic[]
  changes_from_previous: ChangeFromPrevious[]
  lines: ReturnLine[]
}

export interface StaffMember {
  id: string
  name: string
  role: 'preparer' | 'reviewer' | 'partner' | 'firm_administrator' | 'quality_reviewer'
  credential: string | null
  sensitive_data_clearance: boolean
  active_from: string
  note?: string
}

export interface Standards {
  note?: string
  verification_types: string[]
  variance_review: { compare_to: string; flag_if_change_over_percent: number; and_over_amount: number }
  review_levels: string[]
  rules: string[]
  required_steps: string[]
}

export interface Questionnaire { id: string; question: string; answer: string; answered_by: string; answered_at: string }
export interface Message { id: string; sent_at: string; from: string; to: string; text: string }
export interface CallNotes { id: string; date: string; participants: string[]; notes: string[] }

export interface TimelineEvent {
  id: string
  at: string
  event: string
  actor: string | null
  detail: string | null
  refs: string[]
}

export interface AgencyTransaction { date: string; code: string; description: string; amount: number | string }

export interface WhatIf {
  id: string
  description: string
  base_version: string
  choices: Record<string, string>
  federal: { base: Totals; alternative: Totals; total_tax_change: number; penalty_change?: number }
  california: { base: Totals; alternative: Totals; total_tax_change: number; penalty_change?: number }
  changed_lines: ChangeFromPrevious[]
}

export interface PriorYears {
  return_2024: {
    prepared_by: string
    filed: string
    lines: Record<string, number | string>
    line_labels: Record<string, string>
    line_sources: Record<string, string[]>
    notes: Record<string, string>
    dependents: { name: string; ssn: string }[]
    K1_1120S: Record<string, number>
    K1_1065: Record<string, number | string>
  }
  prior_preparer_workpaper: {
    source_document: string
    summary_memo: string
    notes: string[]
    open_items_left_by_prior_preparer: string[]
  }
  asset_records: Record<string, unknown>[]
  basis_records: Record<string, unknown>
  carryovers_into_2025: Record<string, unknown>
}

export interface Packet {
  packet: { name: string; version: string; generated: string; client_id: string }
  readme: Record<string, unknown>
  household: Household
  documents: Doc[]
  extracted_values: ExtractedValue[]
  client: { questionnaire: Questionnaire[]; messages: Message[]; call_notes: CallNotes[] }
  firm: {
    name: string
    staff: StaffMember[]
    firm_identity: Record<string, unknown>
    client_users: { id: string; name: string; role: 'client' }[]
    assignment_at_start: { preparer: string; reviewer: string; partner: string }
    deadlines: { what: string; date: string }[]
    budget_hours: Record<string, number>
    starter_standards: Standards
  }
  prior_years: PriorYears
  tax_agency_records: {
    irs_account_transcript_2025: { as_of: string; transactions: AgencyTransaction[] }[]
    ftb_account: Record<string, unknown>
    notices: Record<string, unknown>[]
    efile: { date: string; jurisdiction: string; submission_id: string; status: string; errors?: { code: string; message: string }[] }[]
  }
  timeline: TimelineEvent[]
  engine_reference: { parameters: Record<string, any>; rules: Record<string, string> }
  return_versions: ReturnVersion[]
  what_if: { alternatives: WhatIf[]; extension: Record<string, unknown> }
  planning_reference_2026: Record<string, unknown>
  post_filing_rates: Record<string, unknown>
  fx_rates: Record<string, unknown>
}
