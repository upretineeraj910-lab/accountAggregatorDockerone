'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Search,
  Filter,
  Download,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  ArrowLeft,
  FileSpreadsheet,
  AlertCircle
} from 'lucide-react';
import { Badge, CategoryBadge } from '@/components/ui/Badge';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { formatINR, formatDate } from '@/lib/currency';
import { Transaction } from '@/lib/types';

export default function TransactionsPage({ params }: { params: { id: string } }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [type, setType] = useState<'all' | 'debit' | 'credit'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'balance' | 'description'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const limit = 25;

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        sortBy,
        sortOrder,
      });
      if (search) q.append('search', search);
      if (category !== 'all') q.append('category', category);
      if (type !== 'all') q.append('type', type);

      const res = await fetch(`/api/statements/${params.id}/transactions?${q.toString()}`);
      if (!res.ok) throw new Error('Failed to load transactions');
      const data = await res.json();
      setTransactions(data.transactions || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [params.id, page, limit, search, category, type, sortBy, sortOrder]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchTransactions();
    }, 250); // Debounce search
    return () => clearTimeout(timer);
  }, [fetchTransactions]);

  const handleSort = (field: 'date' | 'amount' | 'balance' | 'description') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
    setPage(1);
  };

  const categories = [
    { value: 'all', label: 'All Categories' },
    { value: 'salary', label: 'Salary' },
    { value: 'emi_loan', label: 'EMI / Loan' },
    { value: 'upi', label: 'UPI Transfers' },
    { value: 'cash_withdrawal', label: 'Cash Withdrawal' },
    { value: 'cash_deposit', label: 'Cash Deposit' },
    { value: 'rent', label: 'Rent' },
    { value: 'utilities', label: 'Utilities' },
    { value: 'bank_charges', label: 'Bank Charges' },
    { value: 'interest', label: 'Interest' },
    { value: 'refund', label: 'Refunds' },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href={`/statements/${params.id}`}
            className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-slate-900 shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Extracted Transactions</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Showing {total} total transactions with Indian currency (INR) formatting.
            </p>
          </div>
        </div>

        {/* CSV Export Button */}
        <a
          href={`/api/statements/${params.id}/transactions?format=csv&search=${encodeURIComponent(search)}&category=${category}&type=${type}`}
          download={`transactions_${params.id}.csv`}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-colors"
        >
          <Download className="w-4 h-4" />
          <span>Export Filtered CSV</span>
        </a>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search narration or ref no..."
            className="w-full pl-9 pr-3.5 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>

        {/* Type Filter Buttons */}
        <div className="flex items-center gap-1.5 w-full md:w-auto">
          {(['all', 'credit', 'debit'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setType(t);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                type === t
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {t === 'all' ? 'All Flows' : t === 'credit' ? 'Inflows (Credits)' : 'Outflows (Debits)'}
            </button>
          ))}
        </div>

        {/* Category Dropdown */}
        <div className="w-full md:w-auto">
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
            className="w-full md:w-auto px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {categories.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Transactions Table Card */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <TableSkeleton rows={8} />
        ) : error ? (
          <div className="p-8 text-center text-xs text-rose-600 flex items-center justify-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        ) : transactions.length === 0 ? (
          <div className="py-16 text-center">
            <FileSpreadsheet className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-slate-800">No transactions match your filters</h3>
            <p className="text-xs text-slate-500 mt-1">Try resetting the search query or category filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50/75 text-xs uppercase font-semibold text-slate-500 border-b border-slate-100 select-none">
                <tr>
                  <th
                    className="py-3 px-4 cursor-pointer hover:text-slate-900"
                    onClick={() => handleSort('date')}
                  >
                    <div className="flex items-center gap-1">
                      <span>Date</span>
                      {sortBy === 'date' && (
                        sortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </div>
                  </th>
                  <th
                    className="py-3 px-4 cursor-pointer hover:text-slate-900"
                    onClick={() => handleSort('description')}
                  >
                    <div className="flex items-center gap-1">
                      <span>Narration / Remarks</span>
                      {sortBy === 'description' && (
                        sortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </div>
                  </th>
                  <th className="py-3 px-4 text-right">Debit (Dr)</th>
                  <th className="py-3 px-4 text-right">Credit (Cr)</th>
                  <th
                    className="py-3 px-4 text-right cursor-pointer hover:text-slate-900"
                    onClick={() => handleSort('balance')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Running Balance</span>
                      {sortBy === 'balance' && (
                        sortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </div>
                  </th>
                  <th className="py-3 px-4 text-center">Category</th>
                  <th className="py-3 px-4 text-center">Confidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 text-xs font-mono font-medium text-slate-900 whitespace-nowrap">
                      {formatDate(t.date)}
                    </td>
                    <td className="py-3 px-4 font-normal text-slate-900 max-w-sm">
                      <div className="line-clamp-2 leading-relaxed text-xs">
                        {t.description}
                      </div>
                      {t.reference_number && (
                        <span className="text-[10px] font-mono text-slate-400 block mt-0.5">
                          Ref: {t.reference_number}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-xs whitespace-nowrap">
                      {t.debit > 0 ? (
                        <span className="text-rose-600 font-semibold">{formatINR(t.debit)}</span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-xs whitespace-nowrap">
                      {t.credit > 0 ? (
                        <span className="text-emerald-600 font-semibold">{formatINR(t.credit)}</span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-xs text-slate-900 whitespace-nowrap font-mono">
                      {formatINR(t.balance)}
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <CategoryBadge category={t.category} />
                    </td>
                    <td className="py-3 px-4 text-center text-xs whitespace-nowrap font-mono text-slate-500">
                      {t.confidence ? `${(t.confidence * 100).toFixed(0)}%` : '100%'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <span>
              Page {page} of {totalPages} ({total} rows)
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="p-1.5 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="p-1.5 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
