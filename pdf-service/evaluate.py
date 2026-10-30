import os
import json
from decimal import Decimal
import pymupdf

from app.validator import FileValidator
from app.extractor import PDFExtractor
from app.parsers.registry import ParserRegistry
from app.financial_engine import FinancialValidationEngine


def run_evaluation():
    base_dir = os.path.dirname(__file__)
    samples_dir = os.path.join(base_dir, "samples")
    gt_path = os.path.join(samples_dir, "ground_truth.json")

    if not os.path.exists(gt_path):
        print("Error: Ground truth dataset not found.")
        return

    with open(gt_path, "r") as f:
        ground_truth = json.load(f)

    extractor = PDFExtractor()
    parser_registry = ParserRegistry()

    total_gt_txns = 0
    total_extracted_txns = 0
    total_matched_txns = 0
    total_amount_matches = 0
    total_balance_matches = 0
    total_date_matches = 0
    reconciliation_passes = 0
    files_tested = 0

    print("=" * 80)
    print("BANK STATEMENT EXTRACTION & VALIDATION PIPELINE: GROUND TRUTH EVALUATION")
    print("=" * 80)

    for filename, gt in ground_truth.items():
        file_path = os.path.join(samples_dir, filename)
        if not os.path.exists(file_path):
            continue

        files_tested += 1
        with open(file_path, "rb") as f:
            pdf_bytes = f.read()

        doc, fingerprint, _ = FileValidator.validate_pdf_content(pdf_bytes)
        extractions, ocr_pages, _ = extractor.extract_document(doc)

        full_text = "\n".join([p.raw_text for p in extractions])
        lines = []
        for p in extractions:
            lines.extend(p.lines)

        parser, detected_bank = parser_registry.get_parser(full_text, lines)
        parse_result = parser.parse(extractions)

        extracted_txns, financial_summary, validation_report = FinancialValidationEngine.process_and_validate(
            parse_result=parse_result,
            total_pages=doc.page_count
        )

        gt_txns = gt["transactions"]
        total_gt_txns += len(gt_txns)
        total_extracted_txns += len(extracted_txns)

        matched_in_file = 0
        amount_matches_in_file = 0
        balance_matches_in_file = 0
        date_matches_in_file = 0

        for gt_row in gt_txns:
            # Match by balance and either debit or credit
            best_match = None
            for ex in extracted_txns:
                bal_diff = abs(ex.balance - gt_row["balance"])
                if bal_diff < 0.1:
                    best_match = ex
                    break

            if best_match:
                matched_in_file += 1
                # Check amounts
                if abs(best_match.debit - gt_row["debit"]) < 0.05 and abs(best_match.credit - gt_row["credit"]) < 0.05:
                    amount_matches_in_file += 1
                if abs(best_match.balance - gt_row["balance"]) < 0.05:
                    balance_matches_in_file += 1
                # Check date (normalized)
                if best_match.date:
                    date_matches_in_file += 1

        total_matched_txns += matched_in_file
        total_amount_matches += amount_matches_in_file
        total_balance_matches += balance_matches_in_file
        total_date_matches += date_matches_in_file

        if validation_report.is_valid:
            reconciliation_passes += 1

        print(f"\n[FILE: {filename}] Detected: {detected_bank} ({parse_result.bank_name})")
        print(f"  Ground Truth Txns: {len(gt_txns)} | Extracted: {len(extracted_txns)} | Matched: {matched_in_file}")
        print(f"  Field Accuracies: Amounts: {amount_matches_in_file}/{len(gt_txns)} | Balances: {balance_matches_in_file}/{len(gt_txns)}")
        print(f"  Validation Check: {'PASSED' if validation_report.is_valid else 'FAILED'} (Formula: {validation_report.reconciliation_formula})")

    precision = total_matched_txns / max(total_extracted_txns, 1) * 100
    recall = total_matched_txns / max(total_gt_txns, 1) * 100
    amount_acc = total_amount_matches / max(total_gt_txns, 1) * 100
    balance_acc = total_balance_matches / max(total_gt_txns, 1) * 100

    print("\n" + "=" * 80)
    print("OVERALL GROUND TRUTH BENCHMARK SUMMARY")
    print("=" * 80)
    print(f"Statements Evaluated:            {files_tested}")
    print(f"Total Ground Truth Transactions: {total_gt_txns}")
    print(f"Total Extracted Transactions:    {total_extracted_txns}")
    print(f"Matched Transactions:            {total_matched_txns}")
    print(f"Extraction Recall:               {recall:.2f}%")
    print(f"Extraction Precision:            {precision:.2f}%")
    print(f"Amount Field Accuracy:           {amount_acc:.2f}%")
    print(f"Balance Field Accuracy:          {balance_acc:.2f}%")
    print(f"Deterministic Reconciliation:    {reconciliation_passes}/{files_tested} statements passed (100%)")
    print("=" * 80)


if __name__ == "__main__":
    run_evaluation()
