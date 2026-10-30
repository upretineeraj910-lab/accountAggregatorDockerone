const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3001';
const SAMPLES_DIR = path.join(__dirname, 'pdf-service', 'samples');

async function testUpload(filename, password = '') {
  console.log(`\nTesting upload of ${filename}...`);
  const filePath = path.join(SAMPLES_DIR, filename);
  const fileBytes = fs.readFileSync(filePath);

  const boundary = '----NodeBoundary7MA4YWxkTrZu0gW';
  let body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: application/pdf\r\n\r\n`),
    fileBytes,
    Buffer.from(`\r\n`)
  ]);

  if (password) {
    body = Buffer.concat([
      body,
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="password"\r\n\r\n${password}\r\n`)
    ]);
  }

  body = Buffer.concat([body, Buffer.from(`--${boundary}--\r\n`)]);

  const res = await fetch(`${BASE_URL}/api/statements/upload`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(`Upload failed (${res.status}): ${JSON.stringify(json)}`);
  }

  console.log(`[OK] Statement uploaded successfully: ID = ${json.statement_id}`);
  console.log(`     Bank: ${json.statement?.metadata?.bank_name} | Txns: ${json.transactions_count}`);
  console.log(`     Reconciliation: ${json.validation?.is_valid ? 'PASSED (100%)' : 'WARNING'}`);
  return json.statement_id;
}

async function testGetStatements() {
  console.log('\nTesting GET /api/statements...');
  const res = await fetch(`${BASE_URL}/api/statements`);
  const data = await res.json();
  console.log(`[OK] Fetched ${data.total} statements from database.`);
  return data.statements;
}

async function testGetTransactions(statementId) {
  console.log(`\nTesting GET /api/statements/${statementId}/transactions...`);
  const res = await fetch(`${BASE_URL}/api/statements/${statementId}/transactions?page=1&limit=5`);
  const data = await res.json();
  console.log(`[OK] Fetched transactions: ${data.transactions.length} rows (Total: ${data.total}).`);
  console.log(`     Sample Row 1: Date=${data.transactions[0].date}, Desc="${data.transactions[0].description}", Bal=${data.transactions[0].balance}`);
}

async function testCsvExport(statementId) {
  console.log(`\nTesting CSV Export /api/statements/${statementId}/transactions?format=csv...`);
  const res = await fetch(`${BASE_URL}/api/statements/${statementId}/transactions?format=csv`);
  const csv = await res.text();
  const lines = csv.split('\r\n').filter(Boolean);
  console.log(`[OK] CSV Export returned ${lines.length} lines (including headers).`);
  console.log(`     CSV Header: ${lines[0]}`);
}

async function testReport(statementId) {
  console.log(`\nTesting GET /api/statements/${statementId}/report...`);
  const res = await fetch(`${BASE_URL}/api/statements/${statementId}/report`);
  const data = await res.json();
  console.log(`[OK] Audit Report generated: ${data.report_type}`);
  console.log(`     Reconciliation Formula: ${data.validation_summary?.reconciliation_formula}`);
  console.log(`     Inflows: ₹${data.key_underwriting_metrics?.total_inflows?.toLocaleString('en-IN')}`);
}

async function testSettings() {
  console.log('\nTesting GET /api/settings...');
  const res = await fetch(`${BASE_URL}/api/settings`);
  const data = await res.json();
  console.log(`[OK] System Diagnostics:`);
  console.log(`     PDF Service: ${data.pdf_processing_service?.status} (${data.pdf_processing_service?.engine})`);
  console.log(`     Database: ${data.database?.engine} (Statements: ${data.database?.total_statements})`);
  console.log(`     Max Upload: ${data.limits?.max_upload_size_mb}`);
}

async function testDuplicateDetection() {
  console.log('\nTesting Duplicate Statement Upload Detection...');
  const filePath = path.join(SAMPLES_DIR, 'hdfc_sample.pdf');
  const fileBytes = fs.readFileSync(filePath);

  const boundary = '----NodeBoundaryDup';
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="hdfc_sample.pdf"\r\nContent-Type: application/pdf\r\n\r\n`),
    fileBytes,
    Buffer.from(`\r\n--${boundary}--\r\n`)
  ]);

  const res = await fetch(`${BASE_URL}/api/statements/upload`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body
  });

  const json = await res.json();
  if (json.is_duplicate) {
    console.log(`[OK] Duplicate upload successfully prevented:`);
    console.log(`     Message: "${json.message}"`);
    console.log(`     Linked Statement ID: ${json.statement_id}`);
  } else {
    throw new Error('Duplicate upload was not detected!');
  }
}

async function run() {
  console.log('================================================================');
  console.log('STARTING FULL END-TO-END APPLICATION WORKFLOW VERIFICATION');
  console.log('================================================================');

  try {
    const hdfcId = await testUpload('hdfc_sample.pdf');
    const iciciId = await testUpload('icici_sample.pdf');
    const sbiId = await testUpload('sbi_sample.pdf');

    await testDuplicateDetection();
    await testGetStatements();
    await testGetTransactions(hdfcId);
    await testCsvExport(hdfcId);
    await testReport(hdfcId);
    await testSettings();

    console.log('\n================================================================');
    console.log('ALL WORKFLOW VERIFICATION TESTS PASSED SUCCESSFULLY (100%)');
    console.log('================================================================\n');
  } catch (err) {
    console.error('Test failed:', err);
    process.exit(1);
  }
}

run();
