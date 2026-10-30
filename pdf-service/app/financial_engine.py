from decimal import Decimal, ROUND_HALF_UP
from typing import List, Dict, Any, Optional, Tuple
from collections import defaultdict
from datetime import datetime

from app.schemas import (
    Transaction,
    ValidationReport,
    CheckResult,
    FinancialSummary,
    MonthlyMetric,
    CategorySummary
)
from app.parsers.base import ParsedRecord, ParseResult
from app.classifier import TransactionClassifier


class FinancialValidationEngine:
    """
    Deterministic financial calculations and multi-stage arithmetic validation engine.
    Uses Python Decimal for exact currency precision.
    """

    TOLERANCE = Decimal("0.05")  # 5 paise tolerance for currency rounding differences

    @classmethod
    def process_and_validate(
        cls,
        parse_result: ParseResult,
        total_pages: int
    ) -> Tuple[List[Transaction], FinancialSummary, ValidationReport]:
        """
        Processes raw parsed records into normalized transactions,
        computes financial summaries, and executes validation checks.
        """
        raw_records = parse_result.records
        normalized_txns: List[Transaction] = []
        checks: List[CheckResult] = []

        total_credits = Decimal("0.00")
        total_debits = Decimal("0.00")
        balances: List[Decimal] = []

        # 1. Normalize transactions and apply classification
        for idx, rec in enumerate(raw_records):
            category, conf = TransactionClassifier.classify(
                rec.description, rec.debit, rec.credit
            )

            txn = Transaction(
                id=f"txn_{idx + 1}",
                date=rec.date_str,
                raw_date=rec.raw_date,
                description=rec.description,
                reference_number=rec.reference_number,
                debit=float(rec.debit),
                credit=float(rec.credit),
                balance=float(rec.balance),
                currency="INR",
                category=category,
                confidence=round(rec.confidence * conf, 2),
                source_page=rec.source_page,
                row_index=idx
            )
            normalized_txns.append(txn)
            total_credits += rec.credit
            total_debits += rec.debit
            balances.append(rec.balance)

        # 2. Extract or infer Opening / Closing balances
        opening_bal = parse_result.opening_balance
        closing_bal = parse_result.closing_balance

        if closing_bal is None and normalized_txns:
            closing_bal = Decimal(str(normalized_txns[-1].balance))

        # If opening balance wasn't explicitly stated in the header,
        # infer from first transaction:
        # first_txn.balance = opening_bal + first_txn.credit - first_txn.debit
        # => opening_bal = first_txn.balance - first_txn.credit + first_txn.debit
        inferred_opening_bal = None
        if normalized_txns:
            first_txn = normalized_txns[0]
            first_bal = Decimal(str(first_txn.balance))
            first_cr = Decimal(str(first_txn.credit))
            first_dr = Decimal(str(first_txn.debit))
            inferred_opening_bal = first_bal - first_cr + first_dr

        authoritative_opening = opening_bal if opening_bal is not None else inferred_opening_bal

        # -------------------------------------------------------------
        # VALIDATION CHECKS
        # -------------------------------------------------------------

        # Check 1: Empty statement check
        if not normalized_txns:
            checks.append(CheckResult(
                check_name="Transaction Coverage",
                status="warning",
                message="No transactions could be parsed from the document.",
                details={"transaction_count": 0}
            ))
        else:
            checks.append(CheckResult(
                check_name="Transaction Coverage",
                status="passed",
                message=f"Extracted {len(normalized_txns)} transactions across {total_pages} page(s).",
                details={"transaction_count": len(normalized_txns)}
            ))

        # Check 2: Missing Dates or Amounts
        missing_dates = [t.row_index for t in normalized_txns if not t.date]
        zero_amount_txns = [t.row_index for t in normalized_txns if t.debit == 0 and t.credit == 0]

        if missing_dates:
            checks.append(CheckResult(
                check_name="Field Completeness: Transaction Dates",
                status="failed",
                message=f"Found {len(missing_dates)} transactions with missing or unparseable dates.",
                details={"row_indices": missing_dates}
            ))
        else:
            checks.append(CheckResult(
                check_name="Field Completeness: Transaction Dates",
                status="passed",
                message="All extracted transactions possess valid dates.",
            ))

        if zero_amount_txns:
            checks.append(CheckResult(
                check_name="Field Completeness: Transaction Amounts",
                status="warning",
                message=f"Found {len(zero_amount_txns)} transactions with zero debit and zero credit (memo entries or bank notifications).",
                details={"row_indices": zero_amount_txns}
            ))
        else:
            checks.append(CheckResult(
                check_name="Field Completeness: Transaction Amounts",
                status="passed",
                message="All extracted transactions have non-zero monetary amounts.",
            ))

        # Check 3: Chronological ordering
        chronological_issues = 0
        for i in range(1, len(normalized_txns)):
            try:
                prev_d = datetime.strptime(normalized_txns[i - 1].date, "%Y-%m-%d")
                curr_d = datetime.strptime(normalized_txns[i].date, "%Y-%m-%d")
                if curr_d < prev_d:
                    chronological_issues += 1
            except Exception:
                pass

        if chronological_issues > 0:
            checks.append(CheckResult(
                check_name="Chronological Consistency",
                status="warning",
                message=f"Detected {chronological_issues} instances where transactions appear out of strict chronological sequence.",
                details={"out_of_order_count": chronological_issues}
            ))
        else:
            checks.append(CheckResult(
                check_name="Chronological Consistency",
                status="passed",
                message="Transactions follow a consistent chronological timeline.",
            ))

        # Check 4: Duplicate transaction candidates
        seen_txns = defaultdict(list)
        for t in normalized_txns:
            # Key based on date + amount + description prefix
            key = (t.date, t.debit, t.credit, t.description[:30].strip().upper())
            seen_txns[key].append(t.row_index)

        duplicates = [rows for rows in seen_txns.values() if len(rows) > 1]
        dup_count = sum(len(r) - 1 for r in duplicates)
        if dup_count > 0:
            checks.append(CheckResult(
                check_name="Duplicate Detection",
                status="warning",
                message=f"Identified {dup_count} potential duplicate transaction candidate(s) sharing identical date, amount, and narration.",
                details={"potential_duplicates": duplicates}
            ))
        else:
            checks.append(CheckResult(
                check_name="Duplicate Detection",
                status="passed",
                message="No duplicate transactions detected.",
            ))

        # Check 5: Running Balance Consistency (Row by row)
        running_bal_failures = []
        if len(normalized_txns) > 1:
            for i in range(1, len(normalized_txns)):
                prev_b = Decimal(str(normalized_txns[i - 1].balance))
                cr = Decimal(str(normalized_txns[i].credit))
                dr = Decimal(str(normalized_txns[i].debit))
                expected_b = prev_b + cr - dr
                actual_b = Decimal(str(normalized_txns[i].balance))

                diff = abs(actual_b - expected_b)
                if diff > cls.TOLERANCE:
                    running_bal_failures.append({
                        "row_index": normalized_txns[i].row_index,
                        "date": normalized_txns[i].date,
                        "previous_balance": float(prev_b),
                        "credit": float(cr),
                        "debit": float(dr),
                        "expected_balance": float(expected_b),
                        "actual_balance": float(actual_b),
                        "discrepancy": float(diff)
                    })

        if running_bal_failures:
            checks.append(CheckResult(
                check_name="Running Balance Verification",
                status="failed",
                message=f"Running balance mismatch in {len(running_bal_failures)} row(s).",
                details={"mismatches": running_bal_failures[:5]}  # report up to 5
            ))
        elif len(normalized_txns) > 1:
            checks.append(CheckResult(
                check_name="Running Balance Verification",
                status="passed",
                message="Every transaction running balance mathematically reconciles with previous row balance + credit - debit.",
            ))
        else:
            checks.append(CheckResult(
                check_name="Running Balance Verification",
                status="unverifiable",
                message="Insufficient rows to evaluate incremental running balance progression.",
            ))

        # Check 6: Mathematical Reconciliation Formula:
        # Opening balance + total credits - total debits = closing balance
        reconciliation_formula = None
        discrepancy_amount = None
        if authoritative_opening is not None and closing_bal is not None:
            expected_closing = authoritative_opening + total_credits - total_debits
            diff = abs(closing_bal - expected_closing)
            discrepancy_amount = float(diff)

            reconciliation_formula = (
                f"{authoritative_opening:,.2f} (Opening) + "
                f"{total_credits:,.2f} (Credits) - "
                f"{total_debits:,.2f} (Debits) = "
                f"{expected_closing:,.2f} (Expected) vs {closing_bal:,.2f} (Closing)"
            )

            if diff <= cls.TOLERANCE:
                checks.append(CheckResult(
                    check_name="Mathematical Reconciliation",
                    status="passed",
                    message="Statement perfectly balances: Opening Balance + Total Credits - Total Debits = Closing Balance.",
                    details={"formula": reconciliation_formula, "discrepancy": 0.0}
                ))
            else:
                checks.append(CheckResult(
                    check_name="Mathematical Reconciliation",
                    status="failed",
                    message=f"Reconciliation discrepancy detected: difference of INR {diff:,.2f}.",
                    details={"formula": reconciliation_formula, "discrepancy": float(diff)}
                ))
        else:
            checks.append(CheckResult(
                check_name="Mathematical Reconciliation",
                status="unverifiable",
                message="Opening or closing balance was not explicitly provided in the statement header.",
            ))

        # Check 7: Unparsed rows check
        unparsed_count = len(parse_result.unparsed_lines)
        if unparsed_count > 0:
            checks.append(CheckResult(
                check_name="Parser Completeness",
                status="warning",
                message=f"{unparsed_count} line(s) could not be parsed into transactions. Preserved in audit record.",
                details={"unparsed_sample": parse_result.unparsed_lines[:5]}
            ))
        else:
            checks.append(CheckResult(
                check_name="Parser Completeness",
                status="passed",
                message="100% of detected transaction rows were successfully parsed.",
            ))

        # Overall validation status
        has_failed = any(c.status == "failed" for c in checks)
        validation_summary = (
            "Statement passed all deterministic financial validation checks."
            if not has_failed
            else "Statement contains validation warnings or arithmetic balance discrepancies. Review details below."
        )

        validation_report = ValidationReport(
            is_valid=not has_failed,
            summary=validation_summary,
            checks=checks,
            discrepancy_amount=discrepancy_amount,
            reconciliation_formula=reconciliation_formula,
            duplicate_candidates_count=dup_count,
            chronological_issues_count=chronological_issues,
            unparsed_rows_count=unparsed_count
        )

        # -------------------------------------------------------------
        # FINANCIAL SUMMARY CALCULATIONS
        # -------------------------------------------------------------
        net_cashflow = total_credits - total_debits

        # Period calculation
        dates = [t.date for t in normalized_txns if t.date]
        start_date = parse_result.statement_period_start or (min(dates) if dates else None)
        end_date = parse_result.statement_period_end or (max(dates) if dates else None)

        # Categorized totals
        category_map = defaultdict(lambda: {"count": 0, "debit": Decimal("0.00"), "credit": Decimal("0.00")})
        monthly_map = defaultdict(lambda: {"credit": Decimal("0.00"), "debit": Decimal("0.00"), "count": 0})

        for t in normalized_txns:
            category_map[t.category]["count"] += 1
            category_map[t.category]["debit"] += Decimal(str(t.debit))
            category_map[t.category]["credit"] += Decimal(str(t.credit))

            month_key = t.date[:7] if len(t.date) >= 7 else "Unknown"
            monthly_map[month_key]["count"] += 1
            monthly_map[month_key]["credit"] += Decimal(str(t.credit))
            monthly_map[month_key]["debit"] += Decimal(str(t.debit))

        # Monthly metrics list
        monthly_metrics = []
        for m_key in sorted(monthly_map.keys()):
            if m_key == "Unknown":
                continue
            m_data = monthly_map[m_key]
            monthly_metrics.append(MonthlyMetric(
                month=m_key,
                total_credit=float(m_data["credit"]),
                total_debit=float(m_data["debit"]),
                net_cashflow=float(m_data["credit"] - m_data["debit"]),
                transaction_count=m_data["count"]
            ))

        # Category summaries
        category_summaries = []
        for cat, data in sorted(category_map.items()):
            category_summaries.append(CategorySummary(
                category=cat,
                count=data["count"],
                total_debit=float(data["debit"]),
                total_credit=float(data["credit"])
            ))

        # Average balance (when sufficient balance points exist)
        avg_balance = None
        if len(balances) >= 2:
            avg_balance = float(sum(balances) / Decimal(str(len(balances))))

        num_months = max(len(monthly_metrics), 1)
        avg_monthly_cr = float(total_credits / Decimal(str(num_months)))
        avg_monthly_dr = float(total_debits / Decimal(str(num_months)))

        # Specific financial buckets
        salary_data = category_map.get("salary", {"credit": Decimal("0.00"), "count": 0})
        emi_data = category_map.get("emi_loan", {"debit": Decimal("0.00"), "count": 0})
        cash_dep_data = category_map.get("cash_deposit", {"credit": Decimal("0.00"), "count": 0})
        cash_wdl_data = category_map.get("cash_withdrawal", {"debit": Decimal("0.00"), "count": 0})
        bank_chg_data = category_map.get("bank_charges", {"debit": Decimal("0.00"), "count": 0})

        financial_summary = FinancialSummary(
            opening_balance=float(authoritative_opening) if authoritative_opening is not None else None,
            closing_balance=float(closing_bal) if closing_bal is not None else None,
            total_credits=float(total_credits),
            total_debits=float(total_debits),
            net_cashflow=float(net_cashflow),
            transaction_count=len(normalized_txns),
            start_date=start_date,
            end_date=end_date,
            avg_monthly_credits=avg_monthly_cr,
            avg_monthly_debits=avg_monthly_dr,
            avg_balance=avg_balance,
            potential_salary_credits=float(salary_data["credit"]),
            potential_salary_count=salary_data["count"],
            potential_emi_debits=float(emi_data["debit"]),
            potential_emi_count=emi_data["count"],
            cash_deposits_total=float(cash_dep_data["credit"]),
            cash_deposits_count=cash_dep_data["count"],
            cash_withdrawals_total=float(cash_wdl_data["debit"]),
            cash_withdrawals_count=cash_wdl_data["count"],
            bank_charges_total=float(bank_chg_data["debit"]),
            bank_charges_count=bank_chg_data["count"],
            monthly_metrics=monthly_metrics,
            category_summaries=category_summaries
        )

        return normalized_txns, financial_summary, validation_report
