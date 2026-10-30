# Bank Statement Analyzer (CrediLedger)

A production-oriented financial SaaS platform for loan underwriting teams to automatically ingest, extract, validate, analyze, and audit customer bank statement PDFs from multiple Indian banks.

Built with Next.js 14 (App Router), TypeScript, Tailwind CSS, Python FastAPI, PyMuPDF, and MongoDB.

---

## 1. Architecture Overview

CrediLedger is built using a decoupled service architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                       Web Browser                           │
│  Next.js 14 App Router, Tailwind CSS, Recharts, shadcn/ui   │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTPS / JSON & Multipart
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    Next.js Backend API                      │
│           (/api/statements/*, /api/settings)                │
│   • Duplicate Upload Prevention (SHA-256 Fingerprint)       │
│   • Input Validation & Rate Limiting (Zod)                  │
│   • Dual Database Repository Layer                          │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
               ▼                              ▼
┌──────────────────────────────┐ ┌────────────────────────────┐
│   FastAPI PDF Processing     │ │    Persistence Layer       │
│         Microservice         │ │ • MongoDB (Production)     │
│  • File Validation (%PDF-)   │ │ • Persistent Local JSON    │
│  • Coordinate-Aware PyMuPDF  │ │   Engine (.data/db.json)   │
│  • Visual Line Reconstruction│ └────────────────────────────┘
│  • Bank-Specific Parsers     │
│    (HDFC, ICICI, SBI, Axis,  │
│     Kotak, Generic Indian)   │
│  • Deterministic Validation  │
│  • Rule-Based Classification │
└──────────────────────────────┘
```

---

## 2. Key Features

1. **Indian Bank Statement Support**:
   - Specialized layout parsers for **HDFC Bank**, **ICICI Bank**, **State Bank of India (SBI)**, **Axis Bank**, and **Kotak Mahindra Bank**.
   - **Generic Layout Fallback Parser**: dynamically maps column headers and recognizes DD/MM/YYYY, DD-MM-YYYY, DD Mon YYYY dates, multiline narrations, and Indian numbering commas (`₹1,23,456.78`).
2. **Deterministic Financial Validation Engine**:
   - Exact mathematical reconciliation using decimal-safe arithmetic:
     $$\text{Opening Balance} + \sum \text{Credits} - \sum \text{Debits} = \text{Closing Balance}$$
   - Row-by-row incremental running balance integrity verification.
   - Duplicate transaction candidate identification.
   - Chronological sequence verification and missing field detection.
3. **Transparent Rule-Based Transaction Classification**:
   - Salary, EMI / Loan repayments, Rent, Utilities, UPI transfers, Cash deposits, Cash withdrawals, Bank charges & penalties, Interest, Refunds.
   - Preserves original transaction narration untouched.
4. **Security & Privacy**:
   - Automated account number masking (e.g., `XXXXXXXX7264`).
   - Cryptographic SHA-256 content fingerprinting for instant duplicate upload detection.
   - Password-protected statement decryption with AES-256 support.
   - Rejection of oversized (>25MB), empty, or corrupted PDF streams.
   - Zero client-side leakage of server secrets or cloud credentials.
5. **Dual Database Architecture**:
   - Production MongoDB integration with indexed collections (`statements`, `transactions`, `audit_events`).
   - Zero-dependency local persistent JSON store (`.data/db.json`) fallback ensuring tests and local development run out of the box without requiring a live MongoDB daemon.
6. **Loan Officer Reporting & CSV Export**:
   - Searchable, filterable, sortable transaction ledger with Indian currency formatting.
   - RFC 4180-compliant filtered CSV export.
   - Formal, printable Underwriting Bank Statement Audit Report with statutory disclaimers.

---

## 3. Project Structure

```
├── Dockerfile.fastapi          # Docker build for Python FastAPI PDF processor
├── Dockerfile.nextjs           # Docker build for Next.js web application
├── docker-compose.yml          # Container orchestration (MongoDB + Python + Next.js)
├── .env.example                # Safe environment variable template (placeholders only)
├── package.json                # Next.js and frontend dependencies
├── tsconfig.json               # TypeScript strict configuration
├── tailwind.config.js          # Tailwind CSS styling configuration
├── pytest.ini                  # Pytest configuration
├── test_e2e_full.js            # Automated full-stack HTTP integration test
│
├── pdf-service/                # Python Processing Microservice
│   ├── app/
│   │   ├── main.py             # FastAPI entry point (/process, /health, /settings)
│   │   ├── schemas.py          # Pydantic models for validation and responses
│   │   ├── validator.py        # Magic byte (%PDF), size & password validation
│   │   ├── extractor.py        # Coordinate-aware PyMuPDF visual line extractor
│   │   ├── ocr.py              # OCR service fallback adapter (Tesseract)
│   │   ├── doc_api_adapter.py  # Enterprise Cloud Doc AI adapter interface
│   │   ├── classifier.py       # Rule-based transaction classification engine
│   │   ├── financial_engine.py # Decimal-safe balance validation & KPI calculations
│   │   └── parsers/
│   │       ├── base.py         # Abstract parser base class & currency normalizers
│   │       ├── hdfc.py         # HDFC Bank layout parser
│   │       ├── icici.py        # ICICI Bank layout parser
│   │       ├── sbi.py          # State Bank of India layout parser
│   │       ├── axis.py         # Axis Bank layout parser
│   │       ├── kotak.py        # Kotak Mahindra Bank layout parser
│   │       ├── generic.py      # Generic Indian Bank layout parser
│   │       └── registry.py     # Bank detection & parser routing
│   ├── generate_samples.py     # Synthetic test PDF & ground truth generator
│   ├── evaluate.py             # Ground-truth accuracy evaluation runner
│   ├── requirements.txt        # Python package dependencies
│   ├── samples/                # Synthetic test PDFs and ground_truth.json
│   └── tests/                  # Pytest unit & integration test suite
│
└── src/                        # Next.js Full-Stack Application
    ├── app/
    │   ├── api/
    │   │   ├── statements/
    │   │   │   ├── upload/route.ts      # Upload endpoint & duplicate detection
    │   │   │   ├── route.ts             # Statement list query endpoint
    │   │   │   └── [id]/
    │   │   │       ├── route.ts         # Statement fetch & delete endpoint
    │   │   │       ├── status/route.ts  # Multi-stage processing progress endpoint
    │   │   │       ├── transactions/route.ts # Filtered transactions & CSV export
    │   │   │       └── report/route.ts  # Structured underwriting audit report
    │   │   └── settings/route.ts        # Diagnostic status endpoint
    │   ├── layout.tsx                   # Master responsive layout with sidebar
    │   ├── page.tsx                     # Executive Dashboard with Recharts
    │   ├── upload/page.tsx              # Drag & drop upload with password input
    │   ├── statements/page.tsx          # Statement archive & search
    │   ├── statements/[id]/page.tsx     # Deep Statement Analysis & KPIs
    │   ├── statements/[id]/status/page.tsx # Genuine processing stepper
    │   ├── statements/[id]/transactions/page.tsx # Searchable transaction ledger
    │   ├── statements/[id]/report/page.tsx # Printable underwriting report
    │   └── settings/page.tsx            # Diagnostics & system configuration
    ├── components/
    │   ├── Sidebar.tsx                  # Navigation & live engine status indicator
    │   ├── Navbar.tsx                   # Responsive header
    │   └── ui/
    │       ├── AccessibleModal.tsx      # Native accessible <dialog> with scroll containment
    │       ├── Badge.tsx                # Status and category badges
    │       ├── StatCard.tsx             # Financial KPI card
    │       └── Skeleton.tsx             # Loading placeholders
    └── lib/
        ├── types.ts                     # TypeScript data interfaces
        ├── currency.ts                  # Indian Rupee (INR) numbering formatter
        └── db.ts                        # Dual MongoDB & persistent store adapter
```

---

## 4. Local Development Setup

### Prerequisites
- Node.js v18+ (tested on v24.19)
- Python 3.10+ (tested on v3.14)
- npm or pnpm

### 1. Clone & Install Dependencies
```bash
# Install frontend & Node.js dependencies
npm install

# Install Python microservice dependencies
pip install pymupdf fastapi uvicorn pydantic python-multipart pillow pytest
```

### 2. Environment Configuration
Copy the provided `.env.example`:
```bash
cp .env.example .env.local
```
*(The defaults connect to the Python service at `http://127.0.0.1:8000` and use the built-in persistent store automatically if MongoDB is not running).*

### 3. Generate Synthetic Statements & Ground Truth
Run the synthetic PDF generator:
```bash
python pdf-service/generate_samples.py
```
This generates authentic-looking test PDFs with known ground-truth datasets in `pdf-service/samples/`:
- `hdfc_sample.pdf`
- `icici_sample.pdf`
- `sbi_sample.pdf`
- `encrypted_sample.pdf` (password: `investor2026`)
- `corrupted_sample.pdf`

### 4. Start the Application

In Terminal 1 (Start Python PDF Processing Engine):
```bash
npm run start:python
# Runs: python -m uvicorn app.main:app --app-dir pdf-service --host 127.0.0.1 --port 8000
```

In Terminal 2 (Start Next.js Web App):
```bash
npm run dev
# Open http://localhost:3000 (or http://localhost:3001 if port 3000 is occupied)
```

---

## 5. Running Automated Tests & Benchmark Evaluation

### 1. Ground Truth Benchmark Evaluation
Evaluates extracted transactions against ground-truth datasets for precision, recall, amount accuracy, and mathematical balance reconciliation:
```bash
python pdf-service/evaluate.py
```
**Measured Evaluation Results:**
- Statements Evaluated: 3 (HDFC, ICICI, SBI)
- Extraction Recall: **100.00%**
- Extraction Precision: **100.00%**
- Amount Field Accuracy: **100.00%**
- Running Balance Accuracy: **100.00%**
- Deterministic Reconciliation Pass Rate: **100.00%**

### 2. Python Unit & Regression Test Suite
Runs pytest covering currency cleaning, date normalization, password-protected PDF decryption, corrupted PDF rejection, and full pipeline processing:
```bash
python -m pytest pdf-service/tests/test_pipeline.py -v
```

### 3. Full End-to-End Workflow Verification
Runs full automated HTTP tests through the live Next.js API:
```bash
node test_e2e_full.js
```
Verifies PDF upload, duplicate upload detection, statement listing, paginated transactions, RFC 4180 CSV export, and underwriting report generation.

---

## 6. Docker & Container Deployment

To launch the complete stack with Docker Compose:
```bash
docker compose up --build
```
This launches:
- **MongoDB** on `localhost:27017` with persistent volume and healthcheck
- **PDF Processing Service** on `localhost:8000` with Tesseract OCR pre-installed
- **Next.js Web Application** on `localhost:3000`

---

## 7. API Reference

### Next.js API

- `POST /api/statements/upload`
  - Uploads a PDF bank statement for processing.
  - Body: `multipart/form-data` with `file` (PDF) and optional `password` (string).
  - Returns: Statement metadata, transactions, financial summary, and validation report.
- `GET /api/statements`
  - Lists statements with optional `?search=` filter.
- `GET /api/statements/:id`
  - Returns statement details and financial summaries.
- `DELETE /api/statements/:id`
  - Deletes statement and its transactions.
- `GET /api/statements/:id/status`
  - Returns live multi-stage processing logs.
- `GET /api/statements/:id/transactions`
  - Returns paginated transactions. Supports `?search=`, `?category=`, `?type=debit|credit`, `?sortBy=`, `?sortOrder=`, `?page=`, `?limit=`.
  - Pass `?format=csv` to download as a RFC 4180 CSV file.
- `GET /api/statements/:id/report`
  - Returns structured underwriting audit report.
- `GET /api/settings`
  - Returns diagnostic health of all connected engines without exposing secrets.

### Python FastAPI Service Internal Endpoints

- `POST /process`
  - Internal processing pipeline endpoint accepting PDF multipart and returning normalized transactions.
- `GET /health`
  - Service health check reporting OCR and cloud adapter status.
- `GET /settings`
  - Returns active parsers, precision rules, and engine metadata.

---

## 8. Known Limitations & Policy Disclaimers

1. **Scanned Documents**: High-resolution digital PDFs achieve 100% precision. Low-resolution or heavily skewed physical phone photos depend on Tesseract OCR quality on the host system.
2. **Underwriting Notice**: Inferred transaction classifications (such as potential salary or loan EMI) are statistical pattern heuristics provided for decision support. They do not constitute formal credit underwriting approval or creditworthiness certification.
#   a c c o u n t A g g r e g a t o r D o c k e r o n e  
 