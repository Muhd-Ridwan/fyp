# DocuVault AI

A department-scoped cloud document management system built as a Final Year Project. Employees can upload, organise, search, and query documents within their own department. An AI assistant powered by a **Retrieval-Augmented Generation (RAG)** pipeline answers questions grounded strictly in that department's documents.

---

## Features

- **Department isolation** — employees can only see files belonging to their own department, enforced at the API layer
- **Folder & file management** — create folders, upload, rename, move (with cycle detection), download, and delete
- **Search** — search across documents and folders within your department
- **Overview dashboard** — department-level stats: document/folder counts, storage used, file-type breakdown, busiest folders, recently uploaded and largest files
- **AI Assistant** — ask natural-language questions grounded in your department's documents, with source citations; supports multi-turn conversation (follow-up questions are automatically rewritten into standalone queries) and per-document summarization
- **Chat export & clear** — export a conversation to PDF (rendered server-side) or clear the current chat
- **Admin panel** — system admins can register employees, reassign departments, and lock/unlock accounts
- **Audit log** — admins can view a filterable log of key actions (by department and action type)
- **First-login onboarding** — employees set their password and verify identity via NRIC on first login
- **Forgot password** — self-service password reset via Resend transactional email
- **Profile management** — employees can update their address and phone number
- **Supported file types** — PDF, DOCX, XLSX, PPTX, CSV, TXT, PNG, JPG/JPEG (images processed via OCR)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4 |
| Backend | FastAPI (Python 3.12), Uvicorn |
| Authentication | AWS Cognito (User Pool + App Client), custom JWT verification (JWKS-based) |
| Storage | AWS S3 |
| Database | AWS DynamoDB (Employees, Folders, Documents, AuditLog tables) |
| Vector Database | Pinecone Serverless (1024-dim index, top-k 10 chunks retrieved per query) |
| Embeddings | AWS Bedrock — Amazon Titan Embeddings V2 |
| AI Generation | AWS Bedrock — Claude Haiku 4.5 |
| OCR (image text extraction) | AWS Textract |
| Charts | Recharts |
| Markdown rendering | react-markdown + remark-gfm |
| Email | Resend |
| Deployment | AWS Elastic Beanstalk (backend) + Cloudflare (frontend + TLS proxy), via GitHub Actions CI/CD |

---
<p>Login Page</p>
<img width="543" height="632" alt="image" src="https://github.com/user-attachments/assets/51da138a-ef36-4724-a697-29b32629d822" />
<p>Dashboard</p>
<img width="2559" height="595" alt="Dashboard FYP SS" src="https://github.com/user-attachments/assets/f678d216-ae0b-4f6b-b2aa-6d891c235b95" />
<p>AI Assisstant</p>
<img width="2559" height="838" alt="AI Assistant FYP SS" src="https://github.com/user-attachments/assets/b9f434d3-2909-4b11-8d99-4c0dbb42e48e" />

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
    ├── documents.py     — S3 upload/download/rename/move/delete + RAG indexing + summarize
    ├── folders.py       — folder CRUD in DynamoDB
    ├── chat.py          — RAG query endpoint + chat PDF export
    ├── overview.py       — department dashboard stats
    ├── admin.py          — employee management (Cognito + DynamoDB + Resend) + audit log
    ├── onboarding.py    — first-login NRIC verification
    ├── forgot_password.py — self-service reset flow
    ├── profile.py       — employee profile read/update
    └── auth_routes.py   — login event logging
         │
         ├── AWS S3          (file storage)
         ├── AWS DynamoDB    (metadata: employees, folders, documents, audit log)
         ├── AWS Cognito     (identity)
         ├── AWS Textract    (OCR for image uploads)
         ├── Pinecone        (vector search)
         └── AWS Bedrock     (embeddings + generation)
```

---

## Authentication & Sign-in Flow

1. **Admin registers an employee** via the Admin Panel — this creates a Cognito account with a temporary password and sends the credentials to the employee's personal email (via Resend). The "work email" is admin-declared and used as the Cognito username; it is not verified as a real, deliverable address (Cognito's verification email is explicitly suppressed on creation).
2. **Employee logs in** with their work email and the temporary password.
3. **First-login onboarding** — Cognito returns `NEW_PASSWORD_REQUIRED`. The employee is redirected to the Onboarding page where they set a new permanent password and verify their identity using the last 4 characters of their NRIC (stored as a bcrypt hash in DynamoDB).
4. **Subsequent logins** — The frontend calls Cognito via `amazon-cognito-identity-js`, receives an ID token, and stores it in the session.
5. **Every API request** sends `Authorization: Bearer <id_token>`. The backend:
   - Fetches and caches the Cognito User Pool's public JWKS keys (refreshed every hour, no per-request AWS call)
   - Verifies the token signature, expiry, issuer, and audience locally
   - Extracts the `email` claim and looks up the employee record in DynamoDB
   - Returns `{ email, name, department, role }` — used for all downstream department scoping

Because the "email" claim is not independently verified as a real address by Cognito, the system's trust boundary rests entirely on the cryptographic token verification above — not on the identifier itself being genuine.

---

## Department Scoping

Every authenticated request resolves to a `department` from DynamoDB. This value is used as a partition boundary across all data layers:

- **DynamoDB** — folders, documents, and audit log entries are stored with `department` as the partition key
- **S3** — object keys include the department prefix
- **Pinecone** — all vectors are upserted with `department` in metadata; queries always filter `{ "department": { "$eq": department } }`

An employee in `hr` will never see, retrieve, or ask questions about documents belonging to `finance` or any other department — enforced at the API layer, not the frontend.

---

## RAG Pipeline (Retrieval-Augmented Generation)

RAG is the technique of retrieving relevant document excerpts at query time and including them as context for the AI model, so answers are grounded in real data rather than model training.

### Indexing (on document upload)

```
File upload
    │
    ├─ Text extraction (by file type)
    │      PDF        → pdfplumber
    │      DOCX       → python-docx
    │      XLSX       → openpyxl
    │      PPTX       → python-pptx
    │      CSV        → stdlib csv
    │      PNG/JPG    → AWS Textract (OCR — no local OCR binary required)
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
    ├─ (If a conversation is already in progress) rewrite the question into a
    │      standalone form using recent history, via Claude Haiku 4.5
    │
    ├─ Embed the (possibly rewritten) question → Titan Embeddings V2
    │
    ├─ Pinecone similarity search
    │      top_k = 10 chunks, filtered by department
    │
    ├─ Build grounding prompt
    │      Instructions + retrieved document excerpts + question + conversation history
    │
    ├─ Generate answer → Claude Haiku 4.5 via AWS Bedrock
    │
    └─ Return answer with source citations to frontend
```

A separate "Summarize" flow, triggered from a specific document, skips vector search entirely and uses that one file's full extracted text as context instead.

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
│   ├── documents.py          # Document routes (upload, list, download, rename, move, summarize, delete)
│   ├── folders.py            # Folder routes (create, list, rename, delete)
│   ├── chat.py                # POST /chat — RAG query endpoint + chat PDF export
│   ├── overview.py            # GET /overview — department dashboard stats
│   ├── rag.py                 # Text extraction, chunking, Pinecone upsert/query/delete
│   ├── bedrock_client.py      # get_embedding() + generate_response() via Bedrock
│   ├── dynamodb_client.py     # DynamoDB operations (employees, folders, documents, audit log)
│   ├── s3_client.py           # S3 operations
│   ├── admin.py                # Admin routes (register, list, update dept, lock/unlock, audit log)
│   ├── onboarding.py          # First-login NRIC verification
│   ├── forgot_password.py     # Self-service password reset
│   ├── profile.py             # Employee profile read/update
│   ├── auth_routes.py         # Login event logging
│   ├── requirements.txt       # Python dependencies
│   └── .ebextensions/         # Elastic Beanstalk config (HTTPS, packages)
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx                        # Root router (Login / Onboarding / Dashboard)
│   │   ├── auth/
│   │   │   ├── AuthContext.tsx            # Auth state (tokens + employee profile)
│   │   │   ├── authClient.ts              # Cognito SDK wrappers (login, logout, session)
│   │   │   └── cognitoConfig.ts           # Reads VITE_ Cognito env vars
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx
│   │   │   ├── OnboardingPage.tsx
│   │   │   ├── Dashboard.tsx              # Post-login shell, view switcher
│   │   │   ├── OverviewPage.tsx           # Department stats dashboard
│   │   │   ├── DocumentsPage.tsx          # File/folder browser
│   │   │   ├── AIAssistantPage.tsx        # RAG chat UI
│   │   │   ├── AdminDashboard.tsx         # Admin-only panel (employees + audit log)
│   │   │   ├── ProfilePage.tsx
│   │   │   ├── ForgotPasswordPage.tsx
│   │   │   └── ResetPasswordPage.tsx
│   │   ├── components/
│   │   │   ├── layout/                   # AppShell, Sidebar
│   │   │   ├── documents/                # FolderRow, FileRow, UploadZone, MoveModal, etc.
│   │   │   ├── overview/                 # FileTypeChart (Recharts donut) and related widgets
│   │   │   ├── admin/                    # Employee table, audit log view
│   │   │   └── ui/                       # ContextMenu, ConfirmModal, DeptBadge, etc.
│   │   └── api/                          # Typed API call functions (documentsApi, chatApi, adminApi, overviewApi, foldersApi, profileApi)
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
  - Cognito User Pool + App Client (SPA-type, no client secret)
  - DynamoDB tables: `Employees`, `Folders`, `Documents`, `AuditLog`
  - S3 bucket
  - Bedrock model access enabled for:
    - `amazon.titan-embed-text-v2:0`
    - Claude Haiku 4.5 (the exact model/inference-profile ID is hardcoded in `backend/config.py` — currently `au.anthropic.claude-haiku-4-5-20251001-v1:0`; update this in code if your account uses a different regional inference profile)
  - IAM user with programmatic access to Cognito, DynamoDB, S3, Bedrock (`InvokeModel`), and **Textract** (`DetectDocumentText`) — required for OCR on image uploads
- **Pinecone** account — create a serverless index with **1024 dimensions**, cosine metric
- **Resend** account — for transactional email (welcome + password reset)

### Local Tools Required

| Tool | Version |
|---|---|
| Python | 3.12+ |
| Node.js | 20+ |

No local OCR installation is needed — image text extraction is handled by the AWS Textract API, not a local binary.

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
DYNAMODB_AUDIT_LOG_TABLE=AuditLog

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

All six of `COGNITO_USER_POOL_ID`, `COGNITO_APP_CLIENT_ID`, `S3_BUCKET_NAME`, `PINECONE_API_KEY`, `RESEND_API_KEY`, and `RESEND_FROM_EMAIL` are required — the app will refuse to start (`RuntimeError`) if any of these are missing.

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
VITE_COGNITO_USER_POOL_ID=ap-southeast-2_XXXXXXXXX
VITE_COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Start the dev server:

```bash
npm run dev
```

The app will be available at `http://localhost:5173`.

### 4. Create your first admin account

Registration happens only through the Admin Panel, and the Admin Panel itself requires an existing admin account — so the very first employee must be created directly, either via the AWS Cognito console (create a user manually, then add a matching row in the `Employees` DynamoDB table with `role` set to `system_admin`) or via the AWS CLI (`aws cognito-idp admin-create-user`).

---

## DynamoDB Table Schemas

### Employees
| Attribute | Type | Notes |
|---|---|---|
| `email` | String (PK) | Work email — really just an admin-declared identifier, also used as Cognito username |
| `name` | String | Display name |
| `department` | String | Lowercase, e.g. `hr`, `finance` |
| `role` | String | `employee` or `system_admin` |
| `personal_email` | String | Used for welcome/reset emails |
| `onboarding_complete` | Boolean | Set to true after first-login NRIC step |
| `nric_last4_hash` | String | bcrypt hash of NRIC last 4 characters |
| `status` | String | `active` or `locked` |

### Folders
| Attribute | Type | Notes |
|---|---|---|
| `department` | String (PK) | Partition key — enforces department scoping |
| `folder_id` | String (SK) | UUID |
| `name` | String | Folder display name |
| `parent_folder_id` | String | Parent folder UUID, absent for root-level folders |
| `created_by` / `created_at` | String | Audit fields |

### Documents
| Attribute | Type | Notes |
|---|---|---|
| `department` | String (PK) | Partition key — enforces department scoping |
| `file_id` | String (SK) | UUID |
| `folder_id` | String | Parent folder UUID, absent for root-level files |
| `display_name` | String | Original filename |
| `s3_key` | String | S3 object key (UUID-based, stable) |
| `file_size` / `content_type` | — | File metadata |
| `uploaded_by` / `uploaded_at` | String | Audit fields |

### AuditLog
| Attribute | Type | Notes |
|---|---|---|
| `department` | String (PK) | Partition key |
| `log_id` | String (SK) | `{ISO timestamp}#{uuid}` — sortable and unique |
| `action` | String | e.g. `document_deleted`, `employee_registered` |
| `actor_email` | String | Who performed the action |
| `target_type` / `target_id` / `target_name` | String | What was acted on |

---

## CI/CD

Pushing to `main` with changes under `backend/` triggers the GitHub Actions workflow:

1. Captures the current live Elastic Beanstalk version label (for rollback)
2. Generates the HTTPS config from a template using secrets stored in GitHub
3. Zips the backend directory
4. Deploys to AWS Elastic Beanstalk (`ap-southeast-2`) via the `beanstalk-deploy` action
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
| POST | `/onboarding/complete` | Employee | Submit new password + NRIC on first login |
| GET | `/profile` | Employee | Get own profile |
| PATCH | `/profile` | Employee | Update own address/phone |
| POST | `/auth/forgot-password/verify-email` | None | Step 1 of password reset |
| POST | `/auth/forgot-password/send-reset` | None | Step 2 — verifies NRIC + personal email, sends reset link |
| POST | `/auth/reset-password` | None | Complete password reset |
| POST | `/auth/log-login` | Employee | Record a login event |
| POST | `/chat` | Employee | RAG question (or file-grounded summarize) → AI answer |
| POST | `/chat/export` | Employee | Export current conversation as a PDF |
| GET | `/overview` | Employee | Department dashboard stats |
| GET | `/documents/list` | Employee | List documents in department |
| POST | `/documents/upload` | Employee | Upload + index a document |
| GET | `/documents/download/{file_id}` | Employee | Get a short-lived download URL |
| POST | `/documents/{file_id}/summarize` | Employee | Summarize a specific document |
| PATCH | `/documents/{file_id}/rename` | Employee | Rename a document |
| POST | `/documents/move` | Employee | Move a batch of files/folders to a new destination |
| DELETE | `/documents/{file_id}` | Employee | Delete document + its vectors |
| GET | `/folders` | Employee | List folders in department |
| POST | `/folders` | Employee | Create folder |
| PATCH | `/folders/{folder_id}/rename` | Employee | Rename folder |
| DELETE | `/folders/{folder_id}` | Employee | Delete folder (cascades to nested folders/files) |
| POST | `/admin/register` | Admin | Register new employee |
| GET | `/admin/employees` | Admin | List all employees |
| PUT | `/admin/employees/{email}` | Admin | Update employee department |
| POST | `/admin/employees/{email}/lock` | Admin | Lock account |
| POST | `/admin/employees/{email}/unlock` | Admin | Unlock account |
| GET | `/admin/audit-log` | Admin | Filterable audit log (by department, action type) |

---

## License

See [LICENSE](LICENSE).
