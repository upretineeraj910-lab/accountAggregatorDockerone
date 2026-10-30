import hashlib
import os
import pymupdf
from typing import Tuple, Optional


class PDFValidationError(Exception):
    def __init__(self, message: str, code: str = "INVALID_PDF"):
        super().__init__(message)
        self.message = message
        self.code = code


class FileValidator:
    MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024  # 25 MB default limit
    MIN_FILE_SIZE_BYTES = 100  # Minimum valid PDF size

    @staticmethod
    def compute_sha256(file_bytes: bytes) -> str:
        """Compute SHA-256 content fingerprint for duplicate detection without exposing raw file paths."""
        return hashlib.sha256(file_bytes).hexdigest()

    @classmethod
    def validate_pdf_content(
        cls,
        file_bytes: bytes,
        filename: Optional[str] = None,
        password: Optional[str] = None,
        max_size_bytes: Optional[int] = None,
    ) -> Tuple[pymupdf.Document, str, bool]:
        """
        Validates the PDF content.
        Returns:
            Tuple of (pymupdf.Document, content_fingerprint, was_password_used)
        Raises:
            PDFValidationError: if file is invalid, oversized, corrupted, or password required.
        """
        max_allowed = max_size_bytes or cls.MAX_FILE_SIZE_BYTES

        # 1. Size check
        if len(file_bytes) > max_allowed:
            raise PDFValidationError(
                f"File size ({len(file_bytes) / (1024*1024):.2f} MB) exceeds maximum allowed limit of {max_allowed / (1024*1024):.1f} MB.",
                code="FILE_TOO_LARGE"
            )

        if len(file_bytes) < cls.MIN_FILE_SIZE_BYTES:
            raise PDFValidationError(
                "Uploaded file is empty or too small to be a valid PDF document.",
                code="FILE_TOO_SMALL"
            )

        # 2. Magic bytes check
        # Standard PDF files start with %PDF- (hex: 25 50 44 46 2d) within the first 1024 bytes
        header_sample = file_bytes[:1024]
        if b"%PDF-" not in header_sample:
            raise PDFValidationError(
                "Uploaded file is not a valid PDF. Expected PDF magic header '%PDF-'.",
                code="INVALID_HEADER"
            )

        # 3. Content fingerprint for deduplication
        fingerprint = cls.compute_sha256(file_bytes)

        # 4. Open document safely with PyMuPDF
        try:
            doc = pymupdf.open(stream=file_bytes, filetype="pdf")
        except Exception as e:
            raise PDFValidationError(
                f"Corrupted PDF structure: Unable to parse document stream ({str(e)}).",
                code="CORRUPTED_PDF"
            )

        # 5. Password protection check
        was_password_used = False
        if doc.is_encrypted:
            if not password:
                raise PDFValidationError(
                    "This PDF bank statement is password-protected. Please provide the statement password to unlock and analyze.",
                    code="PASSWORD_REQUIRED"
                )
            # Attempt to authenticate
            auth_success = doc.authenticate(password)
            if not auth_success:
                raise PDFValidationError(
                    "Incorrect password provided. Could not decrypt the bank statement.",
                    code="INVALID_PASSWORD"
                )
            was_password_used = True

        # 6. Page count verification
        if doc.page_count < 1:
            raise PDFValidationError(
                "The PDF document does not contain any readable pages.",
                code="EMPTY_DOCUMENT"
            )

        return doc, fingerprint, was_password_used
