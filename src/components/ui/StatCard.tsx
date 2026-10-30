import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  variant?: 'blue' | 'emerald' | 'rose' | 'amber' | 'slate';
  badge?: React.ReactNode;
}

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = 'slate',
  badge
}: StatCardProps) {
  const iconColor = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    rose: 'bg-rose-50 text-rose-600 border-rose-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    slate: 'bg-slate-100 text-slate-700 border-slate-200',
  }[variant];

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</p>
          <h3 className="text-2xl font-bold text-slate-900 mt-1.5 tracking-tight">{value}</h3>
          {subtitle && (
            <p className="text-xs text-slate-500 mt-1 font-normal flex items-center gap-1.5">
              {subtitle}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className={`p-2.5 rounded-lg border ${iconColor}`}>
            <Icon className="w-5 h-5" />
          </div>
          {badge}
        </div>
      </div>
    </div>
  );
}
