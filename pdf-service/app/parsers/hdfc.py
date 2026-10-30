import re
from typing import List, Any, Optional
from decimal import Decimal
from app.parsers.base import BaseStatementParser, ParseResult, ParsedRecord


class HDFCParser(BaseStatementParser):
    """Parser specifically designed for HDFC Bank statements."""

    BANK_NAME = "HDFC Bank"

    def can_parse(self, text: str, lines: List[str]) -> bool:
        t_upper = text.upper()
        return "HDFC BANK" in t_upper or "HDFCBANK" in t_upper

    def parse(self, extractions: List[Any]) -> ParseResult:
        all_text = "\n".join([page.raw_text for page in extractions])
        all_lines = []
        for p in extractions:
            all_lines.extend([(line, p.page_number) for line in p.lines])

        # 1. Extract metadata
        acc_no = None
        acc_match = re.search(r"(?:Account\s*No\.?|A/C\s*No\.?|Account\s*Number)[:\s]+([0-9]{10,16})", all_text, re.IGNORECASE)
        if acc_match:
            acc_no = acc_match.group(1)

        holder_name = None
        name_match = re.search(r"(?:Customer\s*Name|Name)[:\s]+([A-Z\s\.]{3,40}?)(?=\s*(?:Account|A/C|A/c|No|Number|\n|$))", all_text, re.IGNORECASE)
        if name_match:
            holder_name = name_match.group(1).strip()

        period_start = None
        period_end = None
        period_match = re.search(
            r"(?:From|Statement\s*From|Period)[:\s]+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\s+(?:To|Statement\s*To|to)\s+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})",
            all_text,
            re.IGNORECASE
        )
        if period_match:
            period_start, _ = self.normalize_date(period_match.group(1))
            period_end, _ = self.normalize_date(period_match.group(2))

        records: List[ParsedRecord] = []
        unparsed_lines: List[str] = []
        row_counter = 0

        # Pattern for line: Date, Narration, Ref, Withdrawal, Deposit, Closing
        date_prefix_regex = re.compile(r"^(\d{2}[/-]\d{2}[/-]\d{2,4})\s+(.+)$")
        amount_pattern = re.compile(r"([0-9,]+\.\d{2})")

        for line_str, page_num in all_lines:
            m = date_prefix_regex.match(line_str)
            if m:
                iso_dt, raw_dt = self.normalize_date(m.group(1))
                rest = m.group(2).strip()

                amounts = amount_pattern.findall(rest)
                if len(amounts) >= 1 and iso_dt:
                    bal_val = Decimal("0.00")
                    debit_val = Decimal("0.00")
                    credit_val = Decimal("0.00")

                    if len(amounts) >= 3:
                        # 3 amounts: Withdrawal, Deposit, Balance
                        debit_val = abs(self.clean_amount_str(amounts[-3]) or Decimal("0.00"))
                        credit_val = abs(self.clean_amount_str(amounts[-2]) or Decimal("0.00"))
                        bal_val = self.clean_amount_str(amounts[-1]) or Decimal("0.00")
                        first_amt_pos = rest.find(amounts[-3])
                        narration = rest[:first_amt_pos].strip()
                    elif len(amounts) == 2:
                        amt_val = abs(self.clean_amount_str(amounts[0]) or Decimal("0.00"))
                        bal_val = self.clean_amount_str(amounts[1]) or Decimal("0.00")
                        first_amt_pos = rest.find(amounts[0])
                        narration = rest[:first_amt_pos].strip()

                        # Check if preceded by a dash indicating empty withdrawal: e.g. "- 1,299.00"
                        segment_before_amt = rest[max(0, first_amt_pos - 6):first_amt_pos].strip()
                        segment_between = rest[first_amt_pos + len(amounts[0]):rest.find(amounts[1])].strip()

                        if segment_before_amt == "-" or segment_before_amt.endswith("-"):
                            credit_val = amt_val
                        elif segment_between == "-" or "-" in segment_between:
                            debit_val = amt_val
                        elif records and len(records) > 0:
                            # Use running balance delta
                            prev_bal = records[-1].balance
                            if bal_val > prev_bal:
                                credit_val = amt_val
                            else:
                                debit_val = amt_val
                        else:
                            # Use narration clues
                            if any(k in narration.upper() for k in ("CR", "CREDIT", "SALARY", "REFUND", "DEP", "INTEREST")):
                                credit_val = amt_val
                            else:
                                debit_val = amt_val
                    else:
                        bal_val = self.clean_amount_str(amounts[0]) or Decimal("0.00")
                        narration = rest[:rest.find(amounts[0])].strip()

                    # Clean trailing ref numbers or dashes from narration
                    narration = re.sub(r"\s+-\s*$", "", narration).strip()

                    rec = ParsedRecord(
                        date_str=iso_dt,
                        raw_date=raw_dt,
                        description=narration if narration else "Transaction",
                        debit=debit_val,
                        credit=credit_val,
                        balance=bal_val,
                        confidence=0.96,
                        source_page=page_num,
                        row_index=row_counter
                    )
                    records.append(rec)
                    row_counter += 1
                else:
                    unparsed_lines.append(f"Page {page_num}: {line_str}")
            else:
                if records and len(line_str) > 3 and not any(h in line_str.upper() for h in ("HDFC", "STATEMENT", "PAGE", "TOTAL", "CLOSING BALANCE")):
                    records[-1].description += f" {line_str}"

        opening_bal = None
        op_match = re.search(r"(?:Opening\s*Balance|B/F|Bal\s*b/f)[:\s]+(?:INR\s*)?([0-9,]+\.\d{2})", all_text, re.IGNORECASE)
        if op_match:
            opening_bal = self.clean_amount_str(op_match.group(1))

        closing_bal = records[-1].balance if records else None

        return ParseResult(
            bank_name=self.BANK_NAME,
            records=records,
            account_number_masked=self.mask_account_number(acc_no),
            account_holder_name=holder_name,
            opening_balance=opening_bal,
            closing_balance=closing_bal,
            statement_period_start=period_start,
            statement_period_end=period_end,
            unparsed_lines=unparsed_lines
        )
