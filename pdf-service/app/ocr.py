import os
import shutil
from typing import Optional, Tuple
import pymupdf


class OCRService:
    def __init__(self):
        self.enabled = os.getenv("ENABLE_OCR", "true").lower() in ("true", "1", "yes")
        self.tesseract_cmd = os.getenv("TESSERACT_CMD", None)
        self._is_tesseract_available: Optional[bool] = None

    def check_availability(self) -> Tuple[bool, str]:
        """Check if Tesseract OCR binary is installed and functional."""
        if not self.enabled:
            return False, "OCR is disabled via configuration (ENABLE_OCR=false)."

        if self.tesseract_cmd and os.path.exists(self.tesseract_cmd):
            self._is_tesseract_available = True
            return True, f"Tesseract binary configured at {self.tesseract_cmd}"

        # Check in PATH
        which_tess = shutil.which("tesseract")
        if which_tess:
            self._is_tesseract_available = True
            return True, f"Tesseract found in system PATH ({which_tess})"

        self._is_tesseract_available = False
        return False, "Tesseract OCR engine is not installed or not found in system PATH."

    def extract_text_from_page_pixmap(self, page: pymupdf.Page) -> Tuple[str, bool, Optional[str]]:
        """
        Attempts to render page as high-res image and run OCR if available.
        Returns:
            Tuple of (extracted_text, success_bool, error_message_if_any)
        """
        available, reason = self.check_availability()
        if not available:
            return "", False, reason

        try:
            import pytesseract
            from PIL import Image
            import io

            if self.tesseract_cmd:
                pytesseract.pytesseract.tesseract_cmd = self.tesseract_cmd

            # Render at 300 DPI (zoom=300/72 ≈ 4.16) for high OCR accuracy
            zoom = 300 / 72
            matrix = pymupdf.Matrix(zoom, zoom)
            pix = page.get_pixmap(matrix=matrix)
            img_bytes = pix.tobytes("png")

            image = Image.open(io.BytesIO(img_bytes))
            ocr_text = pytesseract.image_to_string(image, lang="eng")
            return ocr_text, True, None

        except ImportError as ie:
            return "", False, f"pytesseract library not available: {str(ie)}"
        except Exception as e:
            return "", False, f"OCR execution failed: {str(e)}"
