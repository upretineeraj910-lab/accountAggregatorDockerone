'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Printer,
  ArrowLeft,
  Building2,
  ShieldCheck,
  AlertTriangle,
  FileCheck2,
  FileSpreadsheet
} from 'lucide-react';
import { formatINR, formatDate } from '@/lib/currency';
import { Skeleton } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';

export default function StatementReportPage({ params }: { params: { id: string } }) {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/statements/${params.id}/report`)
      .then(res => {
        if (!res.ok) throw new Error('Report data unavailable');
        return res.json();
      })
      .then(d => {
        setReport(d);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [params.id]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="max-w-md mx-auto text-center py-16">
        <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h3 className="text-base font-semibold text-slate-900">Report Unavailable</h3>
        <p className="text-xs text-slate-500 mt-1 mb-5">{error || 'Could not load report.'}</p>
        <Link href="/statements" className="px-4 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg">
          Back to Statements
        </Link>
      </div>
    );
  }

  const { statement, key_underwriting_metrics, validation_summary, disclaimer } = report;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Action Bar (hidden during print) */}
      <div className="flex items-center justify-between print:hidden">
        <Link
          href={`/statements/${params.id}`}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Analysis</span>
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold shadow-sm hover:bg-slate-800 transition-colors"
        >
          <Printer className="w-4 h-4" />
          <span>Print / Save as PDF</span>
        </button>
      </div>

      {/* Formal Printable Document Card */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-8 shadow-sm print:border-none print:shadow-none space-y-8 text-slate-900">
        {/* Document Header */}
        <div className="flex items-start justify-between border-b border-slate-200 pb-6">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-blue-600 text-white rounded-lg">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-slate-900">CrediLedger Financial Analysis</h1>
                <p className="text-xs text-slate-500">Loan Underwriting & Bank Statement Audit Report</p>
              </div>
            </div>
          </div>
          <div className="text-right text-xs text-slate-500 space-y-1">
            <p>Report ID: <span className="font-mono font-medium text-slate-800">{statement.id}</span></p>
            <p>Generated: {new Date(report.report_generated_at).toLocaleString('en-IN')}</p>
            <p>Extraction Status: <Badge variant="success">Completed</Badge></p>
          </div>
        </div>

        {/* Applicant & Account Info */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-lg bg-slate-50 border border-slate-100 text-xs">
          <div>
            <span className="text-slate-500 block">Bank Entity:</span>
            <span className="font-semibold text-slate-900">{key_underwriting_metrics.bank_name}</span>
          </div>
          <div>
            <span className="text-slate-500 block">Account Holder:</span>
            <span className="font-semibold text-slate-900">{key_underwriting_metrics.account_holder}</span>
          </div>
          <div>
            <span className="text-slate-500 block">Account Number:</span>
            <span className="font-mono font-semibold text-slate-900">{key_underwriting_metrics.masked_account}</span>
          </div>
          <div>
            <span className="text-slate-500 block">Audited Period:</span>
            <span className="font-semibold text-slate-900">{key_underwriting_metrics.period}</span>
          </div>
        </div>

        {/* Arithmetic Validation & Reconciliation */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            Deterministic Reconciliation & Integrity Verification
          </h2>
          <div className={`p-4 rounded-lg border text-xs ${
            validation_summary.arithmetic_reconciliation === 'PASSED'
              ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
              : 'bg-amber-50/60 border-amber-200 text-amber-900'
          }`}>
            <div className="flex items-center justify-between font-semibold">
              <span>Mathematical Integrity Check:</span>
              <Badge variant={validation_summary.arithmetic_reconciliation === 'PASSED' ? 'success' : 'warning'}>
                {validation_summary.arithmetic_reconciliation}
              </Badge>
            </div>
            {validation_summary.reconciliation_formula && (
              <p className="mt-2 font-mono text-[11px] bg-white/80 p-2 rounded border border-current/20">
                Formula: {validation_summary.reconciliation_formula}
              </p>
            )}
            <div className="grid grid-cols-2 gap-4 mt-3 text-[11px] opacity-90">
              <p>Duplicate Candidates Identified: {validation_summary.duplicate_candidates || 0}</p>
              <p>Chronological Order Mismatches: {validation_summary.chronological_anomalies || 0}</p>
            </div>
          </div>
        </div>

        {/* Financial KPI Table */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Authoritative Financial Cash Flows
          </h2>
          <table className="w-full text-xs text-left border border-slate-200">
            <tbody className="divide-y divide-slate-100">
              <tr className="bg-slate-50/75">
                <td className="py-2.5 px-4 font-medium text-slate-700">Opening Balance</td>
                <td className="py-2.5 px-4 font-mono font-semibold text-right">{formatINR(key_underwriting_metrics.opening_balance)}</td>
              </tr>
              <tr>
                <td className="py-2.5 px-4 font-medium text-slate-700">Closing Balance</td>
                <td className="py-2.5 px-4 font-mono font-semibold text-right">{formatINR(key_underwriting_metrics.closing_balance)}</td>
              </tr>
              <tr className="bg-slate-50/75">
                <td className="py-2.5 px-4 font-medium text-slate-700">Total Credits (Audited Inflows)</td>
                <td className="py-2.5 px-4 font-mono font-bold text-emerald-600 text-right">{formatINR(key_underwriting_metrics.total_inflows)}</td>
              </tr>
              <tr>
                <td className="py-2.5 px-4 font-medium text-slate-700">Total Debits (Audited Outflows)</td>
                <td className="py-2.5 px-4 font-mono font-bold text-rose-600 text-right">{formatINR(key_underwriting_metrics.total_outflows)}</td>
              </tr>
              <tr className="bg-slate-50/75">
                <td className="py-2.5 px-4 font-medium text-slate-700">Net Period Cash Flow</td>
                <td className="py-2.5 px-4 font-mono font-bold text-right">{formatINR(key_underwriting_metrics.net_cashflow)}</td>
              </tr>
              <tr>
                <td className="py-2.5 px-4 font-medium text-slate-700">Average Monthly Inflow</td>
                <td className="py-2.5 px-4 font-mono font-semibold text-right">{formatINR(key_underwriting_metrics.avg_monthly_credit)}</td>
              </tr>
              <tr className="bg-slate-50/75">
                <td className="py-2.5 px-4 font-medium text-slate-700">Average Monthly Outflow</td>
                <td className="py-2.5 px-4 font-mono font-semibold text-right">{formatINR(key_underwriting_metrics.avg_monthly_debit)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Inferred Inflows & Obligations */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Inferred Inflow & Obligation Heuristics
            </h2>
            <span className="text-[10px] uppercase font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
              Automated Classification
            </span>
          </div>
          <table className="w-full text-xs text-left border border-slate-200">
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="py-2.5 px-4 font-medium text-slate-700">Identified Potential Salary Inflows</td>
                <td className="py-2.5 px-4 font-mono font-semibold text-emerald-700 text-right">{formatINR(key_underwriting_metrics.potential_salary_inflows)}</td>
              </tr>
              <tr className="bg-slate-50/75">
                <td className="py-2.5 px-4 font-medium text-slate-700">Identified Potential EMI & Loan Repayments</td>
                <td className="py-2.5 px-4 font-mono font-semibold text-purple-700 text-right">{formatINR(key_underwriting_metrics.potential_emi_obligations)}</td>
              </tr>
              <tr>
                <td className="py-2.5 px-4 font-medium text-slate-700">Cash Withdrawals (ATM / Branch)</td>
                <td className="py-2.5 px-4 font-mono text-slate-800 text-right">{formatINR(key_underwriting_metrics.cash_withdrawals)}</td>
              </tr>
              <tr className="bg-slate-50/75">
                <td className="py-2.5 px-4 font-medium text-slate-700">Cash Deposits (CDM / Branch)</td>
                <td className="py-2.5 px-4 font-mono text-slate-800 text-right">{formatINR(key_underwriting_metrics.cash_deposits)}</td>
              </tr>
              <tr>
                <td className="py-2.5 px-4 font-medium text-slate-700">Bank Penalties, GST & Service Charges</td>
                <td className="py-2.5 px-4 font-mono text-rose-700 text-right">{formatINR(key_underwriting_metrics.bank_charges)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Disclaimer / Notice */}
        <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-600 leading-relaxed">
          <p className="font-semibold text-slate-800 mb-1">Underwriting Notice & Classification Limitations:</p>
          <p>{disclaimer}</p>
        </div>
      </div>
    </div>
  );
}
