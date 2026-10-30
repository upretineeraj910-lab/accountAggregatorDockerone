'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  UploadCloud,
  FileText,
  Lock,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Info,
  ShieldCheck,
  Building,
  ArrowRight
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';

export default function UploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [isPasswordRequired, setIsPasswordRequired] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [duplicateInfo, setDuplicateInfo] = useState<any>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    setError(null);
    setDuplicateInfo(null);

    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles && droppedFiles.length > 0) {
      validateAndSetFile(droppedFiles[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setDuplicateInfo(null);
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (f: File) => {
    if (!f.name.toLowerCase().endsWith('.pdf') && f.type !== 'application/pdf') {
      setError('Invalid file format. Please upload a standard PDF bank statement.');
      return;
    }

    const maxBytes = 25 * 1024 * 1024; // 25 MB
    if (f.size > maxBytes) {
      setError(`File size (${(f.size / (1024 * 1024)).toFixed(1)} MB) exceeds the 25 MB maximum upload limit.`);
      return;
    }

    setFile(f);
  };

  const handleSubmit = async (force: boolean = false) => {
    if (!file) {
      setError('Please choose a bank statement PDF to upload.');
      return;
    }

    setUploading(true);
    setProgress(15);
    setStatusText('Validating PDF format & computing cryptographic fingerprint...');
    setError(null);
    setDuplicateInfo(null);

    const formData = new FormData();
    formData.append('file', file);
    if (password) {
      formData.append('password', password);
    }
    if (force) {
      formData.append('force', 'true');
    }

    try {
      setProgress(40);
      setStatusText('Processing document through extraction & validation pipeline...');

      const response = await fetch('/api/statements/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.code === 'PASSWORD_REQUIRED') {
          setIsPasswordRequired(true);
          setError('This statement PDF is password-protected. Please enter the password below and retry.');
        } else if (data.code === 'INVALID_PASSWORD') {
          setIsPasswordRequired(true);
          setError('Incorrect password provided. Please verify the account password and retry.');
        } else {
          setError(data.error || 'Failed to process statement.');
        }
        setUploading(false);
        return;
      }

      if (data.is_duplicate) {
        setDuplicateInfo(data);
        setUploading(false);
        return;
      }

      setProgress(90);
      setStatusText('Storing normalized records and financial metrics...');

      setTimeout(() => {
        setProgress(100);
        setStatusText('Analysis complete. Redirecting...');
        router.push(`/statements/${data.statement_id}`);
      }, 500);

    } catch (err: any) {
      setError(`Upload error: ${err.message}`);
      setUploading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Upload Bank Statement</h1>
        <p className="text-sm text-slate-500 mt-1">
          Upload customer bank statement PDFs for automatic transaction extraction, running balance validation, and financial categorization.
        </p>
      </div>

      {/* Main Upload Box */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-8 shadow-sm space-y-6">
        {/* Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-blue-500 bg-blue-50/50'
              : 'border-slate-300 hover:border-slate-400 bg-slate-50/50 hover:bg-slate-50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            onChange={handleFileChange}
            className="hidden"
          />

          <div className="w-14 h-14 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4 shadow-sm">
            <UploadCloud className="w-7 h-7" />
          </div>

          <h3 className="text-base font-semibold text-slate-900">
            {file ? file.name : 'Choose a bank statement PDF or drag & drop here'}
          </h3>

          <p className="text-xs text-slate-500 mt-1.5 max-w-md mx-auto">
            {file
              ? `Selected file size: ${(file.size / 1024).toFixed(1)} KB. Click to choose another file.`
              : 'Supported: Indian bank statements (HDFC, ICICI, SBI, Axis, Kotak, and generic layouts) up to 25 MB.'}
          </p>

          <button
            type="button"
            className="mt-4 px-4 py-2 rounded-lg bg-white border border-slate-300 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Browse Local PDF File
          </button>
        </div>

        {/* Password input for encrypted bank PDFs */}
        <div className="pt-2">
          <div className="flex items-center justify-between mb-2">
            <label
              htmlFor="pdf-password"
              className="text-xs font-semibold text-slate-700 flex items-center gap-1.5"
            >
              <Lock className="w-3.5 h-3.5 text-slate-500" />
              Statement Password {isPasswordRequired && <span className="text-rose-600 font-bold">*</span>}
            </label>
            <span className="text-[11px] text-slate-400">
              Only required if your bank encrypted the PDF
            </span>
          </div>
          <input
            id="pdf-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="e.g. PAN, Date of Birth, or Customer ID"
            className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>

        {/* Duplicate Upload Detected Alert */}
        {duplicateInfo && (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-3">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-amber-900">Duplicate Statement Upload Detected</h4>
                <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                  {duplicateInfo.message}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => router.push(`/statements/${duplicateInfo.statement_id}`)}
                className="px-3.5 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-medium hover:bg-amber-700 shadow-sm"
              >
                View Existing Analysis
              </button>
              <button
                type="button"
                onClick={() => handleSubmit(true)}
                className="px-3.5 py-1.5 rounded-lg bg-white border border-amber-300 text-amber-800 text-xs font-medium hover:bg-amber-100"
              >
                Re-Analyze Anyway
              </button>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed">
              <p className="font-semibold text-rose-900">Processing Notice</p>
              <p className="mt-0.5 text-rose-800">{error}</p>
            </div>
          </div>
        )}

        {/* Upload Progress Bar */}
        {uploading && (
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-700 flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                {statusText}
              </span>
              <span className="font-semibold text-blue-600">{progress}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Action Button */}
        <div className="pt-2">
          <button
            type="button"
            disabled={!file || uploading}
            onClick={() => handleSubmit(false)}
            className="w-full py-3 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-sm font-semibold shadow-sm transition-colors flex items-center justify-center gap-2"
          >
            {uploading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Analyzing Statement...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Upload and Analyze Statement</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Accepted Statement Features & Information Card */}
      <div className="bg-slate-100/70 rounded-xl p-6 border border-slate-200/80 space-y-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
          <Info className="w-4 h-4 text-blue-600" />
          Supported Indian Bank PDF Formats
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
            <span>HDFC, ICICI, SBI, Axis, and Kotak statement layouts</span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
            <span>Generic fallback parser for any table or line-based Indian bank PDF</span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
            <span>Automatic decimal-safe running balance verification</span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
            <span>SHA-256 fingerprinting for duplicate fraud prevention</span>
          </div>
        </div>
      </div>
    </div>
  );
}
