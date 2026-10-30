import fs from 'fs';
import path from 'path';
import { MongoClient, Db } from 'mongodb';
import { Statement, Transaction, AuditEvent } from './types';

export interface TransactionQuery {
  search?: string;
  category?: string;
  type?: 'all' | 'debit' | 'credit';
  startDate?: string;
  endDate?: string;
  sortBy?: 'date' | 'amount' | 'balance' | 'description';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

const DATA_DIR = path.join(process.cwd(), '.data');
const LOCAL_DB_FILE = path.join(DATA_DIR, 'db.json');

interface LocalDatabaseSchema {
  statements: Statement[];
  transactions: Transaction[];
  audit_events: AuditEvent[];
}

let mongoClient: MongoClient | null = null;
let mongoDb: Db | null = null;
let isMongoConnected = false;
let mongoInitAttempted = false;

// Ensure local persistence directory exists
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(LOCAL_DB_FILE)) {
    const initial: LocalDatabaseSchema = {
      statements: [],
      transactions: [],
      audit_events: []
    };
    fs.writeFileSync(LOCAL_DB_FILE, JSON.stringify(initial, null, 2), 'utf-8');
  }
}

function readLocalDb(): LocalDatabaseSchema {
  ensureDataDir();
  try {
    const raw = fs.readFileSync(LOCAL_DB_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { statements: [], transactions: [], audit_events: [] };
  }
}

function writeLocalDb(data: LocalDatabaseSchema) {
  ensureDataDir();
  fs.writeFileSync(LOCAL_DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

export async function initDb(): Promise<{ type: 'mongodb' | 'local_json'; connected: boolean; message: string }> {
  if (mongoInitAttempted) {
    return {
      type: isMongoConnected ? 'mongodb' : 'local_json',
      connected: isMongoConnected,
      message: isMongoConnected ? 'Connected to MongoDB' : 'Persistent Local Storage Active (MongoDB server offline)'
    };
  }

  mongoInitAttempted = true;
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/bank_statement_analyzer';

  try {
    // Attempt connection with 2.5s timeout so startup is fast
    mongoClient = new MongoClient(uri, { serverSelectionTimeoutMS: 2500 });
    await mongoClient.connect();
    const dbName = process.env.MONGODB_DB_NAME || 'bank_statement_analyzer';
    mongoDb = mongoClient.db(dbName);
    isMongoConnected = true;

    // Create indexes for statement_id, date, and fingerprint
    await mongoDb.collection('statements').createIndex({ content_fingerprint: 1 });
    await mongoDb.collection('statements').createIndex({ uploaded_at: -1 });
    await mongoDb.collection('transactions').createIndex({ statement_id: 1, date: 1 });
    await mongoDb.collection('transactions').createIndex({ statement_id: 1, category: 1 });

    return {
      type: 'mongodb',
      connected: true,
      message: `Connected to MongoDB database '${dbName}'`
    };
  } catch (err: any) {
    isMongoConnected = false;
    return {
      type: 'local_json',
      connected: false,
      message: `MongoDB offline (${err.message}). Using local persistent database.`
    };
  }
}

export async function getDatabaseStatus() {
  await initDb();
  const dbData = readLocalDb();
  return {
    engine: isMongoConnected ? 'MongoDB Server' : 'Persistent JSON Store (Zero-Dependency Engine)',
    connected: isMongoConnected,
    uri: isMongoConnected ? (process.env.MONGODB_URI || '').replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@') : 'Local Storage (.data/db.json)',
    total_statements: isMongoConnected && mongoDb ? await mongoDb.collection('statements').countDocuments() : dbData.statements.length,
    total_transactions: isMongoConnected && mongoDb ? await mongoDb.collection('transactions').countDocuments() : dbData.transactions.length
  };
}

export async function saveStatement(statement: Statement, transactions: Transaction[]): Promise<void> {
  await initDb();

  if (isMongoConnected && mongoDb) {
    await mongoDb.collection('statements').updateOne(
      { id: statement.id },
      { $set: statement },
      { upsert: true }
    );

    // Save transactions with statement_id attached
    if (transactions.length > 0) {
      const txnsWithStmtId = transactions.map(t => ({ ...t, statement_id: statement.id }));
      await mongoDb.collection('transactions').deleteMany({ statement_id: statement.id });
      await mongoDb.collection('transactions').insertMany(txnsWithStmtId);
    }

    // Audit log
    await mongoDb.collection('audit_events').insertOne({
      id: `audit_${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: 'STATEMENT_SAVED',
      statement_id: statement.id,
      details: {
        filename: statement.filename,
        transaction_count: transactions.length,
        is_valid: statement.validation?.is_valid
      }
    });
  } else {
    // Local JSON store
    const db = readLocalDb();
    const existingIdx = db.statements.findIndex(s => s.id === statement.id);
    if (existingIdx >= 0) {
      db.statements[existingIdx] = statement;
    } else {
      db.statements.unshift(statement);
    }

    // Replace transactions for this statement
    db.transactions = db.transactions.filter(t => t.statement_id !== statement.id);
    const txnsWithStmtId = transactions.map(t => ({ ...t, statement_id: statement.id }));
    db.transactions.push(...txnsWithStmtId);

    // Audit log
    db.audit_events.unshift({
      id: `audit_${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: 'STATEMENT_SAVED',
      statement_id: statement.id,
      details: {
        filename: statement.filename,
        transaction_count: transactions.length,
        is_valid: statement.validation?.is_valid
      }
    });

    writeLocalDb(db);
  }
}

export async function getStatements(): Promise<Statement[]> {
  await initDb();
  if (isMongoConnected && mongoDb) {
    const list = await mongoDb.collection<Statement>('statements').find().sort({ uploaded_at: -1 }).toArray();
    return list;
  } else {
    const db = readLocalDb();
    return db.statements.sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime());
  }
}

export async function getStatementById(id: string): Promise<Statement | null> {
  await initDb();
  if (isMongoConnected && mongoDb) {
    const stmt = await mongoDb.collection<Statement>('statements').findOne({ id });
    return stmt;
  } else {
    const db = readLocalDb();
    return db.statements.find(s => s.id === id) || null;
  }
}

export async function getStatementByFingerprint(fingerprint: string): Promise<Statement | null> {
  await initDb();
  if (isMongoConnected && mongoDb) {
    return await mongoDb.collection<Statement>('statements').findOne({ content_fingerprint: fingerprint });
  } else {
    const db = readLocalDb();
    return db.statements.find(s => s.content_fingerprint === fingerprint) || null;
  }
}

export async function deleteStatement(id: string): Promise<boolean> {
  await initDb();
  if (isMongoConnected && mongoDb) {
    await mongoDb.collection('statements').deleteOne({ id });
    await mongoDb.collection('transactions').deleteMany({ statement_id: id });
    await mongoDb.collection('audit_events').insertOne({
      id: `audit_${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: 'STATEMENT_DELETED',
      statement_id: id
    });
    return true;
  } else {
    const db = readLocalDb();
    const countBefore = db.statements.length;
    db.statements = db.statements.filter(s => s.id !== id);
    db.transactions = db.transactions.filter(t => t.statement_id !== id);
    db.audit_events.unshift({
      id: `audit_${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: 'STATEMENT_DELETED',
      statement_id: id
    });
    writeLocalDb(db);
    return db.statements.length < countBefore;
  }
}

export async function getTransactionsByStatementId(
  statementId: string,
  query: TransactionQuery = {}
): Promise<{ transactions: Transaction[]; total: number; page: number; totalPages: number }> {
  await initDb();

  let allTxns: Transaction[] = [];

  if (isMongoConnected && mongoDb) {
    const filter: Record<string, any> = { statement_id: statementId };
    if (query.category && query.category !== 'all') {
      filter.category = query.category;
    }
    if (query.type === 'debit') {
      filter.debit = { $gt: 0 };
    } else if (query.type === 'credit') {
      filter.credit = { $gt: 0 };
    }
    if (query.search) {
      filter.description = { $regex: query.search, $options: 'i' };
    }
    if (query.startDate) {
      filter.date = { ...filter.date, $gte: query.startDate };
    }
    if (query.endDate) {
      filter.date = { ...filter.date, $lte: query.endDate };
    }

    const sortField = query.sortBy || 'date';
    const sortDir = query.sortOrder === 'asc' ? 1 : -1;
    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, query.limit || 25);
    const skip = (page - 1) * limit;

    const total = await mongoDb.collection('transactions').countDocuments(filter);
    const list = await mongoDb.collection<Transaction>('transactions')
      .find(filter)
      .sort({ [sortField]: sortDir })
      .skip(skip)
      .limit(limit)
      .toArray();

    return {
      transactions: list,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  } else {
    // Local JSON query engine
    const db = readLocalDb();
    allTxns = db.transactions.filter(t => t.statement_id === statementId);

    // Filter by search
    if (query.search) {
      const q = query.search.toLowerCase();
      allTxns = allTxns.filter(t => t.description.toLowerCase().includes(q) || (t.reference_number && t.reference_number.toLowerCase().includes(q)));
    }

    // Filter by category
    if (query.category && query.category !== 'all') {
      allTxns = allTxns.filter(t => t.category === query.category);
    }

    // Filter by type
    if (query.type === 'debit') {
      allTxns = allTxns.filter(t => t.debit > 0);
    } else if (query.type === 'credit') {
      allTxns = allTxns.filter(t => t.credit > 0);
    }

    // Filter by date range
    if (query.startDate) {
      allTxns = allTxns.filter(t => t.date >= query.startDate!);
    }
    if (query.endDate) {
      allTxns = allTxns.filter(t => t.date <= query.endDate!);
    }

    // Sort
    const sortField = query.sortBy || 'date';
    const sortDir = query.sortOrder === 'asc' ? 1 : -1;

    allTxns.sort((a, b) => {
      let vA = (a as any)[sortField];
      let vB = (b as any)[sortField];
      if (sortField === 'amount') {
        vA = Math.max(a.debit, a.credit);
        vB = Math.max(b.debit, b.credit);
      }
      if (vA < vB) return -1 * sortDir;
      if (vA > vB) return 1 * sortDir;
      return 0;
    });

    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, query.limit || 25);
    const total = allTxns.length;
    const startIndex = (page - 1) * limit;
    const paginated = allTxns.slice(startIndex, startIndex + limit);

    return {
      transactions: paginated,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  }
}

export async function getDashboardStats() {
  const statements = await getStatements();
  const totalStatements = statements.length;
  const completedStatements = statements.filter(s => s.status === 'completed');
  const validStatements = completedStatements.filter(s => s.validation?.is_valid);

  let totalTransactions = 0;
  let totalCredits = 0;
  let totalDebits = 0;

  // Monthly aggregated metrics across real statements
  const monthlyAgg: Record<string, { credit: number; debit: number; count: number }> = {};

  for (const s of completedStatements) {
    if (s.summary) {
      totalTransactions += s.summary.transaction_count || 0;
      totalCredits += s.summary.total_credits || 0;
      totalDebits += s.summary.total_debits || 0;

      for (const m of s.summary.monthly_metrics || []) {
        if (!monthlyAgg[m.month]) {
          monthlyAgg[m.month] = { credit: 0, debit: 0, count: 0 };
        }
        monthlyAgg[m.month].credit += m.total_credit;
        monthlyAgg[m.month].debit += m.total_debit;
        monthlyAgg[m.month].count += m.transaction_count;
      }
    }
  }

  const monthlyCharts = Object.keys(monthlyAgg).sort().map(month => ({
    month,
    credits: monthlyAgg[month].credit,
    debits: monthlyAgg[month].debit,
    net: monthlyAgg[month].credit - monthlyAgg[month].debit,
    transactions: monthlyAgg[month].count
  }));

  return {
    total_statements: totalStatements,
    completed_statements: completedStatements.length,
    valid_statements: validStatements.length,
    validation_pass_rate: totalStatements > 0 ? Math.round((validStatements.length / totalStatements) * 100) : 0,
    total_transactions: totalTransactions,
    total_credits: totalCredits,
    total_debits: totalDebits,
    recent_statements: statements.slice(0, 5),
    monthly_charts: monthlyCharts
  };
}
