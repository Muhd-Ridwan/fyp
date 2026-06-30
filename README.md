# DocuVault AI

A department-scoped cloud document management system built as a Final Year Project. Employees can upload, organise, and query documents within their own department. An AI assistant powered by a **Retrieval-Augmented Generation (RAG)** pipeline answers questions grounded strictly in that department's documents.

---

## Features

- **Department isolation** — employees can only see files belonging to their own department
- **Folder & file management** — create folders, upload documents, rename, and delete
- **AI Assistant** — ask natural-language questions; answers are sourced from your department's documents with source citations
- **Admin panel** — system admins can register employees, reassign departments, and lock/unlock accounts
- **First-login onboarding** — employees set their password and verify identity via NRIC on first login
- **Forgot password** — self-service password reset via Resend transactional email
- **Supported file types** — PDF, DOCX, XLSX, PPTX, CSV, PNG, JPG/JPEG

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4 |
| Backend | FastAPI (Python 3.12), Uvicorn |
| Authentication | AWS Cognito (User Pool + App Client) |
| Storage | AWS S3 |
| Database | AWS DynamoDB (Employees, Folders, Documents tables) |
| Vector Database | Pinecone Serverless (1024-dim index, top-k 10 chunks retrieved per query) |
| Embeddings | AWS Bedrock — Amazon Titan Embeddings V2 |
| AI Generation | AWS Bedrock — Claude Haiku 4.5 |
| Email | Resend |
| Deployment | AWS Elastic Beanstalk (backend) via GitHub Actions CI/CD |

---

## Architecture Overview

```
Browser (React + Vite)
    │
    │  HTTPS  (Cognito ID Token as Bearer header)
    ▼
FastAPI (AWS Elastic Beanstalk)
    ├── auth.py          — verifies Cognito JWT locally (JWKS cached 1 hr)
    ├── dependencies.py  — resolves employee profile from DynamoDB
    ├── documents.py     — S3 upload/download/delete + RAG indexing
    ├── folders.py       — folder CRUD in DynamoDB
    ├── chat.py          — RAG query endpoint
    ├── admin.py         — employee management (Cognito + DynamoDB + Resend)
    ├── onboarding.py    — first-login NRIC verification
    └── profile.py       — employee profile reads
         │
         ├── AWS S3          (file storage)
         ├── AWS DynamoDB    (metadata)
         ├── AWS Cognito     (identity)
         ├── Pinecone        (vector search)
         └── AWS Bedrock     (embeddings + generation)
```

---

## Authentication & Sign-in Flow

1. **Admin registers an employee** via the Admin Panel — this creates a Cognito account with a temporary password and sends the credentials to the employee's personal email (via Resend).
2. **Employee logs in** with their work email and the temporary password.
3. **First-login onboarding** — Cognito returns `NEW_PASSWORD_REQUIRED`. The employee is redirected to the Onboarding page where they set a new permanent password and verify their identity using the last 4 characters of their NRIC (stored as a bcrypt hash in DynamoDB).
4. **Subsequent logins** — The frontend calls Cognito via `amazon-cognito-identity-js`, receives an ID token, and stores it in the session.
5. **Every API request** sends `Authorization: Bearer <id_token>`. The backend:
   - Fetches and caches the Cognito User Pool's public JWKS keys (refreshed every hour, no per-request AWS call)
   - Verifies the token signature, expiry, issuer, and audience locally
   - Extracts the `email` claim and looks up the employee record in DynamoDB
   - Returns `{ email, name, department, role }` — used for all downstream department scoping

---

## Department Scoping

Every authenticated request resolves to a `department` from DynamoDB. This value is used as a partition boundary across all data layers:

- **DynamoDB** — folders and documents are stored with a `department` attribute and queried by it
- **S3** — object keys include the department prefix
- **Pinecone** — all vectors are upserted with `department` in metadata; queries always filter `{ "department": { "$eq": department } }`

An employee in `engineering` will never see, retrieve, or ask questions about documents belonging to `hr` or any other department — enforced at the API layer, not the frontend.

---

## RAG Pipeline (Retrieval-Augmented Generation)

RAG is the technique of retrieving relevant document excerpts at query time and including them as context for the AI model, so answers are grounded in real data rather than model training.

### Indexing (on document upload)

```
File upload
    │
    ├─ Text extraction (by file type)
    │      PDF      → pdfplumber
    │      DOCX     → python-docx
    │      XLSX     → openpyxl
    │      PPTX     → python-pptx
    │      PNG/JPG  → pytesseract (OCR)
    │      CSV      → stdlib csv
    │
    ├─ Chunking
    │      500 words per chunk, 50-word overlap (sliding window)
    │
    ├─ Embedding
    │      Each chunk → Amazon Titan Embeddings V2 (1024-dim vector) via AWS Bedrock
    │
    └─ Upsert to Pinecone
           Vector ID: {file_id}_{chunk_index}
           Metadata:  { department, file_id, display_name, chunk_index, text }
```

### Querying (on AI Assistant message)

```
Employee question
    │
    ├─ Embed question → Titan Embeddings V2 (1024-dim vector)
    │
    ├─ Pinecone similarity search
    │      top_k = 10 chunks, filtered by department
    │
    ├─ Build prompt
    │      System role + instructions + document excerpts + question
    │
    ├─ Generate answer → Claude Haiku 4.5 via AWS Bedrock
    │
    └─ Return answer with source citations to frontend
```

On document deletion, all Pinecone vectors for that file are removed via a metadata filter (`file_id` + `department`). A `NotFoundError` (e.g. files uploaded before RAG was enabled) is caught and logged as a warning rather than failing the delete.

---

## Folder Structure

```
fyp/
├── backend/
│   ├── main.py               # FastAPI app, CORS, routers
│   ├── config.py             # Env var loader (python-dotenv locally, EB env properties in prod)
│   ├── auth.py               # Cognito JWT verifier (JWKS-based, no per-request AWS call)
│   ├── dependencies.py       # FastAPI deps: token → employee profile
│   ├── documents.py          # Document routes (upload, list, download, delete)
│   ├── folders.py            # Folder routes (create, list, rename, delete)
│   ├── chat.py               # POST /chat — RAG query endpoint
│   ├── rag.py                # Text extraction, chunking, Pinecone upsert/query/delete
│   ├── bedrock_client.py     # get_embedding() + generate_response() via Bedrock
│   ├── dynamodb_client.py    # DynamoDB operations (employees, folders, documents)
│   ├── s3_client.py          # S3 operations
│   ├── admin.py              # Admin routes (register, list, update dept, lock/unlock)
│   ├── onboarding.py         # First-login NRIC verification
│   ├── forgot_password.py    # Self-service password reset
│   ├── profile.py            # Employee profile endpoint
│   ├── requirements.txt      # Python dependencies
│   └── .ebextensions/        # Elastic Beanstalk config (HTTPS, packages)
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx                        # Root router (Login / Onboarding / Dashboard)
│   │   ├── auth/
│   │   │   ├── AuthContext.tsx            # Auth state (tokens + employee profile)
│   │   │   └── authClient.ts             # Cognito SDK wrappers (login, logout, session)
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx
│   │   │   ├── OnboardingPage.tsx
│   │   │   ├── Dashboard.tsx             # Post-login shell, view switcher
│   │   │   ├── DocumentsPage.tsx         # File/folder browser
│   │   │   ├── AIAssistantPage.tsx       # RAG chat UI
│   │   │   ├── AdminDashboard.tsx        # Admin-only panel
│   │   │   ├── ProfilePage.tsx
│   │   │   ├── ForgotPasswordPage.tsx
│   │   │   └── ResetPasswordPage.tsx
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── AppShell.tsx          # Main layout wrapper
│   │   │   │   └── Sidebar.tsx           # Collapsible sidebar + mobile drawer
│   │   │   ├── documents/               # FolderRow, FileRow, UploadZone, etc.
│   │   │   └── ui/                      # ContextMenu, ConfirmModal, DeptBadge, etc.
│   │   └── api/                         # Typed API call functions
│   └── package.json
│
└── .github/
    └── workflows/
        └── deploy-backend.yml            # CI/CD: push to main → deploy to Elastic Beanstalk
```

---

## Prerequisites

### Accounts & Services Required

- **AWS account** with the following set up in `ap-southeast-2` (or your chosen region):
  - Cognito User Pool + App Client
  - DynamoDB tables: `Employees`, `Folders`, `Documents`
  - S3 bucket
  - Bedrock model access enabled for:
    - `amazon.titan-embed-text-v2:0`
    - `anthropic.claude-haiku-4-5` (or your regional variant)
  - IAM user with programmatic access to Cognito, DynamoDB, S3, and Bedrock
- **Pinecone** account — create a serverless index with **1024 dimensions**, cosine metric
- **Resend** account — for transactional email (welcome + password reset)

### Local Tools Required

| Tool | Version |
|---|---|
| Python | 3.12+ |
| Node.js | 20+ |
| Tesseract OCR | Any recent version (for image/OCR support) |

**Tesseract installation:**
- Windows: download installer from [UB-Mannheim/tesseract](https://github.com/UB-Mannheim/tesseract/wiki), install to `C:\Program Files\Tesseract-OCR\`
- Linux/macOS: `sudo apt install tesseract-ocr` / `brew install tesseract`

---

## Local Setup

### 1. Clone the repository

```bash
git clone https://github.com/<your-username>/fyp.git
cd fyp
```

### 2. Backend

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate

# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
```

Create a `.env` file in `backend/`:

```env
AWS_REGION=ap-southeast-2

# Cognito
COGNITO_USER_POOL_ID=ap-southeast-2_XXXXXXXXX
COGNITO_APP_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxx

# DynamoDB table names
DYNAMODB_EMPLOYEES_TABLE=Employees
DYNAMODB_FOLDERS_TABLE=Folders
DYNAMODB_DOCUMENTS_TABLE=Documents

# S3
S3_BUCKET_NAME=your-s3-bucket-name

# Pinecone
PINECONE_API_KEY=your-pinecone-api-key
PINECONE_INDEX_NAME=fyp-index

# Resend (transactional email)
RESEND_API_KEY=re_xxxxxxxxxxxx
RESEND_FROM_EMAIL=noreply@yourdomain.com

# CORS — add your frontend origin
ALLOWED_ORIGINS=http://localhost:5173
```

AWS credentials are read from the standard AWS credential chain. The easiest way locally:

```bash
aws configure
# Enter your IAM access key, secret key, and region
```

Start the backend:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`. Interactive docs at `http://localhost:8000/docs`.

### 3. Frontend

```bash
cd frontend
npm install
```

Create a `.env` file in `frontend/`:

```env
VITE_API_BASE_URL=http://localhost:8000
VITE_COGNITO_REGION=ap-southeast-2
VITE_COGNITO_USER_POOL_ID=ap-southeast-2_XXXXXXXXX
VITE_COGNITO_APP_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Start the dev server:

```bash
npm run dev
```

The app will be available at `http://localhost:5173`.

---

## DynamoDB Table Schemas

### Employees
| Attribute | Type | Notes |
|---|---|---|
| `email` | String (PK) | Work email, also used as Cognito username |
| `name` | String | Display name |
| `department` | String | Lowercase, e.g. `engineering` |
| `role` | String | `employee` or `system_admin` |
| `personal_email` | String | Used for welcome/reset emails |
| `onboarding_complete` | Boolean | Set to true after first-login NRIC step |
| `nric_last4_hash` | String | bcrypt hash of NRIC last 4 characters |
| `status` | String | `active` or `locked` |

### Folders
| Attribute | Type | Notes |
|---|---|---|
| `folder_id` | String (PK) | UUID |
| `department` | String | Partition key for queries |
| `name` | String | Folder display name |
| `created_at` | String | ISO 8601 timestamp |

### Documents
| Attribute | Type | Notes |
|---|---|---|
| `file_id` | String (PK) | UUID |
| `department` | String | Partition key for queries |
| `folder_id` | String | Parent folder UUID |
| `display_name` | String | Original filename |
| `s3_key` | String | S3 object key |
| `uploaded_at` | String | ISO 8601 timestamp |

---

## CI/CD

Pushing to `main` with changes under `backend/` triggers the GitHub Actions workflow:

1. Captures the current live Elastic Beanstalk version label (for rollback)
2. Generates the HTTPS config from a template using secrets stored in GitHub
3. Zips the backend directory
4. Deploys to AWS Elastic Beanstalk (`ap-southeast-2`)
5. Automatically rolls back to the previous version if deployment fails

Required GitHub Actions secrets:

| Secret | Description |
|---|---|
| `AWS_ACCESS_KEY_ID` | IAM deploy user access key |
| `AWS_SECRET_KEY_ACCESS_KEY` | IAM deploy user secret key |
| `CF_ORIGIN_CERT` | Cloudflare origin certificate (PEM) |
| `CF_ORIGIN_KEY` | Cloudflare origin private key (PEM) |

---

## API Endpoints Summary

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | None | Liveness check |
| GET | `/me` | Employee | Current employee profile |
| POST | `/chat` | Employee | RAG question → AI answer |
| GET | `/documents` | Employee | List documents in department |
| POST | `/documents/upload` | Employee | Upload + index a document |
| DELETE | `/documents/{file_id}` | Employee | Delete document + vectors |
| GET | `/folders` | Employee | List folders in department |
| POST | `/folders` | Employee | Create folder |
| PATCH | `/folders/{folder_id}` | Employee | Rename folder |
| DELETE | `/folders/{folder_id}` | Employee | Delete folder |
| POST | `/onboarding/complete` | Employee | Submit NRIC on first login |
| POST | `/admin/register` | Admin | Register new employee |
| GET | `/admin/employees` | Admin | List all employees |
| PUT | `/admin/employees/{email}` | Admin | Update employee department |
| POST | `/admin/employees/{email}/lock` | Admin | Lock account |
| POST | `/admin/employees/{email}/unlock` | Admin | Unlock account |

---

## License

See [LICENSE](LICENSE).
