'use client';

import React from 'react';
import Link from 'next/link';
import { UploadCloud, ShieldAlert, FileText } from 'lucide-react';

export function Navbar() {
  return (
    <header className="h-16 bg-white border-b border-slate-200/80 px-6 flex items-center justify-between shrink-0 sticky top-0 z-10">
      <div className="flex items-center gap-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
          Loan Services Underwriting Portal
        </span>
      </div>

      <div className="flex items-center gap-3">
        <Link
          href="/upload"
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium shadow-sm transition-colors focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <UploadCloud className="w-4 h-4" />
          <span>Upload PDF</span>
        </Link>
      </div>
    </header>
  );
}
