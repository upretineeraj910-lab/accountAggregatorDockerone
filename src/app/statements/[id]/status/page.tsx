'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  ShieldCheck,
  ChevronRight,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';

interface Stage {
  name: string;
  status: 'completed' | 'applied' | 'skipped' | 'passed' | 'warning' | 'pending';
  description: string;
}

export default function ProcessingStatusPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = () => {
    fetch(`/api/statements/${params.id}/status`)
      .then(res => {
        if (!res.ok) throw new Error('Statement status not found');
        return res.json();
      })
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchStatus();
  }, [params.id]);

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-md mx-auto text-center py-16">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h3 className="text-base font-semibold text-slate-900">Statement Not Found</h3>
        <p className="text-xs text-slate-500 mt-1 mb-5">{error || 'Could not load statement details.'}</p>
        <Link
          href="/upload"
          className="px-4 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg shadow-sm"
        >
          Upload New Statement
        </Link>
      </div>
    );
  }

  const stages: Stage[] = data.stages || [];

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Processing Status</h1>
          <p className="text-xs text-slate-500 mt-1">
            Statement ID: <span className="font-mono text-slate-700">{params.id}</span>
          </p>
        </div>
        <Link
          href={`/statements/${params.id}`}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-colors"
        >
          <span>View Analysis</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Genuine Stage Stepper */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-sm space-y-6">
        <div className="space-y-4">
          {stages.map((stage, idx) => {
            const isCompleted = ['completed', 'applied', 'passed'].includes(stage.status);
            const isWarning = stage.status === 'warning';
            const isSkipped = stage.status === 'skipped';

            return (
              <div key={stage.name} className="flex items-start gap-4 pb-4 border-b border-slate-100 last:border-b-0 last:pb-0">
                <div className="mt-0.5 shrink-0">
                  {isCompleted ? (
                    <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  ) : isWarning ? (
                    <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center">
                      <AlertCircle className="w-4 h-4" />
                    </div>
                  ) : isSkipped ? (
                    <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-xs font-medium">
                      —
                    </div>
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center">
                      <Clock className="w-4 h-4 animate-spin" />
                    </div>
                  )}
                </div>

                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-900">{stage.name}</h3>
                    <Badge variant={isCompleted ? 'success' : isWarning ? 'warning' : 'neutral'}>
                      {stage.status.toUpperCase()}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{stage.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
