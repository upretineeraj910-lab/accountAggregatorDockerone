import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { saveStatement, getStatementByFingerprint } from '@/lib/db';
import { Statement } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const password = (formData.get('password') as string) || '';
    const forceReanalyze = formData.get('force') === 'true';

    if (!file) {
      return NextResponse.json(
        { error: 'No PDF file provided. Please select a valid bank statement PDF.' },
        { status: 400 }
      );
    }

    // 1. File type and name check
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'Unsupported file type. Only PDF bank statements are accepted.' },
        { status: 415 }
      );
    }

    // 2. Size check
    const maxSizeBytes = parseInt(process.env.MAX_FILE_SIZE_BYTES || '26214400', 10);
    if (file.size > maxSizeBytes) {
      return NextResponse.json(
        {
          error: `File size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds configured limit of ${(maxSizeBytes / (1024 * 1024)).toFixed(0)} MB.`
        },
        { status: 413 }
      );
    }

    // 3. Compute SHA-256 fingerprint for duplicate detection
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const fingerprint = crypto.createHash('sha256').update(buffer).digest('hex');

    // Check for existing duplicate upload unless forced
    if (!forceReanalyze) {
      const existing = await getStatementByFingerprint(fingerprint);
      if (existing) {
        return NextResponse.json({
          is_duplicate: true,
          statement_id: existing.id,
          message: `This statement (${existing.filename}) was already uploaded on ${new Date(existing.uploaded_at).toLocaleDateString('en-IN')}.`,
          existing_statement: existing
        });
      }
    }

    // 4. Send to Python FastAPI Processing Service
    const pdfServiceUrl = process.env.PDF_SERVICE_URL || 'http://127.0.0.1:8000';
    const pyFormData = new FormData();
    const blob = new Blob([buffer], { type: 'application/pdf' });
    pyFormData.append('file', blob, file.name);
    if (password) {
      pyFormData.append('password', password);
    }

    let pyResponse: Response;
    try {
      pyResponse = await fetch(`${pdfServiceUrl}/process`, {
        method: 'POST',
        body: pyFormData
      });
    } catch (err: any) {
      return NextResponse.json(
        {
          error: 'PDF Processing Service is unreachable.',
          details: `Could not connect to Python backend at ${pdfServiceUrl}. Ensure the processing service is started (npm run start:python).`,
          service_error: err.message
        },
        { status: 503 }
      );
    }

    const pyData = await pyResponse.json();

    if (!pyResponse.ok) {
      const detail = pyData.detail;
      const code = typeof detail === 'object' ? detail.code : 'PROCESSING_ERROR';
      const msg = typeof detail === 'object' ? detail.message : (detail || 'Extraction failed.');

      return NextResponse.json(
        { error: msg, code },
        { status: pyResponse.status }
      );
    }

    // 5. Store in Database
    const statementId = `stmt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newStatement: Statement = {
      id: statementId,
      filename: file.name,
      file_size: file.size,
      content_fingerprint: fingerprint,
      status: 'completed',
      uploaded_at: new Date().toISOString(),
      metadata: pyData.statement_metadata,
      summary: pyData.financial_summary,
      validation: pyData.validation_report,
      raw_unparsed_lines: pyData.raw_unparsed_lines
    };

    await saveStatement(newStatement, pyData.transactions || []);

    return NextResponse.json({
      success: true,
      statement_id: statementId,
      statement: newStatement,
      transactions_count: pyData.transactions?.length || 0,
      validation: pyData.validation_report,
      processing_logs: pyData.processing_logs
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Internal Server Error during statement upload processing.', details: err.message },
      { status: 500 }
    );
  }
}
