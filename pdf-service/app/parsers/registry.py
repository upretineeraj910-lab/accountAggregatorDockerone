from typing import List, Tuple
from app.parsers.base import BaseStatementParser
from app.parsers.hdfc import HDFCParser
from app.parsers.icici import ICICIParser
from app.parsers.sbi import SBIParser
from app.parsers.axis import AxisParser
from app.parsers.kotak import KotakParser
from app.parsers.generic import GenericBankParser


class ParserRegistry:
    def __init__(self):
        # Specific bank parsers in prioritized order
        self.bank_parsers: List[BaseStatementParser] = [
            HDFCParser(),
            ICICIParser(),
            SBIParser(),
            AxisParser(),
            KotakParser(),
        ]
        self.fallback_parser: BaseStatementParser = GenericBankParser()

    def get_parser(self, full_text: str, lines: List[str]) -> Tuple[BaseStatementParser, str]:
        """
        Determines the most accurate parser for the document.
        Returns Tuple of (ParserInstance, DetectedBankName).
        """
        for parser in self.bank_parsers:
            if parser.can_parse(full_text, lines):
                return parser, getattr(parser, "BANK_NAME", "Specialized Bank")

        return self.fallback_parser, "Auto-Detected Bank (Generic Layout)"
