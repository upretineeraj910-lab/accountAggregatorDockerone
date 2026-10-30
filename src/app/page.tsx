'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  FileText,
  TrendingUp,
  TrendingDown,
  FileCheck2,
  AlertTriangle,
  UploadCloud,
  ChevronRight,
  ShieldCheck,
  Building,
  Calendar,
  Layers
} from 'lucide-react';
import { StatCard } from '@/components/ui/StatCard';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatINR, formatDate } from '@/lib/currency';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/statements')
      .then(res => res.json())
      .then(async (stmtData) => {
        // Compute dashboard metrics from real data
        const statements = stmtData.statements || [];
        const totalStatements = statements.length;
        const validStatements = statements.filter((s: any) => s.validation?.is_valid);
        
        let totalTxns = 0;
        let totalCr = 0;
        let totalDr = 0;
        const monthlyAgg: Record<string, { credit: number; debit: number; count: number }> = {};

        for (const s of statements) {
          if (s.summary) {
            totalTxns += s.summary.transaction_count || 0;
            totalCr += s.summary.total_credits || 0;
            totalDr += s.summary.total_debits || 0;

            for (const m of s.summary.monthly_metrics || []) {
              if (!monthlyAgg[m.month]) {
                monthlyAgg[m.month] = { credit: 0, debit: 0, count: 0 };
              }
              monthlyAgg[m.month].credit += m.total_credit;
              monthlyAgg[m.month].debit += m.total_debit;
              monthlyAgg[m.month].count += m.transaction_count;
            }
          }
        }

        const monthlyCharts = Object.keys(monthlyAgg).sort().map(month => ({
          month,
          credits: monthlyAgg[month].credit,
          debits: monthlyAgg[month].debit,
          net: monthlyAgg[month].credit - monthlyAgg[month].debit
        }));

        setData({
          total_statements: totalStatements,
          valid_statements: validStatements.length,
          pass_rate: totalStatements > 0 ? Math.round((validStatements.length / totalStatements) * 100) : 0,
          total_transactions: totalTxns,
          total_credits: totalCr,
          total_debits: totalDr,
          recent_statements: statements.slice(0, 5),
          monthly_charts: monthlyCharts
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-slate-200 animate-pulse rounded" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const hasData = data && data.total_statements > 0;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Executive Underwriting Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time bank statement analytics, deterministic reconciliation, and transaction auditing.
          </p>
        </div>
        <Link
          href="/upload"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium shadow-sm transition-colors"
        >
          <UploadCloud className="w-4 h-4" />
          <span>Upload Statement</span>
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Statements Analyzed"
          value={data ? String(data.total_statements) : '0'}
          subtitle={hasData ? `${data.valid_statements} validated clean` : 'Awaiting uploads'}
          icon={FileText}
          variant="blue"
        />
        <StatCard
          title="Transactions Parsed"
          value={data ? data.total_transactions.toLocaleString('en-IN') : '0'}
          subtitle={hasData ? 'Extracted across statements' : 'No transactions yet'}
          icon={Layers}
          variant="slate"
        />
        <StatCard
          title="Reconciliation Pass Rate"
          value={hasData ? `${data.pass_rate}%` : '—'}
          subtitle={hasData ? 'Mathematical consistency' : 'No data to validate'}
          icon={ShieldCheck}
          variant={data && data.pass_rate >= 90 ? 'emerald' : 'amber'}
        />
        <StatCard
          title="Total Inflows Audited"
          value={hasData ? formatINR(data.total_credits) : '₹0.00'}
          subtitle={hasData ? `Outflows: ${formatINR(data.total_debits)}` : 'No processed statements'}
          icon={TrendingUp}
          variant="emerald"
        />
      </div>

      {/* Monthly Cashflow Analytics (When real processed data exists) */}
      {hasData && data.monthly_charts && data.monthly_charts.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Audited Monthly Cash Flow Inflow vs Outflow</h2>
              <p className="text-xs text-slate-500 mt-0.5">Aggregated actual credits and debits from uploaded statements</p>
            </div>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.monthly_charts} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="month" stroke="#64748b" fontSize={12} tickLine={false} />
                <YAxis
                  stroke="#64748b"
                  fontSize={12}
                  tickLine={false}
                  tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(value: any) => [formatINR(Number(value)), '']}
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                />
                <Legend />
                <Bar dataKey="credits" name="Total Inflow (Credits)" fill="#059669" radius={[4, 4, 0, 0]} />
                <Bar dataKey="debits" name="Total Outflow (Debits)" fill="#e11d48" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Recent Statements Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Recent Statement Uploads</h2>
            <p className="text-xs text-slate-500 mt-0.5">Recently analyzed applicant financial documents</p>
          </div>
          {hasData && (
            <Link
              href="/statements"
              className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              View All ({data.total_statements}) <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>

        {hasData ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50/75 text-xs uppercase font-semibold text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">Statement File</th>
                  <th className="py-3 px-4">Bank</th>
                  <th className="py-3 px-4">Account Holder</th>
                  <th className="py-3 px-4">Period</th>
                  <th className="py-3 px-4 text-right">Transactions</th>
                  <th className="py-3 px-4 text-right">Net Flow</th>
                  <th className="py-3 px-4 text-center">Validation</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.recent_statements.map((s: any) => (
                  <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-medium text-slate-900 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                      <span className="truncate max-w-[180px]">{s.filename}</span>
                    </td>
                    <td className="py-3 px-4">{s.metadata?.bank_name || 'Generic Bank'}</td>
                    <td className="py-3 px-4 text-slate-700 font-medium">
                      {s.metadata?.account_holder_name || '—'}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500">
                      {s.summary?.start_date ? `${formatDate(s.summary.start_date)} - ${formatDate(s.summary.end_date)}` : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-medium">
                      {s.summary?.transaction_count || 0}
                    </td>
                    <td className={`py-3 px-4 text-right font-semibold ${
                      (s.summary?.net_cashflow || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'
                    }`}>
                      {formatINR(s.summary?.net_cashflow)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {s.validation?.is_valid ? (
                        <Badge variant="success">Passed</Badge>
                      ) : (
                        <Badge variant="warning">Review</Badge>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link
                        href={`/statements/${s.id}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800"
                      >
                        Analysis <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-16 text-center px-4">
            <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
              <UploadCloud className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-slate-900">No bank statements uploaded yet</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-5">
              Upload customer bank statement PDFs to extract transactions, perform balance validation, and calculate financial summaries.
            </p>
            <Link
              href="/upload"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium shadow-sm transition-colors"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Upload First Statement</span>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
