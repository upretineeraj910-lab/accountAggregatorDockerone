from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from decimal import Decimal
from datetime import date


class Transaction(BaseModel):
    id: Optional[str] = None
    date: str = Field(..., description="Transaction date in YYYY-MM-DD format")
    raw_date: Optional[str] = Field(None, description="Original raw date string from PDF")
    description: str = Field(..., description="Original transaction narration")
    reference_number: Optional[str] = Field(None, description="Cheque/Ref/UTR number")
    debit: float = Field(0.0, description="Debit amount (money out)")
    credit: float = Field(0.0, description="Credit amount (money in)")
    balance: float = Field(..., description="Running account balance after transaction")
    currency: str = Field("INR", description="Currency code")
    category: str = Field("unclassified", description="Categorized classification")
    confidence: float = Field(1.0, description="Extraction confidence score (0.0 to 1.0)")
    source_page: int = Field(1, description="1-indexed PDF page where transaction was found")
    row_index: int = Field(0, description="0-indexed sequence order in statement")


class CheckResult(BaseModel):
    check_name: str
    status: str = Field(..., description="'passed', 'failed', 'warning', or 'unverifiable'")
    message: str
    details: Optional[Dict[str, Any]] = None


class ValidationReport(BaseModel):
    is_valid: bool
    summary: str
    checks: List[CheckResult] = []
    discrepancy_amount: Optional[float] = None
    reconciliation_formula: Optional[str] = None
    duplicate_candidates_count: int = 0
    chronological_issues_count: int = 0
    unparsed_rows_count: int = 0


class MonthlyMetric(BaseModel):
    month: str  # YYYY-MM
    total_credit: float
    total_debit: float
    net_cashflow: float
    transaction_count: int


class CategorySummary(BaseModel):
    category: str
    count: int
    total_debit: float
    total_credit: float


class FinancialSummary(BaseModel):
    opening_balance: Optional[float] = None
    closing_balance: Optional[float] = None
    total_credits: float = 0.0
    total_debits: float = 0.0
    net_cashflow: float = 0.0
    transaction_count: int = 0
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    avg_monthly_credits: float = 0.0
    avg_monthly_debits: float = 0.0
    avg_balance: Optional[float] = None
    potential_salary_credits: float = 0.0
    potential_salary_count: int = 0
    potential_emi_debits: float = 0.0
    potential_emi_count: int = 0
    cash_deposits_total: float = 0.0
    cash_deposits_count: int = 0
    cash_withdrawals_total: float = 0.0
    cash_withdrawals_count: int = 0
    bank_charges_total: float = 0.0
    bank_charges_count: int = 0
    monthly_metrics: List[MonthlyMetric] = []
    category_summaries: List[CategorySummary] = []


class StatementMetadata(BaseModel):
    bank_name: str
    detected_bank: str
    account_number_masked: Optional[str] = None
    account_holder_name: Optional[str] = None
    ifsc_code: Optional[str] = None
    branch_name: Optional[str] = None
    statement_period_start: Optional[str] = None
    statement_period_end: Optional[str] = None
    currency: str = "INR"
    page_count: int = 0
    is_encrypted: bool = False
    ocr_applied: bool = False
    ocr_pages: List[int] = []


class ProcessingLogEntry(BaseModel):
    timestamp: str
    stage: str
    status: str
    message: str


class ProcessStatementResponse(BaseModel):
    status: str = "success"
    statement_metadata: StatementMetadata
    transactions: List[Transaction]
    financial_summary: FinancialSummary
    validation_report: ValidationReport
    processing_logs: List[ProcessingLogEntry]
    raw_unparsed_lines: List[str] = []
    content_fingerprint: str


class ServiceHealthResponse(BaseModel):
    status: str
    version: str
    ocr_available: bool
    ocr_engine: str
    doc_api_adapter_configured: bool
    doc_api_provider: str
