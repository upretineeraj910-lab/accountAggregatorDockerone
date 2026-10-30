import { NextRequest, NextResponse } from 'next/server';
import { getStatements } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.toLowerCase() || '';

    let statements = await getStatements();

    if (search) {
      statements = statements.filter(s =>
        s.filename.toLowerCase().includes(search) ||
        s.metadata?.bank_name.toLowerCase().includes(search) ||
        (s.metadata?.account_holder_name && s.metadata.account_holder_name.toLowerCase().includes(search))
      );
    }

    return NextResponse.json({
      total: statements.length,
      statements
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Failed to fetch statements', details: err.message },
      { status: 500 }
    );
  }
}
