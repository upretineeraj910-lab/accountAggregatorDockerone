import time
from datetime import datetime
from typing import Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.schemas import (
    ProcessStatementResponse,
    StatementMetadata,
    ProcessingLogEntry,
    ServiceHealthResponse,
)
from app.validator import FileValidator, PDFValidationError
from app.extractor import PDFExtractor
from app.ocr import OCRService
from app.doc_api_adapter import DocumentProcessingAdapter
from app.parsers.registry import ParserRegistry
from app.financial_engine import FinancialValidationEngine


app = FastAPI(
    title="Bank Statement Processing Service",
    description="High-performance, deterministic Indian bank statement extraction & validation microservice",
    version="1.0.0"
)

# Enable CORS for local Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ocr_service = OCRService()
doc_adapter = DocumentProcessingAdapter()
parser_registry = ParserRegistry()
extractor = PDFExtractor(ocr_service=ocr_service)


def create_log(stage: str, msg: str, status: str = "completed") -> ProcessingLogEntry:
    return ProcessingLogEntry(
        timestamp=datetime.utcnow().isoformat() + "Z",
        stage=stage,
        status=status,
        message=msg
    )


@app.get("/health", response_model=ServiceHealthResponse)
def health_check():
    ocr_avail, ocr_reason = ocr_service.check_availability()
    adapter_status = doc_adapter.get_status_summary()

    return ServiceHealthResponse(
        status="healthy",
        version="1.0.0",
        ocr_available=ocr_avail,
        ocr_engine=ocr_reason,
        doc_api_adapter_configured=adapter_status["is_configured"],
        doc_api_provider=adapter_status["provider"]
    )


@app.get("/settings")
def get_service_settings():
    ocr_avail, ocr_reason = ocr_service.check_availability()
    adapter_status = doc_adapter.get_status_summary()

    return {
        "service": "Bank Statement PDF Processing Engine",
        "version": "1.0.0",
        "ocr": {
            "enabled": ocr_service.enabled,
            "available": ocr_avail,
            "details": ocr_reason
        },
        "document_processing_api": adapter_status,
        "supported_banks": [
            "HDFC Bank",
            "ICICI Bank",
            "State Bank of India",
            "Axis Bank",
            "Kotak Mahindra Bank",
            "Generic Indian Statement Layouts"
        ],
        "validation_engine": {
            "mode": "deterministic",
            "precision": "decimal-safe",
            "tolerance_paise": 5
        }
    }


@app.post("/process", response_model=ProcessStatementResponse)
async def process_bank_statement(
    file: UploadFile = File(...),
    password: Optional[str] = Form(None)
):
    """
    Main processing pipeline:
    1. File Validation
    2. PDF Text & Layout Extraction
    3. OCR Check / Fallback
    4. Transaction Parsing
    5. Data Normalization
    6. Financial Balance Validation
    7. Analysis Completion
    """
    logs = []

    # Read uploaded bytes
    try:
        file_bytes = await file.read()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to read file stream: {str(e)}"
        )

    # Stage 1: File Validation
    t0 = time.time()
    try:
        doc, fingerprint, was_pw_used = FileValidator.validate_pdf_content(
            file_bytes=file_bytes,
            filename=file.filename,
            password=password
        )
    except PDFValidationError as ve:
        raise HTTPException(
            status_code=getattr(status, "HTTP_422_UNPROCESSABLE_CONTENT", 422),
            detail={"code": ve.code, "message": ve.message}
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error during PDF validation: {str(e)}"
        )

    logs.append(create_log(
        stage="file_validation",
        msg=f"Validated PDF format ({len(file_bytes)} bytes, {doc.page_count} pages). Fingerprint: {fingerprint[:8]}..."
    ))

    # Stage 2 & 3: PDF Text Extraction & OCR
    try:
        extractions, ocr_pages, ocr_warnings = extractor.extract_document(doc)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Text extraction failed: {str(e)}"
        )

    logs.append(create_log(
        stage="pdf_text_extraction",
        msg=f"Extracted content across {len(extractions)} pages."
    ))

    if ocr_pages:
        logs.append(create_log(
            stage="ocr_fallback",
            msg=f"Applied OCR to pages: {ocr_pages}."
        ))
    else:
        logs.append(create_log(
            stage="ocr_check",
            msg="Native selectable text verified. No OCR fallback required."
        ))

    # Stage 4: Transaction Parsing
    full_text = "\n".join([page.raw_text for page in extractions])
    all_lines = []
    for p in extractions:
        all_lines.extend(p.lines)

    selected_parser, detected_bank = parser_registry.get_parser(full_text, all_lines)
    logs.append(create_log(
        stage="transaction_parsing",
        msg=f"Selected parser: {detected_bank} ({selected_parser.__class__.__name__})."
    ))

    try:
        parse_result = selected_parser.parse(extractions)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Parser execution error: {str(e)}"
        )

    # Stage 5 & 6: Data Normalization and Financial Validation Engine
    logs.append(create_log(
        stage="data_normalization",
        msg=f"Normalized {len(parse_result.records)} raw records into standard schema."
    ))

    normalized_txns, financial_summary, validation_report = FinancialValidationEngine.process_and_validate(
        parse_result=parse_result,
        total_pages=doc.page_count
    )

    logs.append(create_log(
        stage="balance_validation",
        msg=f"Deterministic balance verification: {'Passed' if validation_report.is_valid else 'Warnings/Discrepancies found'}."
    ))

    logs.append(create_log(
        stage="analysis_completion",
        msg=f"Completed statement analysis in {time.time() - t0:.2f}s."
    ))

    metadata = StatementMetadata(
        bank_name=parse_result.bank_name,
        detected_bank=detected_bank,
        account_number_masked=parse_result.account_number_masked,
        account_holder_name=parse_result.account_holder_name,
        statement_period_start=financial_summary.start_date,
        statement_period_end=financial_summary.end_date,
        currency="INR",
        page_count=doc.page_count,
        is_encrypted=was_pw_used or doc.is_encrypted,
        ocr_applied=len(ocr_pages) > 0,
        ocr_pages=ocr_pages
    )

    return ProcessStatementResponse(
        status="success",
        statement_metadata=metadata,
        transactions=normalized_txns,
        financial_summary=financial_summary,
        validation_report=validation_report,
        processing_logs=logs,
        raw_unparsed_lines=parse_result.unparsed_lines,
        content_fingerprint=fingerprint
    )
