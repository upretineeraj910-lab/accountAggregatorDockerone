'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  UploadCloud,
  FileSpreadsheet,
  Settings,
  ShieldCheck,
  Building2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export function Sidebar() {
  const pathname = usePathname();
  const [systemOnline, setSystemOnline] = useState<boolean | null>(null);

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        setSystemOnline(data.pdf_processing_service?.status === 'online');
      })
      .catch(() => setSystemOnline(false));
  }, []);

  const navItems = [
    { label: 'Dashboard', href: '/', icon: LayoutDashboard },
    { label: 'Upload Statement', href: '/upload', icon: UploadCloud },
    { label: 'All Statements', href: '/statements', icon: FileSpreadsheet },
    { label: 'System Settings', href: '/settings', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-white flex flex-col shrink-0 border-r border-slate-800 min-h-screen">
      {/* Brand Header */}
      <div className="p-6 border-b border-slate-800 flex items-center gap-3">
        <div className="p-2 bg-blue-600 rounded-lg text-white shadow-md shadow-blue-500/20">
          <Building2 className="w-6 h-6" />
        </div>
        <div>
          <h1 className="font-bold text-base tracking-tight text-white leading-tight">CrediLedger</h1>
          <p className="text-[11px] text-slate-400 font-medium">Bank Statement Analyzer</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-6 space-y-1.5" aria-label="Main Navigation">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* System Health Status Indicator */}
      <div className="p-4 mx-3 mb-6 rounded-xl bg-slate-800/70 border border-slate-700/60 text-xs">
        <div className="flex items-center justify-between">
          <span className="font-medium text-slate-300 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
            PDF Engine
          </span>
          {systemOnline === null ? (
            <span className="inline-block w-2 h-2 rounded-full bg-slate-400 animate-pulse" />
          ) : systemOnline ? (
            <span className="flex items-center gap-1 text-emerald-400 font-medium text-[11px]">
              <CheckCircle2 className="w-3 h-3" /> Online
            </span>
          ) : (
            <span className="flex items-center gap-1 text-amber-400 font-medium text-[11px]">
              <AlertCircle className="w-3 h-3" /> Checking
            </span>
          )}
        </div>
        <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
          PyMuPDF extraction & decimal-safe validation active.
        </p>
      </div>
    </aside>
  );
}
