import re
from typing import Tuple
from decimal import Decimal


class TransactionClassifier:
    """
    Transparent, deterministic rule-based transaction classification engine
    tailored for Indian banking conventions. Preserves original descriptions unaltered.
    """

    SALARY_REGEX = re.compile(r"\b(SALARY|PAYROLL|NEFT[A-Z0-9_-]*SAL|SAL\s*CR|MONTHLY\s*SAL|BY\s*SALARY)\b", re.IGNORECASE)
    EMI_REGEX = re.compile(r"\b(EMI|LOAN|BAJAJ\s*FIN|ACH[/-]|ECS[/-]|HDFC\s*LOAN|SBI\s*LOAN|HOME\s*LOAN|AUTO\s*LOAN|FINANCE|REPAYMENT)\b", re.IGNORECASE)
    RENT_REGEX = re.compile(r"\b(RENT|HOUSE\s*RENT|NOBROKER|NESTAWAY|FLAT\s*RENT)\b", re.IGNORECASE)
    UTILITIES_REGEX = re.compile(r"\b(ELECTRICITY|BESCOM|TNEB|MSEDCL|WATER|GAS|CYLINDER|INDANE|HPCL|AIRTEL|JIO|VI\b|ACT\s*FIBER|BROADBAND|BILLDESK|RECHARGE|TATAPOWER|ADANI\s*ELEC)\b", re.IGNORECASE)
    UPI_REGEX = re.compile(r"\b(UPI[/-]|@okhdfcbank|@okaxis|@okicici|@oksbi|@paytm|@ybl|@upi|PAYTM|GPAY|PHONEPE)\b", re.IGNORECASE)
    CASH_DEP_REGEX = re.compile(r"\b(CASH\s*DEP|CASH\s*DEPOSIT|CDM[/-]|BY\s*CASH|ATM\s*DEP)\b", re.IGNORECASE)
    CASH_WDL_REGEX = re.compile(r"\b(ATM\s*WDL|CASH\s*WDL|NWD[/-]|ATM[/-]|CASH\s*WITHDRAWAL|SELF\s*ATM)\b", re.IGNORECASE)
    BANK_CHG_REGEX = re.compile(r"\b(CHG|CHARGE|SMS\s*CHG|MIN\s*BAL|ANNUAL\s*FEE|DEBIT\s*CARD\s*FEE|GST|CHEQUE\s*RETURN|BOUNCE|PENALTY)\b", re.IGNORECASE)
    INTEREST_REGEX = re.compile(r"\b(INT\.PD|INTEREST\s*PAID|CREDIT\s*INTEREST|INT\s*COLL|SB\s*INT)\b", re.IGNORECASE)
    REFUND_REGEX = re.compile(r"\b(REFUND|REVERSAL|REV:|REV/|CASHBACK)\b", re.IGNORECASE)

    @classmethod
    def classify(cls, description: str, debit: Decimal, credit: Decimal) -> Tuple[str, float]:
        """
        Classifies a transaction deterministically based on narration and amount direction.
        Returns Tuple of (category_name, confidence).
        """
        desc = description.strip()

        # 1. Salary check (Credit only)
        if credit > 0 and cls.SALARY_REGEX.search(desc):
            return "salary", 0.96

        # 2. Refund check (Credit only)
        if credit > 0 and cls.REFUND_REGEX.search(desc):
            return "refund", 0.95

        # 3. Interest check (Credit only)
        if credit > 0 and cls.INTEREST_REGEX.search(desc):
            return "interest", 0.98

        # 4. Cash Deposit (Credit only)
        if credit > 0 and cls.CASH_DEP_REGEX.search(desc):
            return "cash_deposit", 0.95

        # 5. Bank Charges / Bounces (Debit only)
        if debit > 0 and cls.BANK_CHG_REGEX.search(desc):
            return "bank_charges", 0.94

        # 6. Cash Withdrawal (Debit only)
        if debit > 0 and cls.CASH_WDL_REGEX.search(desc):
            return "cash_withdrawal", 0.95

        # 7. Rent (Debit only)
        if debit > 0 and cls.RENT_REGEX.search(desc):
            return "rent", 0.92

        # 8. EMI / Loan Repayment (Debit only)
        if debit > 0 and cls.EMI_REGEX.search(desc):
            return "emi_loan", 0.93

        # 9. Utilities (Debit only)
        if debit > 0 and cls.UTILITIES_REGEX.search(desc):
            return "utilities", 0.94

        # 10. UPI Transfers
        if cls.UPI_REGEX.search(desc):
            return "upi", 0.92

        # Fallbacks based on flow direction
        if credit > 0 and debit == 0:
            return "other_credit", 0.85
        if debit > 0 and credit == 0:
            return "other_debit", 0.85

        return "unclassified", 0.50
