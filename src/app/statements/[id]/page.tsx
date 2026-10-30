'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  FileText,
  Building,
  User,
  Calendar,
  Layers,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  Download,
  Trash2,
  CheckCircle2,
  CreditCard,
  Banknote,
  Percent,
  HelpCircle
} from 'lucide-react';
import { StatCard } from '@/components/ui/StatCard';
import { Badge, CategoryBadge } from '@/components/ui/Badge';
import { AccessibleModal } from '@/components/ui/AccessibleModal';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatINR, formatDate } from '@/lib/currency';
import { Statement } from '@/lib/types';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts';

export default function StatementAnalysisPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [statement, setStatement] = useState<Statement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetch(`/api/statements/${params.id}`)
      .then(res => {
        if (!res.ok) throw new Error('Statement not found');
        return res.json();
      })
      .then(d => {
        setStatement(d.statement);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [params.id]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/statements/${params.id}`, { method: 'DELETE' });
      if (res.ok) {
        router.push('/statements');
      } else {
        alert('Failed to delete statement.');
        setDeleting(false);
      }
    } catch {
      alert('Error during delete.');
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !statement) {
    return (
      <div className="max-w-md mx-auto text-center py-16">
        <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h3 className="text-base font-semibold text-slate-900">Statement Not Found</h3>
        <p className="text-xs text-slate-500 mt-1 mb-5">{error || 'Could not load statement analysis.'}</p>
        <Link
          href="/upload"
          className="px-4 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg shadow-sm"
        >
          Upload New Statement
        </Link>
      </div>
    );
  }

  const { metadata, summary, validation } = statement;

  // Category breakdown for pie chart
  const categoryChartData = (summary?.category_summaries || [])
    .filter(c => c.total_debit > 0 || c.total_credit > 0)
    .map(c => ({
      name: c.category.replace('_', ' ').toUpperCase(),
      value: c.total_debit > 0 ? c.total_debit : c.total_credit,
      type: c.total_debit > 0 ? 'Debit' : 'Credit'
    }));

  const COLORS = ['#2563eb', '#7c3aed', '#d97706', '#059669', '#dc2626', '#0891b2', '#64748b'];

  return (
    <div className="space-y-8">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              {metadata?.bank_name || 'Bank Statement'}
            </span>
            {validation?.is_valid ? (
              <Badge variant="success">Reconciliation Verified</Badge>
            ) : (
              <Badge variant="warning">Reconciliation Warnings</Badge>
            )}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {metadata?.account_holder_name ? `${metadata.account_holder_name} - Statement Analysis` : statement.filename}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Account: <span className="font-mono font-medium text-slate-700">{metadata?.account_number_masked || 'Not Masked'}</span> • Period: {formatDate(summary?.start_date)} to {formatDate(summary?.end_date)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/statements/${statement.id}/transactions`}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-colors"
          >
            <Layers className="w-4 h-4" />
            <span>Transactions ({summary?.transaction_count || 0})</span>
          </Link>
          <Link
            href={`/statements/${statement.id}/report`}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-sm transition-colors"
          >
            <FileText className="w-4 h-4 text-slate-500" />
            <span>Underwriting Report</span>
          </Link>
          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 transition-colors"
            title="Delete Statement"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Deterministic Validation Notice Card */}
      <div className={`p-4 rounded-xl border ${
        validation?.is_valid
          ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
          : 'bg-amber-50/70 border-amber-200 text-amber-900'
      }`}>
        <div className="flex items-start gap-3">
          {validation?.is_valid ? (
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          )}
          <div className="text-xs flex-1">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sm">
                {validation?.is_valid
                  ? 'Mathematical Reconciliation: 100% Consistent'
                  : 'Mathematical Validation Notice'}
              </h4>
              <span className="font-mono text-[11px] font-semibold">
                {validation?.duplicate_candidates_count || 0} duplicates • {validation?.chronological_issues_count || 0} time anomalies
              </span>
            </div>
            <p className="mt-1 leading-relaxed opacity-90">{validation?.summary}</p>
            {validation?.reconciliation_formula && (
              <p className="mt-2 font-mono text-[11px] bg-white/70 px-2.5 py-1.5 rounded border border-current/20">
                Formula: {validation.reconciliation_formula}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Core Extracted Financial Balances */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
          <Banknote className="w-3.5 h-3.5 text-blue-600" />
          Extracted Authoritative Balances & Flows
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Opening Balance"
            value={formatINR(summary?.opening_balance)}
            subtitle={`As of ${formatDate(summary?.start_date)}`}
            icon={Building}
            variant="slate"
          />
          <StatCard
            title="Closing Balance"
            value={formatINR(summary?.closing_balance)}
            subtitle={`As of ${formatDate(summary?.end_date)}`}
            icon={Building}
            variant="blue"
          />
          <StatCard
            title="Total Credits (Inflow)"
            value={formatINR(summary?.total_credits)}
            subtitle={`Avg Monthly: ${formatINR(summary?.avg_monthly_credits)}`}
            icon={TrendingUp}
            variant="emerald"
          />
          <StatCard
            title="Total Debits (Outflow)"
            value={formatINR(summary?.total_debits)}
            subtitle={`Avg Monthly: ${formatINR(summary?.avg_monthly_debits)}`}
            icon={TrendingDown}
            variant="rose"
          />
        </div>
      </div>

      {/* Inferred Classifications Card */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-slate-900">Inferred Category Breakdown</h2>
              <span className="text-[10px] font-medium uppercase px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                Inferred Heuristics
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Classified based on narration keywords and amount direction. Inferred categories are decision-support aids, not guaranteed classifications.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-2">
          <div className="p-3.5 rounded-lg bg-emerald-50/50 border border-emerald-100">
            <span className="text-xs font-semibold text-emerald-800">Potential Salary</span>
            <p className="text-lg font-bold text-emerald-900 mt-1">{formatINR(summary?.potential_salary_credits)}</p>
            <p className="text-[11px] text-emerald-700 mt-0.5">{summary?.potential_salary_count || 0} credit transaction(s)</p>
          </div>

          <div className="p-3.5 rounded-lg bg-purple-50/50 border border-purple-100">
            <span className="text-xs font-semibold text-purple-800">Potential EMI / Loans</span>
            <p className="text-lg font-bold text-purple-900 mt-1">{formatINR(summary?.potential_emi_debits)}</p>
            <p className="text-[11px] text-purple-700 mt-0.5">{summary?.potential_emi_count || 0} loan payment(s)</p>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-xs font-semibold text-slate-700">Cash Withdrawals</span>
            <p className="text-lg font-bold text-slate-900 mt-1">{formatINR(summary?.cash_withdrawals_total)}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">{summary?.cash_withdrawals_count || 0} ATM/branch withdrawal(s)</p>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-xs font-semibold text-slate-700">Cash Deposits</span>
            <p className="text-lg font-bold text-slate-900 mt-1">{formatINR(summary?.cash_deposits_total)}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">{summary?.cash_deposits_count || 0} CDM/cash deposit(s)</p>
          </div>

          <div className="p-3.5 rounded-lg bg-rose-50/50 border border-rose-100">
            <span className="text-xs font-semibold text-rose-800">Bank Charges & Fees</span>
            <p className="text-lg font-bold text-rose-900 mt-1">{formatINR(summary?.bank_charges_total)}</p>
            <p className="text-[11px] text-rose-700 mt-0.5">{summary?.bank_charges_count || 0} fee transaction(s)</p>
          </div>
        </div>
      </div>

      {/* Disclaimers & Governance */}
      <div className="p-4 rounded-xl bg-slate-100/70 border border-slate-200 text-xs text-slate-600 flex items-start gap-3">
        <HelpCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong className="text-slate-800">Loan Underwriting Policy Notice:</strong> This analysis extracts and validates arithmetic facts from the submitted document. Automated transaction classifications do not certify borrower creditworthiness or underwriting approval. Final credit decisions must comply with formal institutional policy.
        </p>
      </div>

      {/* Accessible Confirmation Modal for Deletion */}
      <AccessibleModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Statement Analysis"
        description="This action removes the statement and all associated transactions."
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Are you sure you want to delete statement <span className="font-semibold text-slate-900">{statement.filename}</span>? All extracted transaction records will be permanently removed.
          </p>
          <div className="flex items-center justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={() => setShowDeleteModal(false)}
              className="px-4 py-2 rounded-lg bg-slate-100 text-xs font-medium text-slate-700 hover:bg-slate-200"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={deleting}
              onClick={handleDelete}
              className="px-4 py-2 rounded-lg bg-rose-600 text-xs font-medium text-white hover:bg-rose-700"
            >
              {deleting ? 'Deleting...' : 'Confirm Delete'}
            </button>
          </div>
        </div>
      </AccessibleModal>
    </div>
  );
}
