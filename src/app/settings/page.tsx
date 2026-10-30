'use client';

import React, { useEffect, useState } from 'react';
import {
  Settings,
  Server,
  Database,
  Eye,
  FileCheck2,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ExternalLink,
  Lock,
  Cpu
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';

export default function SettingsPage() {
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(d => {
        setSettings(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  const { pdf_processing_service, ocr_service, document_processing_api, database, limits } = settings || {};

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">System Diagnostics & Configuration</h1>
        <p className="text-sm text-slate-500 mt-1">
          Review backend engine connections, OCR engines, database persistence, and system limits.
        </p>
      </div>

      <div className="space-y-6">
        {/* PDF Processing Service Card */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-sm">
          <div className="flex items-start justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
                <Server className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900">PDF Processing Service (FastAPI)</h2>
                <p className="text-xs text-slate-500">Core extraction and parsing microservice</p>
              </div>
            </div>
            <Badge variant={pdf_processing_service?.status === 'online' ? 'success' : 'danger'}>
              {pdf_processing_service?.status === 'online' ? 'Operational' : 'Service Offline'}
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 text-xs">
            <div>
              <span className="text-slate-500 block">Service URL:</span>
              <span className="font-mono font-medium text-slate-800">{pdf_processing_service?.url}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Engine Architecture:</span>
              <span className="font-medium text-slate-800">{pdf_processing_service?.engine}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Precision Standard:</span>
              <span className="font-medium text-slate-800">{limits?.precision_mode}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Maximum Allowed Upload:</span>
              <span className="font-medium text-slate-800">{limits?.max_upload_size_mb} ({limits?.max_upload_size_bytes?.toLocaleString()} bytes)</span>
            </div>
          </div>
        </div>

        {/* Database Persistence Card */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-sm">
          <div className="flex items-start justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900">Database Persistence Engine</h2>
                <p className="text-xs text-slate-500">MongoDB with automatic local persistent store fallback</p>
              </div>
            </div>
            <Badge variant={database?.connected ? 'success' : 'neutral'}>
              {database?.connected ? 'MongoDB Server Connected' : 'Persistent Local Store Active'}
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 text-xs">
            <div>
              <span className="text-slate-500 block">Storage Engine:</span>
              <span className="font-medium text-slate-800">{database?.engine}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Connection URI:</span>
              <span className="font-mono text-slate-700">{database?.uri}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Statements Stored:</span>
              <span className="font-semibold text-slate-900">{database?.total_statements || 0}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Transactions Indexed:</span>
              <span className="font-semibold text-slate-900">{database?.total_transactions || 0}</span>
            </div>
          </div>
        </div>

        {/* OCR Engine Card */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-sm">
          <div className="flex items-start justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-purple-50 text-purple-600 border border-purple-100">
                <Eye className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900">Optical Character Recognition (OCR)</h2>
                <p className="text-xs text-slate-500">Tesseract OCR fallback for scanned statement pages</p>
              </div>
            </div>
            <Badge variant={ocr_service?.status === 'active' ? 'success' : 'neutral'}>
              {ocr_service?.status === 'active' ? 'Available' : 'Engine Missing'}
            </Badge>
          </div>

          <div className="pt-4 text-xs space-y-2">
            <p className="text-slate-600">
              <strong className="text-slate-800">Status Details:</strong> {ocr_service?.engine}
            </p>
            <p className="text-slate-500 leading-relaxed">
              Native digital PDF statements (HDFC, ICICI, SBI, Axis, Kotak) are parsed directly via high-precision PyMuPDF text & layout extraction without requiring OCR. Scanned statement PDFs automatically fall back to Tesseract OCR when installed on the host.
            </p>
          </div>
        </div>

        {/* Document Processing API Adapter Card */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-sm">
          <div className="flex items-start justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-amber-50 text-amber-600 border border-amber-100">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900">Paid Cloud Document AI Adapter (Optional)</h2>
                <p className="text-xs text-slate-500">Provider-independent adapter (Azure / AWS Textract / Google Doc AI)</p>
              </div>
            </div>
            <Badge variant={document_processing_api?.configured ? 'success' : 'neutral'}>
              {document_processing_api?.configured ? 'Configured' : 'Not Configured (Optional)'}
            </Badge>
          </div>

          <div className="pt-4 text-xs space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className="text-slate-500 block">Selected Provider:</span>
                <span className="font-medium text-slate-800">{document_processing_api?.provider}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Credentials Stored:</span>
                <span className="font-medium text-slate-800">
                  {document_processing_api?.has_credentials ? 'Server-Side Configured' : 'None Provided'}
                </span>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-600">
              <p className="font-semibold text-slate-800 mb-1">Configuration Guidance:</p>
              <p className="leading-relaxed">
                The local PyMuPDF extraction engine delivers 100% precision on digital statements. If your organization requires third-party cloud vision processing, set <code className="bg-white px-1 py-0.5 rounded border border-slate-200 text-slate-800">DOC_AI_PROVIDER</code>, <code className="bg-white px-1 py-0.5 rounded border border-slate-200 text-slate-800">DOC_AI_API_KEY</code>, and <code className="bg-white px-1 py-0.5 rounded border border-slate-200 text-slate-800">DOC_AI_ENDPOINT</code> in your server environment. Credentials are never sent or exposed to client browsers.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
