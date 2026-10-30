'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  FileText,
  Search,
  UploadCloud,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
  Layers,
  FileSpreadsheet,
  Trash2
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatINR, formatDate } from '@/lib/currency';
import { Statement } from '@/lib/types';

export default function StatementsListPage() {
  const [statements, setStatements] = useState<Statement[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchStatements = () => {
    fetch('/api/statements')
      .then(res => res.json())
      .then(d => {
        setStatements(d.statements || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchStatements();
  }, []);

  const filtered = statements.filter(s => {
    const q = search.toLowerCase();
    return (
      s.filename.toLowerCase().includes(q) ||
      (s.metadata?.bank_name && s.metadata.bank_name.toLowerCase().includes(q)) ||
      (s.metadata?.account_holder_name && s.metadata.account_holder_name.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Analyzed Bank Statements</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Archive of processed applicant statements and underwriting files.
          </p>
        </div>
        <Link
          href="/upload"
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-colors"
        >
          <UploadCloud className="w-4 h-4" />
          <span>Upload Statement</span>
        </Link>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-sm">
        <div className="relative w-full max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by customer name, bank, or filename..."
            className="w-full pl-9 pr-3.5 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Statements Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <FileSpreadsheet className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-slate-800">No bank statements found</h3>
            <p className="text-xs text-slate-500 mt-1 mb-4">
              {search ? 'No statements match your search criteria.' : 'No statements have been analyzed yet.'}
            </p>
            <Link
              href="/upload"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-medium"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Upload Statement</span>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50/75 text-xs uppercase font-semibold text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">Statement File</th>
                  <th className="py-3 px-4">Bank</th>
                  <th className="py-3 px-4">Customer Name</th>
                  <th className="py-3 px-4">Period</th>
                  <th className="py-3 px-4 text-right">Transactions</th>
                  <th className="py-3 px-4 text-right">Net Flow</th>
                  <th className="py-3 px-4 text-center">Validation</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((s) => (
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
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/statements/${s.id}`}
                          className="px-2.5 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-semibold"
                        >
                          Analysis
                        </Link>
                        <Link
                          href={`/statements/${s.id}/transactions`}
                          className="px-2.5 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-semibold"
                        >
                          Ledger
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
