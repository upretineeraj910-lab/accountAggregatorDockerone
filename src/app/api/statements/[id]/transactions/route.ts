import { NextRequest, NextResponse } from 'next/server';
import { getTransactionsByStatementId, getStatementById } from '@/lib/db';

export const dynamic = 'force-dynamic';

function escapeCsvCell(val: any): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || undefined;
    const category = searchParams.get('category') || undefined;
    const type = (searchParams.get('type') as 'all' | 'debit' | 'credit') || undefined;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const sortBy = (searchParams.get('sortBy') as any) || 'date';
    const sortOrder = (searchParams.get('sortOrder') as any) || 'desc';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '25', 10);
    const format = searchParams.get('format');

    const statement = await getStatementById(params.id);
    if (!statement) {
      return NextResponse.json(
        { error: 'Statement not found' },
        { status: 404 }
      );
    }

    // If CSV export is requested, retrieve ALL matching transactions without pagination
    if (format === 'csv') {
      const allResult = await getTransactionsByStatementId(params.id, {
        search,
        category,
        type,
        startDate,
        endDate,
        sortBy,
        sortOrder,
        page: 1,
        limit: 100000
      });

      const headers = ['Date', 'Description', 'Reference No', 'Debit (INR)', 'Credit (INR)', 'Balance (INR)', 'Category', 'Confidence', 'Page'];
      const rows = allResult.transactions.map(t => [
        escapeCsvCell(t.date),
        escapeCsvCell(t.description),
        escapeCsvCell(t.reference_number || ''),
        escapeCsvCell(t.debit > 0 ? t.debit.toFixed(2) : '0.00'),
        escapeCsvCell(t.credit > 0 ? t.credit.toFixed(2) : '0.00'),
        escapeCsvCell(t.balance.toFixed(2)),
        escapeCsvCell(t.category),
        escapeCsvCell(t.confidence ? (t.confidence * 100).toFixed(0) + '%' : '100%'),
        escapeCsvCell(t.source_page)
      ]);

      const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');

      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="transactions_${params.id}.csv"`
        }
      });
    }

    const result = await getTransactionsByStatementId(params.id, {
      search,
      category,
      type,
      startDate,
      endDate,
      sortBy,
      sortOrder,
      page,
      limit
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Failed to fetch transactions', details: err.message },
      { status: 500 }
    );
  }
}
