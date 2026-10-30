import { NextRequest, NextResponse } from 'next/server';
import { getStatementById, getTransactionsByStatementId } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const statement = await getStatementById(params.id);
    if (!statement) {
      return NextResponse.json(
        { error: 'Statement not found' },
        { status: 404 }
      );
    }

    const { transactions } = await getTransactionsByStatementId(params.id, {
      limit: 1000
    });

    const report = {
      report_generated_at: new Date().toISOString(),
      report_type: 'Underwriting Bank Statement Analysis',
      statement: {
        id: statement.id,
        filename: statement.filename,
        uploaded_at: statement.uploaded_at,
        metadata: statement.metadata,
        summary: statement.summary,
        validation: statement.validation
      },
      key_underwriting_metrics: {
        account_holder: statement.metadata?.account_holder_name || 'Not Detected',
        masked_account: statement.metadata?.account_number_masked || 'Not Detected',
        bank_name: statement.metadata?.bank_name || 'Generic Bank',
        period: `${statement.summary?.start_date || 'N/A'} to ${statement.summary?.end_date || 'N/A'}`,
        opening_balance: statement.summary?.opening_balance,
        closing_balance: statement.summary?.closing_balance,
        total_inflows: statement.summary?.total_credits,
        total_outflows: statement.summary?.total_debits,
        net_cashflow: statement.summary?.net_cashflow,
        avg_monthly_credit: statement.summary?.avg_monthly_credits,
        avg_monthly_debit: statement.summary?.avg_monthly_debits,
        potential_salary_inflows: statement.summary?.potential_salary_credits,
        potential_emi_obligations: statement.summary?.potential_emi_debits,
        cash_withdrawals: statement.summary?.cash_withdrawals_total,
        cash_deposits: statement.summary?.cash_deposits_total,
        bank_charges: statement.summary?.bank_charges_total
      },
      validation_summary: {
        arithmetic_reconciliation: statement.validation?.is_valid ? 'PASSED' : 'DISCREPANCY_DETECTED',
        reconciliation_formula: statement.validation?.reconciliation_formula,
        discrepancy_amount: statement.validation?.discrepancy_amount,
        duplicate_candidates: statement.validation?.duplicate_candidates_count,
        chronological_anomalies: statement.validation?.chronological_issues_count
      },
      disclaimer: (
        'DISCLAIMER: This automated bank statement extraction and classification summary is provided solely for ' +
        'decision-support assistance. Inferred categories (such as potential salary or loan EMI) are statistical pattern heuristics ' +
        'and do not constitute definitive creditworthiness certification or loan underwriting approval. Authoritative loan decisions ' +
        'must verify primary physical documentation.'
      )
    };

    return NextResponse.json(report);
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Failed to generate report', details: err.message },
      { status: 500 }
    );
  }
}
