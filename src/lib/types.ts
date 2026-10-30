export interface Transaction {
  id: string;
  statement_id?: string;
  date: string;
  raw_date?: string;
  description: string;
  reference_number?: string | null;
  debit: number;
  credit: number;
  balance: number;
  currency: string;
  category: string;
  confidence: number;
  source_page: number;
  row_index: number;
}

export interface CheckResult {
  check_name: string;
  status: 'passed' | 'failed' | 'warning' | 'unverifiable';
  message: string;
  details?: Record<string, any>;
}

export interface ValidationReport {
  is_valid: boolean;
  summary: string;
  checks: CheckResult[];
  discrepancy_amount?: number | null;
  reconciliation_formula?: string | null;
  duplicate_candidates_count: number;
  chronological_issues_count: number;
  unparsed_rows_count: number;
}

export interface MonthlyMetric {
  month: string;
  total_credit: number;
  total_debit: number;
  net_cashflow: number;
  transaction_count: number;
}

export interface CategorySummary {
  category: string;
  count: number;
  total_debit: number;
  total_credit: number;
}

export interface FinancialSummary {
  opening_balance?: number | null;
  closing_balance?: number | null;
  total_credits: number;
  total_debits: number;
  net_cashflow: number;
  transaction_count: number;
  start_date?: string | null;
  end_date?: string | null;
  avg_monthly_credits: number;
  avg_monthly_debits: number;
  avg_balance?: number | null;
  potential_salary_credits: number;
  potential_salary_count: number;
  potential_emi_debits: number;
  potential_emi_count: number;
  cash_deposits_total: number;
  cash_deposits_count: number;
  cash_withdrawals_total: number;
  cash_withdrawals_count: number;
  bank_charges_total: number;
  bank_charges_count: number;
  monthly_metrics: MonthlyMetric[];
  category_summaries: CategorySummary[];
}

export interface StatementMetadata {
  bank_name: string;
  detected_bank: string;
  account_number_masked?: string | null;
  account_holder_name?: string | null;
  ifsc_code?: string | null;
  branch_name?: string | null;
  statement_period_start?: string | null;
  statement_period_end?: string | null;
  currency: string;
  page_count: number;
  is_encrypted: boolean;
  ocr_applied: boolean;
  ocr_pages: number[];
}

export interface Statement {
  id: string;
  filename: string;
  file_size: number;
  content_fingerprint: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error_message?: string | null;
  uploaded_at: string;
  metadata?: StatementMetadata;
  summary?: FinancialSummary;
  validation?: ValidationReport;
  raw_unparsed_lines?: string[];
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  action: string;
  statement_id?: string;
  details?: Record<string, any>;
}
