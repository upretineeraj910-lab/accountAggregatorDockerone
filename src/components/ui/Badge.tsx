import React from 'react';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'danger' | 'warning' | 'info' | 'purple' | 'neutral';
  size?: 'sm' | 'md';
}

export function Badge({ children, variant = 'default', size = 'sm' }: BadgeProps) {
  const variantStyles = {
    default: 'bg-blue-50 text-blue-700 border-blue-200',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    danger: 'bg-rose-50 text-rose-700 border-rose-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    info: 'bg-sky-50 text-sky-700 border-sky-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
    neutral: 'bg-slate-100 text-slate-700 border-slate-200',
  };

  const sizeStyles = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
  };

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border ${variantStyles[variant]} ${sizeStyles[size]}`}
    >
      {children}
    </span>
  );
}

export function CategoryBadge({ category }: { category: string }) {
  const map: Record<string, { label: string; variant: BadgeProps['variant'] }> = {
    salary: { label: 'Salary', variant: 'success' },
    emi_loan: { label: 'EMI / Loan', variant: 'purple' },
    rent: { label: 'Rent', variant: 'warning' },
    utilities: { label: 'Utilities', variant: 'info' },
    upi: { label: 'UPI Transfer', variant: 'default' },
    cash_deposit: { label: 'Cash Deposit', variant: 'success' },
    cash_withdrawal: { label: 'Cash Withdrawal', variant: 'danger' },
    bank_charges: { label: 'Bank Charges', variant: 'danger' },
    interest: { label: 'Interest', variant: 'success' },
    refund: { label: 'Refund', variant: 'success' },
    other_credit: { label: 'Credit', variant: 'neutral' },
    other_debit: { label: 'Debit', variant: 'neutral' },
    unclassified: { label: 'Unclassified', variant: 'neutral' },
  };

  const item = map[category] || { label: category, variant: 'neutral' };
  return <Badge variant={item.variant}>{item.label}</Badge>;
}
