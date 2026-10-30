import { NextResponse } from 'next/server';
import { getDatabaseStatus } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const pdfServiceUrl = process.env.PDF_SERVICE_URL || 'http://127.0.0.1:8000';
  let pyServiceHealth: any = null;
  let pyServiceStatus = 'offline';

  try {
    const res = await fetch(`${pdfServiceUrl}/health`, { signal: AbortSignal.timeout(2000) });
    if (res.ok) {
      pyServiceHealth = await res.json();
      pyServiceStatus = 'online';
    }
  } catch (e: any) {
    pyServiceStatus = 'unreachable';
  }

  const dbStatus = await getDatabaseStatus();
  const maxSizeBytes = parseInt(process.env.MAX_FILE_SIZE_BYTES || '26214400', 10);

  const docAiProvider = process.env.DOC_AI_PROVIDER || 'none';
  const hasDocAiKey = Boolean(process.env.DOC_AI_API_KEY);

  return NextResponse.json({
    pdf_processing_service: {
      url: pdfServiceUrl,
      status: pyServiceStatus,
      engine: 'PyMuPDF + FastAPI (Python)',
      details: pyServiceHealth
    },
    ocr_service: {
      enabled: process.env.ENABLE_OCR !== 'false',
      status: pyServiceHealth?.ocr_available ? 'active' : 'engine_missing',
      engine: pyServiceHealth?.ocr_engine || 'Tesseract OCR engine detection'
    },
    document_processing_api: {
      provider: docAiProvider !== 'none' ? docAiProvider : 'Not Selected (Using local PyMuPDF extraction)',
      configured: docAiProvider !== 'none' && hasDocAiKey,
      has_credentials: hasDocAiKey
    },
    database: dbStatus,
    limits: {
      max_upload_size_bytes: maxSizeBytes,
      max_upload_size_mb: (maxSizeBytes / (1024 * 1024)).toFixed(0) + ' MB',
      supported_formats: ['PDF (.pdf)'],
      precision_mode: 'Decimal-safe arithmetic (Paise tolerance: ₹0.05)'
    }
  });
}
