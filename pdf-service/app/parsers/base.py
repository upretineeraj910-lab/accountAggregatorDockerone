import re
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional, Tuple
from decimal import Decimal, InvalidOperation
from datetime import datetime


class ParsedRecord:
    def __init__(
        self,
        date_str: str,
        raw_date: str,
        description: str,
        debit: Decimal,
        credit: Decimal,
        balance: Decimal,
        reference_number: Optional[str] = None,
        confidence: float = 0.95,
        source_page: int = 1,
        row_index: int = 0
    ):
        self.date_str = date_str
        self.raw_date = raw_date
        self.description = description
        self.debit = debit
        self.credit = credit
        self.balance = balance
        self.reference_number = reference_number
        self.confidence = confidence
        self.source_page = source_page
        self.row_index = row_index


class ParseResult:
    def __init__(
        self,
        bank_name: str,
        records: List[ParsedRecord],
        account_number_masked: Optional[str] = None,
        account_holder_name: Optional[str] = None,
        opening_balance: Optional[Decimal] = None,
        closing_balance: Optional[Decimal] = None,
        statement_period_start: Optional[str] = None,
        statement_period_end: Optional[str] = None,
        unparsed_lines: Optional[List[str]] = None,
        metadata: Optional[Dict[str, Any]] = None
    ):
        self.bank_name = bank_name
        self.records = records
        self.account_number_masked = account_number_masked
        self.account_holder_name = account_holder_name
        self.opening_balance = opening_balance
        self.closing_balance = closing_balance
        self.statement_period_start = statement_period_start
        self.statement_period_end = statement_period_end
        self.unparsed_lines = unparsed_lines or []
        self.metadata = metadata or {}


class BaseStatementParser(ABC):
    """Abstract base class for all bank statement parsers."""

    # Common Indian date formats
    DATE_FORMATS = [
        "%d/%m/%Y", "%d-%m-%Y", "%d/%m/%y", "%d-%m-%y",
        "%d %b %Y", "%d-%b-%Y", "%d %B %Y", "%d-%B-%Y",
        "%d %b, %Y", "%d-%b-%y", "%d %b %y",
        "%Y-%m-%d", "%Y/%m/%d"
    ]

    @abstractmethod
    def can_parse(self, text: str, lines: List[str]) -> bool:
        """Determines if this parser matches the statement document."""
        pass

    @abstractmethod
    def parse(self, extractions: List[Any]) -> ParseResult:
        """Parses the statement from extracted document pages."""
        pass

    @classmethod
    def clean_amount_str(cls, amt_str: str) -> Optional[Decimal]:
        """
        Cleans Indian and international currency strings, e.g.:
        "1,23,456.78", "45,000.00 Cr", " (1,500.00)", " - ", "Nil"
        Returns Decimal or None.
        """
        if not amt_str:
            return None

        s = amt_str.strip()
        if s in ("-", "--", "Nil", "NIL", "0", "0.00", ""):
            return Decimal("0.00")

        # Strip currency symbols (₹, INR, Rs., Rs)
        s = re.sub(r"[₹\$\€\£]|INR|Rs\.?|RS\.?", "", s, flags=re.IGNORECASE).strip()

        # Check for DR/CR suffix
        is_dr = False
        if re.search(r"\b(Dr|DR|dr)\b", s):
            is_dr = True
            s = re.sub(r"\b(Dr|DR|dr)\b", "", s).strip()
        elif re.search(r"\b(Cr|CR|cr)\b", s):
            s = re.sub(r"\b(Cr|CR|cr)\b", "", s).strip()

        # Handle parentheses indicating negative
        if s.startswith("(") and s.endswith(")"):
            is_dr = True
            s = s[1:-1].strip()

        # Remove commas
        s = s.replace(",", "").strip()

        try:
            val = Decimal(s)
            if is_dr and val > 0:
                val = -val
            return val
        except (InvalidOperation, ValueError):
            return None

    @classmethod
    def normalize_date(cls, date_str: str) -> Tuple[Optional[str], Optional[str]]:
        """
        Attempts to normalize date string to ISO YYYY-MM-DD.
        Returns Tuple of (ISO_DATE_STR, RAW_DATE_STR).
        """
        if not date_str:
            return None, None

        cleaned = date_str.strip()
        # Remove extra spaces or trailing dots
        cleaned = re.sub(r"\s+", " ", cleaned).strip(".")

        for fmt in cls.DATE_FORMATS:
            try:
                dt = datetime.strptime(cleaned, fmt)
                # Filter out absurd years
                if 1990 <= dt.year <= 2050:
                    return dt.strftime("%Y-%m-%d"), cleaned
            except ValueError:
                continue

        # Try regex search if embedded in text: e.g. "12/10/2026"
        match = re.search(r"\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b", cleaned)
        if match:
            part = match.group(1)
            for fmt in ["%d/%m/%Y", "%d-%m-%Y", "%d/%m/%y", "%d-%m-%y"]:
                try:
                    dt = datetime.strptime(part, fmt)
                    if 1990 <= dt.year <= 2050:
                        return dt.strftime("%Y-%m-%d"), part
                except ValueError:
                    continue

        return None, cleaned

    @classmethod
    def mask_account_number(cls, acc_no: Optional[str]) -> Optional[str]:
        """Masks account number to preserve privacy while leaving last 4 digits visible."""
        if not acc_no:
            return None
        clean_num = re.sub(r"\D", "", acc_no)
        if len(clean_num) <= 4:
            return f"XXXX{clean_num}"
        return f"{'X' * (len(clean_num) - 4)}{clean_num[-4:]}"
