import os
import pytest
from decimal import Decimal

from app.validator import FileValidator, PDFValidationError
from app.extractor import PDFExtractor
from app.parsers.base import BaseStatementParser
from app.parsers.registry import ParserRegistry
from app.classifier import TransactionClassifier
from app.financial_engine import FinancialValidationEngine


SAMPLES_DIR = os.path.join(os.path.dirname(__file__), "..", "samples")


def test_amount_cleaning():
    """Verify Indian currency and international number parsing with decimal precision."""
    assert BaseStatementParser.clean_amount_str("1,23,456.78") == Decimal("123456.78")
    assert BaseStatementParser.clean_amount_str("INR 45,000.00 Cr") == Decimal("45000.00")
    assert BaseStatementParser.clean_amount_str("₹ 2,500.50 Dr") == Decimal("-2500.50")
    assert BaseStatementParser.clean_amount_str("(10,000.00)") == Decimal("-10000.00")
    assert BaseStatementParser.clean_amount_str(" - ") == Decimal("0.00")
    assert BaseStatementParser.clean_amount_str("Nil") == Decimal("0.00")


def test_date_normalization():
    """Verify various Indian bank date formats normalize to ISO YYYY-MM-DD."""
    assert BaseStatementParser.normalize_date("01/10/2026")[0] == "2026-10-01"
    assert BaseStatementParser.normalize_date("15-09-2026")[0] == "2026-09-15"
    assert BaseStatementParser.normalize_date("12 Oct 2026")[0] == "2026-10-12"
    assert BaseStatementParser.normalize_date("05-Nov-26")[0] == "2026-11-05"


def test_transaction_classification():
    """Verify deterministic rule-based classifications."""
    # Salary
    cat, conf = TransactionClassifier.classify("SALARY CREDIT TECH CORP OCT 2026", Decimal("0.00"), Decimal("85000.00"))
    assert cat == "salary"
    assert conf >= 0.90

    # EMI
    cat, conf = TransactionClassifier.classify("ACH/HDFC LOAN SERVICES EMI 9283", Decimal("24500.00"), Decimal("0.00"))
    assert cat == "emi_loan"

    # UPI
    cat, conf = TransactionClassifier.classify("UPI/62718291029/SWIGGY FOOD ORDER", Decimal("640.00"), Decimal("0.00"))
    assert cat == "upi"

    # Cash Withdrawal
    cat, conf = TransactionClassifier.classify("ATM WDL/HDFC BANDRA BR/ATM CASH", Decimal("5000.00"), Decimal("0.00"))
    assert cat == "cash_withdrawal"

    # Bank Charges
    cat, conf = TransactionClassifier.classify("SMS CHG AND ANNUAL DEBIT CARD FEE", Decimal("236.00"), Decimal("0.00"))
    assert cat == "bank_charges"

    # Refund
    cat, conf = TransactionClassifier.classify("UPI/82716253421/AMAZON INDIA REFUND", Decimal("0.00"), Decimal("1299.00"))
    assert cat == "refund"


def test_encrypted_pdf_handling():
    """Test password protection detection, failure on wrong password, and success on correct password."""
    enc_path = os.path.join(SAMPLES_DIR, "encrypted_sample.pdf")
    with open(enc_path, "rb") as f:
        file_bytes = f.read()

    # 1. No password provided
    with pytest.raises(PDFValidationError) as exc_info:
        FileValidator.validate_pdf_content(file_bytes)
    assert exc_info.value.code == "PASSWORD_REQUIRED"

    # 2. Wrong password provided
    with pytest.raises(PDFValidationError) as exc_info:
        FileValidator.validate_pdf_content(file_bytes, password="wrongpassword")
    assert exc_info.value.code == "INVALID_PASSWORD"

    # 3. Correct password provided
    doc, fingerprint, was_pw_used = FileValidator.validate_pdf_content(file_bytes, password="investor2026")
    assert was_pw_used is True
    assert doc.page_count >= 1
    doc.close()


def test_corrupted_pdf_handling():
    """Verify corrupted PDF stream rejection."""
    corrupt_path = os.path.join(SAMPLES_DIR, "corrupted_sample.pdf")
    with open(corrupt_path, "rb") as f:
        file_bytes = f.read()

    with pytest.raises(PDFValidationError) as exc_info:
        FileValidator.validate_pdf_content(file_bytes)
    assert exc_info.value.code == "CORRUPTED_PDF"


def test_full_pipeline_hdfc():
    """End-to-end extraction and validation check on HDFC sample statement."""
    pdf_path = os.path.join(SAMPLES_DIR, "hdfc_sample.pdf")
    with open(pdf_path, "rb") as f:
        file_bytes = f.read()

    doc, fingerprint, _ = FileValidator.validate_pdf_content(file_bytes)
    extractions, _, _ = PDFExtractor().extract_document(doc)

    full_text = "\n".join([p.raw_text for p in extractions])
    lines = []
    for p in extractions:
        lines.extend(p.lines)

    parser, bank = ParserRegistry().get_parser(full_text, lines)
    assert "HDFC" in bank

    parse_result = parser.parse(extractions)
    assert parse_result.account_holder_name == "ARJUN VIKRAM MEHTA"
    assert "50100492817264" in (parse_result.account_number_masked or "") or "XXXX" in (parse_result.account_number_masked or "")

    txns, summary, report = FinancialValidationEngine.process_and_validate(parse_result, doc.page_count)
    assert len(txns) == 9
    assert report.is_valid is True
    assert summary.total_credits == 86711.0
    assert summary.closing_balance == 61495.0
    doc.close()
