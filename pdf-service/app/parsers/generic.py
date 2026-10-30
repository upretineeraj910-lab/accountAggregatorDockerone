import re
from typing import List, Any, Optional, Dict
from decimal import Decimal
from app.parsers.base import BaseStatementParser, ParseResult, ParsedRecord


class GenericBankParser(BaseStatementParser):
    """
    Intelligent fallback parser for Indian bank statements of arbitrary layouts.
    Uses column header heuristics, regex tokenization, and multiline narration preservation.
    """

    BANK_NAME = "Standard Bank Statement"

    def can_parse(self, text: str, lines: List[str]) -> bool:
        # Fallback parser can always parse
        return True

    def _infer_column_mapping(self, header_row: List[str]) -> Dict[str, int]:
        mapping = {}
        for idx, col in enumerate(header_row):
            if not col:
                continue
            c = str(col).strip().upper()
            if "DATE" in c and "VAL" not in c and "date" not in mapping:
                mapping["date"] = idx
            elif any(w in c for w in ("NARRATION", "DESCRIPTION", "PARTICULARS", "REMARKS", "TRANSACTION DETAILS")):
                mapping["description"] = idx
            elif any(w in c for w in ("WITHDRAWAL", "DEBIT", "DR AMT", "DR.")):
                mapping["debit"] = idx
            elif any(w in c for w in ("DEPOSIT", "CREDIT", "CR AMT", "CR.")):
                mapping["credit"] = idx
            elif any(w in c for w in ("BALANCE", "CLOSING", "BAL")):
                mapping["balance"] = idx
            elif any(w in c for w in ("CHQ", "CHEQUE", "REF", "UTR", "TRANSACTION ID")):
                mapping["reference"] = idx

        return mapping

    def parse(self, extractions: List[Any]) -> ParseResult:
        all_text = "\n".join([page.raw_text for page in extractions])
        all_lines = []
        for p in extractions:
            all_lines.extend([(line, p.page_number) for line in p.lines])

        # 1. Detect Bank Name from text
        detected_bank = "Generic Indian Bank"
        bank_signatures = {
            "HDFC Bank": ["HDFC BANK", "HDFCBANK"],
            "ICICI Bank": ["ICICI BANK", "ICICIBANK"],
            "State Bank of India": ["STATE BANK OF INDIA", "SBIN", "SBI"],
            "Axis Bank": ["AXIS BANK", "UTIB"],
            "Kotak Mahindra Bank": ["KOTAK MAHINDRA", "KOTAK BANK"],
            "Punjab National Bank": ["PUNJAB NATIONAL BANK", "PNB"],
            "Bank of Baroda": ["BANK OF BARODA", "BOB"],
            "Canara Bank": ["CANARA BANK"],
            "Union Bank of India": ["UNION BANK OF INDIA"],
            "IDFC FIRST Bank": ["IDFC FIRST", "IDFC BANK"],
            "IndusInd Bank": ["INDUSIND BANK"],
            "Yes Bank": ["YES BANK"],
            "Federal Bank": ["FEDERAL BANK"],
        }
        text_upper = all_text.upper()
        for b_name, sigs in bank_signatures.items():
            if any(s in text_upper for s in sigs):
                detected_bank = b_name
                break

        # 2. Extract metadata
        acc_no = None
        acc_match = re.search(r"(?:Account\s*No\.?|A/C\s*No\.?|Account\s*Number)[:\s]+([0-9]{9,18})", all_text, re.IGNORECASE)
        if acc_match:
            acc_no = acc_match.group(1)

        holder_name = None
        name_match = re.search(r"(?:Name|Customer\s*Name|Account\s*Name)[:\s]+([A-Z\s\.]{3,40})", all_text, re.IGNORECASE)
        if name_match:
            holder_name = name_match.group(1).strip()

        period_start = None
        period_end = None
        period_match = re.search(
            r"(?:From|Period|Statement\s*Period)[:\s]+(\d{1,2}[/-]\w{1,3}[/-]\d{2,4}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\s+(?:To|-)\s+(\d{1,2}[/-]\w{1,3}[/-]\d{2,4}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})",
            all_text,
            re.IGNORECASE
        )
        if period_match:
            period_start, _ = self.normalize_date(period_match.group(1))
            period_end, _ = self.normalize_date(period_match.group(2))

        records: List[ParsedRecord] = []
        unparsed_lines: List[str] = []
        row_counter = 0

        # Attempt 1: PyMuPDF table extraction
        for page in extractions:
            for table in page.tables:
                if not table or len(table) < 2:
                    continue
                col_map = self._infer_column_mapping([str(c) for c in table[0]])
                if "date" in col_map and ("balance" in col_map or "debit" in col_map or "credit" in col_map):
                    for row in table[1:]:
                        if not row:
                            continue
                        date_idx = col_map.get("date", 0)
                        if date_idx >= len(row):
                            continue
                        iso_date, raw_date = self.normalize_date(str(row[date_idx]))
                        if not iso_date:
                            continue

                        desc_idx = col_map.get("description", 1 if len(row) > 1 else 0)
                        desc = str(row[desc_idx]).strip() if desc_idx < len(row) else "Transaction"

                        ref_idx = col_map.get("reference")
                        ref = str(row[ref_idx]).strip() if ref_idx is not None and ref_idx < len(row) else None

                        debit = Decimal("0.00")
                        credit = Decimal("0.00")
                        bal = Decimal("0.00")

                        if "debit" in col_map and col_map["debit"] < len(row):
                            d_val = self.clean_amount_str(str(row[col_map["debit"]]))
                            if d_val:
                                debit = abs(d_val)

                        if "credit" in col_map and col_map["credit"] < len(row):
                            c_val = self.clean_amount_str(str(row[col_map["credit"]]))
                            if c_val:
                                credit = abs(c_val)

                        if "balance" in col_map and col_map["balance"] < len(row):
                            b_val = self.clean_amount_str(str(row[col_map["balance"]]))
                            if b_val:
                                bal = b_val

                        # Fallback if debit/credit columns were combined in single Amount column
                        if debit == 0 and credit == 0 and len(row) > 2:
                            for c_idx in range(len(row)):
                                if c_idx not in (date_idx, desc_idx, col_map.get("balance", -1)):
                                    v = self.clean_amount_str(str(row[c_idx]))
                                    if v and v != 0:
                                        row_text = " ".join(str(x) for x in row).upper()
                                        if "CR" in row_text or "CREDIT" in row_text:
                                            credit = abs(v)
                                        else:
                                            debit = abs(v)
                                        break

                        rec = ParsedRecord(
                            date_str=iso_date,
                            raw_date=raw_date,
                            description=desc,
                            debit=debit,
                            credit=credit,
                            balance=bal,
                            reference_number=ref,
                            confidence=0.95,
                            source_page=page.page_number,
                            row_index=row_counter
                        )
                        records.append(rec)
                        row_counter += 1

        # Attempt 2: Regex line-by-line fallback
        if not records:
            date_prefix_regex = re.compile(
                r"^(\d{1,2}[/-]\w{1,3}[/-]\d{2,4}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2})\s+(.+)$"
            )
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

                        first_amt_pos = rest.find(amounts[0])
                        narration = rest[:first_amt_pos].strip()

                        if len(amounts) >= 3:
                            debit_val = abs(self.clean_amount_str(amounts[-3]) or Decimal("0.00"))
                            credit_val = abs(self.clean_amount_str(amounts[-2]) or Decimal("0.00"))
                            bal_val = self.clean_amount_str(amounts[-1]) or Decimal("0.00")
                        elif len(amounts) == 2:
                            amt_val = abs(self.clean_amount_str(amounts[0]) or Decimal("0.00"))
                            bal_val = self.clean_amount_str(amounts[1]) or Decimal("0.00")
                            if any(k in narration.upper() for k in ("CR", "CREDIT", "SALARY", "REFUND", "DEP", "INTEREST")):
                                credit_val = amt_val
                            else:
                                debit_val = amt_val
                        else:
                            # 1 amount
                            bal_val = self.clean_amount_str(amounts[0]) or Decimal("0.00")

                        rec = ParsedRecord(
                            date_str=iso_dt,
                            raw_date=raw_dt,
                            description=narration if narration else "Transaction",
                            debit=debit_val,
                            credit=credit_val,
                            balance=bal_val,
                            confidence=0.90,
                            source_page=page_num,
                            row_index=row_counter
                        )
                        records.append(rec)
                        row_counter += 1
                    else:
                        unparsed_lines.append(f"Page {page_num}: {line_str}")
                else:
                    # Append multiline description
                    if records and len(line_str) > 2:
                        upper = line_str.upper()
                        # Avoid appending page numbers, footers, headers
                        if not any(h in upper for h in ("PAGE", "ACCOUNT", "STATEMENT", "TOTAL", "BALANCE B/F")):
                            records[-1].description += f" {line_str}"

        opening_bal = None
        op_match = re.search(r"(?:Opening\s*Balance|B/F|Bal\s*b/f)[:\s]+([0-9,]+\.\d{2})", all_text, re.IGNORECASE)
        if op_match:
            opening_bal = self.clean_amount_str(op_match.group(1))

        closing_bal = records[-1].balance if records else None

        return ParseResult(
            bank_name=detected_bank,
            records=records,
            account_number_masked=self.mask_account_number(acc_no),
            account_holder_name=holder_name,
            opening_balance=opening_bal,
            closing_balance=closing_bal,
            statement_period_start=period_start,
            statement_period_end=period_end,
            unparsed_lines=unparsed_lines
        )
