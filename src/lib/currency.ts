/**
 * Formats a numeric value into the standard Indian numbering format (INR, ₹).
 * Example: 1234567.89 -> "₹12,34,567.89"
 */
export function formatINR(
  amount: number | null | undefined,
  includeSymbol: boolean = true,
  decimals: number = 2
): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return includeSymbol ? '₹0.00' : '0.00';
  }

  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);
  
  // Split into integer and decimal parts
  const fixed = absAmount.toFixed(decimals);
  const [intPart, decPart] = fixed.split('.');

  // Format integer part using Indian grouping:
  // Last 3 digits, then groups of 2 digits
  let result = '';
  if (intPart.length > 3) {
    const last3 = intPart.substring(intPart.length - 3);
    const otherNumbers = intPart.substring(0, intPart.length - 3);
    const formattedOther = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    result = `${formattedOther},${last3}`;
  } else {
    result = intPart;
  }

  if (decimals > 0 && decPart) {
    result = `${result}.${decPart}`;
  }

  const sign = isNegative ? '-' : '';
  const prefix = includeSymbol ? (isNegative ? '-₹' : '₹') : sign;

  return includeSymbol ? `${prefix}${result}` : `${sign}${result}`;
}

/**
 * Formats a date string (YYYY-MM-DD) into human-readable format.
 * Example: "2026-10-01" -> "01 Oct 2026"
 */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}
