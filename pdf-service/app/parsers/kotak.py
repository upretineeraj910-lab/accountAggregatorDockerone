import re
from typing import List, Any
from decimal import Decimal
from app.parsers.base import BaseStatementParser, ParseResult, ParsedRecord


class KotakParser(BaseStatementParser):
    """Parser specifically designed for Kotak Mahindra Bank statements."""

    BANK_NAME = "Kotak Mahindra Bank"

    def can_parse(self, text: str, lines: List[str]) -> bool:
        t_upper = text.upper()
        return "KOTAK" in t_upper

    def parse(self, extractions: List[Any]) -> ParseResult:
        all_text = "\n".join([page.raw_text for page in extractions])
        all_lines = []
        for p in extractions:
            all_lines.extend([(line, p.page_number) for line in p.lines])

        acc_no = None
        acc_match = re.search(r"(?:Account\s*No\.?|CRN\s*No\.?|A/C\s*No\.?)[:\s]+([0-9]{10,14})", all_text, re.IGNORECASE)
        if acc_match:
            acc_no = acc_match.group(1)

        holder_name = None
        name_match = re.search(r"(?:Name|Customer\s*Name)[:\s]+([A-Z\s\.]{3,40}?)(?=\s*(?:Account|CRN|A/C|A/c|No|Number|\n|$))", all_text, re.IGNORECASE)
        if name_match:
            holder_name = name_match.group(1).strip()

        period_start = None
        period_end = None
        period_match = re.search(
            r"(?:Period|Statement\s*Period)[:\s]+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\s+(?:To|-)\s+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})",
            all_text,
            re.IGNORECASE
        )
        if period_match:
            period_start, _ = self.normalize_date(period_match.group(1))
            period_end, _ = self.normalize_date(period_match.group(2))

        records: List[ParsedRecord] = []
        unparsed_lines: List[str] = []
        row_counter = 0

        # Tables
        for page in extractions:
            for table in page.tables:
                if not table or len(table) < 2:
                    continue
                header = [str(col).strip().upper() for col in table[0] if col]
                header_str = " ".join(header)
                if ("DATE" in header_str and ("DESCRIPTION" in header_str or "PARTICULARS" in header_str or "AMOUNT" in header_str or "BALANCE" in header_str)):
                    for row in table[1:]:
                        if not row or len(row) < 3:
                            continue
                        date_cell = str(row[0]).strip()
                        iso_date, raw_date = self.normalize_date(date_cell)
                        if not iso_date:
                            continue

                        desc = str(row[1]).strip() if len(row) > 1 else "Transaction"
                        debit = Decimal("0.00")
                        credit = Decimal("0.00")
                        bal = Decimal("0.00")

                        amounts = []
                        for cell in row[1:]:
                            c_amt = self.clean_amount_str(str(cell))
                            if c_amt is not None:
                                amounts.append(c_amt)

                        if len(amounts) >= 3:
                            debit = abs(amounts[-3])
                            credit = abs(amounts[-2])
                            bal = amounts[-1]
                        elif len(amounts) == 2:
                            amt = amounts[0]
                            bal = amounts[1]
                            row_str = " ".join(str(c) for c in row)
                            if "CR" in row_str.upper() or "CREDIT" in row_str.upper():
                                credit = abs(amt)
                            else:
                                debit = abs(amt)
                        elif len(amounts) == 1:
                            bal = amounts[0]

                        rec = ParsedRecord(
                            date_str=iso_date,
                            raw_date=raw_date,
                            description=desc,
                            debit=debit,
                            credit=credit,
                            balance=bal,
                            confidence=0.98,
                            source_page=page.page_number,
                            row_index=row_counter
                        )
                        records.append(rec)
                        row_counter += 1

        # Line fallback
        if not records:
            date_regex = re.compile(r"^(\d{2}[/-]\d{2}[/-]\d{2,4})\s+(.+)$")
            amount_pattern = re.compile(r"([0-9,]+\.\d{2})")

            for line_str, page_num in all_lines:
                m = date_regex.match(line_str)
                if m:
                    iso_dt, raw_dt = self.normalize_date(m.group(1))
                    rest = m.group(2).strip()
                    amounts = amount_pattern.findall(rest)
                    if len(amounts) >= 2 and iso_dt:
                        bal_val = self.clean_amount_str(amounts[-1]) or Decimal("0.00")
                        debit_val = Decimal("0.00")
                        credit_val = Decimal("0.00")

                        first_amt_pos = rest.find(amounts[0])
                        narration = rest[:first_amt_pos].strip()

                        if len(amounts) >= 3:
                            debit_val = self.clean_amount_str(amounts[-3]) or Decimal("0.00")
                            credit_val = self.clean_amount_str(amounts[-2]) or Decimal("0.00")
                        else:
                            amt_val = self.clean_amount_str(amounts[0]) or Decimal("0.00")
                            if any(k in narration.upper() for k in ("CR", "CREDIT", "SALARY", "REFUND", "DEP")):
                                credit_val = amt_val
                            else:
                                debit_val = amt_val

                        rec = ParsedRecord(
                            date_str=iso_dt,
                            raw_date=raw_dt,
                            description=narration if narration else "Transaction",
                            debit=debit_val,
                            credit=credit_val,
                            balance=bal_val,
                            confidence=0.92,
                            source_page=page_num,
                            row_index=row_counter
                        )
                        records.append(rec)
                        row_counter += 1
                    else:
                        unparsed_lines.append(f"Page {page_num}: {line_str}")
                else:
                    if records and len(line_str) > 3 and not any(h in line_str.upper() for h in ("KOTAK", "PAGE", "TOTAL")):
                        records[-1].description += f" {line_str}"

        opening_bal = None
        op_match = re.search(r"(?:Opening\s*Balance|B/F)[:\s]+([0-9,]+\.\d{2})", all_text, re.IGNORECASE)
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
