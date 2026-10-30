from collections import defaultdict
from typing import List, Dict, Any, Tuple
import pymupdf
from app.ocr import OCRService


class PageExtraction:
    def __init__(
        self,
        page_number: int,
        raw_text: str,
        lines: List[str],
        tables: List[List[List[str]]],
        is_ocr: bool = False,
        ocr_warning: str = None
    ):
        self.page_number = page_number
        self.raw_text = raw_text
        self.lines = lines
        self.tables = tables
        self.is_ocr = is_ocr
        self.ocr_warning = ocr_warning
        self.char_count = len(raw_text.strip())


class PDFExtractor:
    MIN_TEXT_CHARS_PER_PAGE = 40  # If fewer, page is likely a scanned image

    def __init__(self, ocr_service: OCRService = None):
        self.ocr_service = ocr_service or OCRService()

    @staticmethod
    def _reconstruct_visual_lines(page: pymupdf.Page) -> List[str]:
        """
        Groups words by vertical position (y coordinate) and sorts them horizontally (x coordinate)
        to reconstruct true human-readable visual rows, avoiding column ordering artifacts.
        """
        words = page.get_text("words")
        if not words:
            return []

        rows = defaultdict(list)
        # Cluster words within 4 vertical pixels into the same visual line
        for w in words:
            # w: (x0, y0, x1, y1, word, block_no, line_no, word_no)
            y_center = (w[1] + w[3]) / 2.0
            y_key = round(y_center / 4.0) * 4
            rows[y_key].append(w)

        visual_lines = []
        for y_key in sorted(rows.keys()):
            row_words = sorted(rows[y_key], key=lambda x: x[0])
            line_str = " ".join(w[4] for w in row_words).strip()
            if line_str:
                visual_lines.append(line_str)

        return visual_lines

    def extract_document(self, doc: pymupdf.Document) -> Tuple[List[PageExtraction], List[int], List[str]]:
        """
        Extracts layout, text lines, and tables from all pages in the PDF document.
        Detects scanned pages and invokes OCR when necessary.
        """
        extractions: List[PageExtraction] = []
        ocr_pages: List[int] = []
        warnings: List[str] = []

        for page_idx in range(doc.page_count):
            page_num = page_idx + 1
            page = doc[page_idx]

            # 1. Native text extraction
            text = page.get_text("text") or ""
            clean_text = text.strip()

            # 2. Extract tables natively if available
            extracted_tables: List[List[List[str]]] = []
            try:
                tabs = page.find_tables()
                for tab in tabs:
                    table_data = tab.extract()
                    if table_data:
                        extracted_tables.append(table_data)
            except Exception:
                pass

            # 3. Check if text is sufficient or if page is scanned image
            is_ocr = False
            ocr_warning = None

            if len(clean_text) < self.MIN_TEXT_CHARS_PER_PAGE:
                ocr_text, ocr_ok, ocr_err = self.ocr_service.extract_text_from_page_pixmap(page)
                if ocr_ok and len(ocr_text.strip()) > len(clean_text):
                    text = ocr_text
                    is_ocr = True
                    ocr_pages.append(page_num)
                else:
                    ocr_warning = f"Page {page_num} appears to be a scanned image or contains minimal text. {ocr_err or 'OCR not applicable'}"
                    warnings.append(ocr_warning)

            # 4. Extract lines cleanly using visual line reconstruction
            visual_lines = self._reconstruct_visual_lines(page)
            if not visual_lines:
                # Fallback to standard split
                visual_lines = [l.strip() for l in text.split("\n") if l.strip()]

            # Also ensure full text includes reconstructed lines if text stream was fragmented
            reconstructed_full_text = "\n".join(visual_lines)
            final_raw_text = reconstructed_full_text if len(reconstructed_full_text) > len(text) else text

            extraction = PageExtraction(
                page_number=page_num,
                raw_text=final_raw_text,
                lines=visual_lines,
                tables=extracted_tables,
                is_ocr=is_ocr,
                ocr_warning=ocr_warning
            )
            extractions.append(extraction)

        return extractions, ocr_pages, warnings
