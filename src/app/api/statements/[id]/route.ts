import { NextRequest, NextResponse } from 'next/server';
import { getStatementById, deleteStatement } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const statement = await getStatementById(params.id);
    if (!statement) {
      return NextResponse.json(
        { error: `Statement with ID '${params.id}' was not found.` },
        { status: 404 }
      );
    }

    return NextResponse.json({ statement });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Failed to retrieve statement.', details: err.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const success = await deleteStatement(params.id);
    if (!success) {
      return NextResponse.json(
        { error: `Statement '${params.id}' could not be deleted or does not exist.` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Statement '${params.id}' and its extracted transactions were deleted successfully.`
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Failed to delete statement.', details: err.message },
      { status: 500 }
    );
  }
}
