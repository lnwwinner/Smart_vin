# Smart Village Fund Platform: Enterprise Architecture Review & Design System
**Document ID:** SVF-ARCH-2026-V2.0  
**Authors:** Lead Enterprise Software Architect, Database Specialist, and Systems Analyst  
**Security Classification:** Restricted - Internal Core Engineering  

---

## 1. Executive Summary
This document serves as the master blueprints and architectural specifications for transitioning the **Smart Village Fund Platform** (ระบบบริหารกองทุนสัจจะและสวัสดิการชุมชนอัจฉริยะ) from its current monolithic, rich-prototype state into an **Enterprise-Grade, Multi-Tenant Clean Architecture**.

This platform is engineered to support thousands of community organizations (villages/tambons) on a unified, high-security, low-latency infrastructure, while maintaining an interface optimized for simple village committees and elderly users.

---

## 2. Phase 1: Comprehensive Architecture Review

### 2.1 Current Architecture Analysis
The current application employs a **Full-Stack Angular (Zoneless SSR) and Node.js (Express)** architecture. 
* **Frontend:** Built with Angular 21, utilizing signals for state management, Reactive Forms for inputs, and Tailwind CSS v4 for accessible, high-contrast, responsive layouts.
* **Backend:** Express acts as a middleware router and API server, proxying requests to a file-based storage manager (`db-store.ts`) that replicates structural databases using JSON.
* **AI Engine:** Integrated directly within the Express server using the `@google/genai` SDK, querying Gemini Flash to draft certificates, analyze finances, and answer board inquiries.

### 2.2 Architectural Strengths
1. **Modern Frontend Foundation:** Angular 21 with Zoneless change detection provides highly efficient, predictable rendering, which is essential for low-powered mobile devices in rural areas.
2. **Unified State Representation:** The use of Angular signals allows instant, reactive visual feedback across components without the overhead of heavy global state managers.
3. **High Accessibility:** Built-in options such as large font sizes, voice output guides, and high-contrast color styling cater perfectly to village elders and local committees.
4. **Rich Seed Data & Isolation:** Multi-tenant support is fundamentally modeled from the beginning, allowing clean switching between various village funds.

### 2.3 Structural Weaknesses & Technical Debt
1. **Tight Coupling of Concerns:** The backend API server (`server.ts`) directly orchestrates Express routes, handles file database I/O, runs business validation, and manages Gemini API interactions in single files.
2. **Synchronous File I/O Simulation:** The `db-store.ts` file reads and writes the entire `database.json` on every state change, creating high write amplification and race conditions under concurrent workloads.
3. **Implicit Business Logic:** Rules regarding interest rates, maximum loan limits, loan guarantees, and welfare payouts are scattered across UI calculations, API routes, and static configuration profiles.
4. **Lack of DB Schema Controls:** Relational constraints (e.g., preventing a member with outstanding overdue loans from receiving new credit or deleting a member who serves as a guarantor) are not enforced at the database or middleware level.
5. **Missing Audit State Trailing:** Audit logs exist, but they only record flat text messages. They do not capture state mutations (before/after snapshots), IP addresses, browser agents, or digital signatures.

### 2.4 Scalability & Security Risks
1. **Horizontal Scaling Bottleneck:** Since state is stored in a single local JSON file (`database.json`), running multiple instances of the server on Cloud Run or Kubernetes will result in immediate state divergence and data loss.
2. **Insecure Data Exposure:** All records for all tenants are loaded through single-tenant endpoints without robust tenant-isolation query boundaries (e.g., Row Level Security).
3. **Unprotected API Endpoints:** No rate limiting, JWT authentication token validations, or CORS domain restriction maps are configured, leaving member PIIs open to simple automated enumeration.
4. **No Database Transaction Controls:** Transactions and loan installments involve multi-table mutations (updating member balance, writing transaction ledger, creating installment lines). Without SQL-level transaction boundaries, system failures mid-execution cause database inconsistency.

---

## 3. Phase 2: Enterprise Clean Architecture Mapping

To resolve these liabilities, we transition the codebase to a strict **Clean Architecture (Domain-Driven Design)** model. The software is organized into concentric layers where dependencies only point inward:

```
┌───────────────────────────────────────────────────────────┐
│                     PRESENTATION LAYER                    │
│      (Angular Components / Express API Controllers)       │
└─────────────────────────────┬─────────────────────────────┘
                              │
┌─────────────────────────────▼─────────────────────────────┐
│                      APPLICATION LAYER                    │
│            (Use Cases / Event Handlers / DTOs)            │
└─────────────────────────────┬─────────────────────────────┘
                              │
┌─────────────────────────────▼─────────────────────────────┐
│                        DOMAIN LAYER                       │
│    (Aggregate Roots / Entities / Value Objects / Rules)   │
└─────────────────────────────▲─────────────────────────────┘
                              │
┌─────────────────────────────┴─────────────────────────────┐
│                    INFRASTRUCTURE LAYER                   │
│   (PostgreSQL Drizzle ORM / Gemini Client / File Store)   │
└───────────────────────────────────────────────────────────┘
```

### 3.1 Layer Organization & Mappings

```
src/
├── core/                         # Shared utilities and runtime settings
│   ├── errors/                   # Enterprise error definitions
│   └── security/                 # Encryption and token helpers
│
├── domain/                       # Core Business logic (Zero dependencies)
│   ├── entities/                 # Member, Loan, Savings, Transaction, Welfare
│   ├── rules/                    # Rule Engine definitions and interfaces
│   └── value-objects/            # Audit fields, money values, address structures
│
├── application/                  # Business Use Cases and Workflows
│   ├── use-cases/                # ProcessLoanPayment, ApproveWelfare, JoinMember
│   ├── dtos/                     # Data Transfer Objects for validation
│   └── services/                 # Workflow coordinators and interfaces
│
├── infrastructure/               # External adapters and persistence
│   ├── persistence/              # PostgreSQL/Firestore implementations
│   ├── ai/                       # Gemini SDK wrapper service
│   └── documents/                # PDF Generation & HTML templating engine
│
└── presentation/                 # User interfaces and entry points
    ├── api/                      # Express route handlers and middleware
    └── client/                   # Angular application modules and states
```

---

## 4. Phase 3: Data Structure Normalization (Database Version 2)

To ensure full historical compliance, every business entity within the database must inherit from a common **Enterprise Meta-Structure**. This guarantees auditability, optimistic locking, and absolute data safety via soft deletion.

### 4.1 Enterprise Base Entity Specifications (TypeScript)
```typescript
export interface IAuditableEntity {
  id: string;                 // Global unique identifier (UUIDv4)
  tenantId: string;           // Multi-tenant identifier
  createdAt: string;          // ISO 8601 creation timestamp
  updatedAt: string;          // ISO 8601 modification timestamp
  createdBy: string;          // User ID of creator
  updatedBy: string;          // User ID of updater
  status: string;             // System state indicator (e.g., 'active', 'archived')
  version: number;            // Optimistic locking control for concurrent edits
  isDeleted: boolean;         // Soft-delete flag (records are never purged)
  deletedAt?: string;         // ISO 8601 deletion timestamp
  deletedBy?: string;         // User ID who performed soft-delete
}
```

---

## 5. Phase 4: Database Version 2 Schema (PostgreSQL DDL)

Below is the production-ready PostgreSQL relational schema mapped using Drizzle ORM standards. It includes strict constraint validations, foreign keys, and audit controls.

```sql
-- Create Enum Types
CREATE TYPE user_status AS ENUM ('active', 'inactive', 'suspended');
CREATE TYPE tx_type AS ENUM ('deposit', 'withdrawal', 'share_buy', 'share_sell', 'loan_disbursement', 'loan_payment', 'welfare_payout');
CREATE TYPE loan_status AS ENUM ('pending', 'active', 'paid', 'overdue', 'written_off');
CREATE TYPE welfare_type AS ENUM ('medical', 'elderly', 'funeral', 'education');
CREATE TYPE welfare_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE doc_type AS ENUM ('in', 'out', 'cert');
CREATE TYPE approval_status AS ENUM ('pending', 'approved', 'rejected', 'returned');

-- 1. Tenants Table (Multi-Tenant Hub)
CREATE TABLE tenants (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    village VARCHAR(255) NOT NULL,
    subdistrict VARCHAR(255) NOT NULL,
    district VARCHAR(255) NOT NULL,
    province VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    version INTEGER DEFAULT 1 NOT NULL,
    is_deleted BOOLEAN DEFAULT FALSE NOT NULL
);

-- 2. Members Table
CREATE TABLE members (
    id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    member_code VARCHAR(50) NOT NULL,
    title VARCHAR(20) NOT NULL,
    name VARCHAR(255) NOT NULL,
    id_card VARCHAR(13) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    birthdate DATE NOT NULL,
    address TEXT NOT NULL,
    join_date DATE NOT NULL,
    status user_status DEFAULT 'active' NOT NULL,
    deposit_balance DECIMAL(15, 2) DEFAULT 0.00 NOT NULL,
    share_count INTEGER DEFAULT 0 NOT NULL,
    loan_count INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by VARCHAR(50) NOT NULL,
    updated_by VARCHAR(50) NOT NULL,
    version INTEGER DEFAULT 1 NOT NULL,
    is_deleted BOOLEAN DEFAULT FALSE NOT NULL,
    CONSTRAINT uq_tenant_member_code UNIQUE(tenant_id, member_code)
);

-- 3. Transactions Table (Savings/Shares/Payouts Ledger)
CREATE TABLE transactions (
    id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    member_id VARCHAR(50) NOT NULL REFERENCES members(id),
    type tx_type NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    date TIMESTAMP WITH TIME ZONE NOT NULL,
    receipt_no VARCHAR(100) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by VARCHAR(50) NOT NULL,
    version INTEGER DEFAULT 1 NOT NULL,
    is_deleted BOOLEAN DEFAULT FALSE NOT NULL,
    CONSTRAINT uq_receipt UNIQUE(tenant_id, receipt_no)
);

-- 4. Loans Table
CREATE TABLE loans (
    id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    member_id VARCHAR(50) NOT NULL REFERENCES members(id),
    principal DECIMAL(15, 2) NOT NULL,
    interest_rate DECIMAL(5, 2) NOT NULL,
    duration_months INTEGER NOT NULL,
    start_date DATE NOT NULL,
    status loan_status DEFAULT 'pending' NOT NULL,
    monthly_payment DECIMAL(15, 2) NOT NULL,
    remaining_balance DECIMAL(15, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by VARCHAR(50) NOT NULL,
    updated_by VARCHAR(50) NOT NULL,
    version INTEGER DEFAULT 1 NOT NULL,
    is_deleted BOOLEAN DEFAULT FALSE NOT NULL
);

-- 5. Loan Guarantors Table (Many-to-Many Relationship)
CREATE TABLE loan_guarantors (
    loan_id VARCHAR(50) NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
    guarantor_id VARCHAR(50) NOT NULL REFERENCES members(id),
    PRIMARY KEY (loan_id, guarantor_id)
);

-- 6. Installments Table (Repayments Log)
CREATE TABLE installments (
    id VARCHAR(50) PRIMARY KEY,
    loan_id VARCHAR(50) NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
    tenant_id VARCHAR(50) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    member_id VARCHAR(50) NOT NULL REFERENCES members(id),
    amount_paid DECIMAL(15, 2) NOT NULL,
    principal_paid DECIMAL(15, 2) NOT NULL,
    interest_paid DECIMAL(15, 2) NOT NULL,
    date TIMESTAMP WITH TIME ZONE NOT NULL,
    receipt_no VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by VARCHAR(50) NOT NULL,
    version INTEGER DEFAULT 1 NOT NULL,
    is_deleted BOOLEAN DEFAULT FALSE NOT NULL
);

-- 7. Welfare Payouts Table
CREATE TABLE welfares (
    id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    member_id VARCHAR(50) NOT NULL REFERENCES members(id),
    type welfare_type NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    request_date DATE NOT NULL,
    approve_date DATE,
    status welfare_status DEFAULT 'pending' NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by VARCHAR(50) NOT NULL,
    updated_by VARCHAR(50) NOT NULL,
    version INTEGER DEFAULT 1 NOT NULL,
    is_deleted BOOLEAN DEFAULT FALSE NOT NULL
);

-- 8. Fund Settings Table (The Rule Engine Store)
CREATE TABLE fund_settings (
    tenant_id VARCHAR(50) PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
    share_price DECIMAL(10, 2) DEFAULT 100.00 NOT NULL,
    interest_rate_deposit DECIMAL(5, 2) DEFAULT 1.50 NOT NULL,
    interest_rate_loan DECIMAL(5, 2) DEFAULT 6.00 NOT NULL,
    max_loan_amount DECIMAL(15, 2) DEFAULT 100000.00 NOT NULL,
    min_guarantors INTEGER DEFAULT 1 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_by VARCHAR(50) NOT NULL
);

-- 9. Welfare Rules Configuration Table
CREATE TABLE welfare_rules (
    id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    type welfare_type NOT NULL,
    name VARCHAR(255) NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    conditions TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 10. Audit Logs Table (Immutable History)
CREATE TABLE audit_logs (
    id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    username VARCHAR(100) NOT NULL,
    action VARCHAR(100) NOT NULL,
    details TEXT NOT NULL,
    state_before JSONB,
    state_after JSONB,
    ip_address VARCHAR(50),
    device_info VARCHAR(255),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
```

### 4.2 Entity Relationship Map (ERD Description)
* **Tenants (1) ─── (N) Members:** Every member is strictly bound to exactly one tenant (village organization) to secure multi-tenant boundaries.
* **Members (1) ─── (N) Transactions:** Holds historical balances. A ledger entry lists deposit, withdrawal, or share changes.
* **Members (1) ─── (N) Loans:** An active member can execute multiple historic loans, but is restricted by the rule engine on outstanding active accounts.
* **Loans (1) ─── (N) Guarantors (M-to-M via Members):** A loan is backed by 1 or more members as guarantors. A cyclic validation routine prevents member $A$ from guaranteeing member $B$ if $B$ already guarantees $A$ with active balance.
* **Loans (1) ─── (N) Installments:** Details real payments split mathematically between principal and interest.
* **Tenants (1) ─── (1) Fund Settings:** Configures village-level rule engine thresholds.

---

## 6. Phase 5 & 6: Rule Engine & Workflow Engine Specifications

To prevent any hardcoded logic from blocking specific village regulations, the platform implements a **Dynamic JSON Schema Rule Engine** alongside a **State Machine Workflow Engine**.

### 6.1 Rule Engine Schema (Welfare Validation Example)
The welfare engine parses rule definitions stored in `welfare_rules`. When a member requests a payment, the application evaluates the parameters:

```json
{
  "ruleId": "wf_rule_elderly_t1",
  "name": "เบี้ยสวัสดิการผู้สูงอายุ",
  "conditions": {
    "and": [
      { "field": "member.status", "operator": "equals", "value": "active" },
      { "field": "member.age", "operator": "greater_than_or_equal", "value": 60 },
      { "field": "member.monthsOfMembership", "operator": "greater_than_or_equal", "value": 6 }
    ]
  },
  "outcome": {
    "allowPayout": true,
    "fixedAmount": 2000.00
  }
}
```

### 6.2 Approval Workflow Engine State Machine
For substantial payouts or credit disbursements, a sequential authorization flow is required:

```
                  ┌───────────────┐
                  │    DRAFT      │
                  └───────┬───────┘
                          │ (Submit)
                          ▼
                  ┌───────────────┐
                  │   PENDING     │
                  └───────┬───────┘
                          │ (Verify - Board member)
                          ▼
                  ┌───────────────┐
                  │  RECOMMENDED  │
                  └───────┬───────┘
                          │ (Approve - President)
                          ▼
                  ┌───────────────┐
                  │   APPROVED    │
                  └───────────────┘
```

#### Workflow Log Table Schema
To tracking execution status dynamically:
```sql
CREATE TABLE approval_workflows (
    id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL REFERENCES tenants(id),
    entity_type VARCHAR(50) NOT NULL, -- 'LOAN', 'WELFARE'
    entity_id VARCHAR(50) NOT NULL,
    current_step VARCHAR(50) NOT NULL, -- 'PENDING', 'VERIFIED', 'APPROVED'
    assigned_role VARCHAR(50) NOT NULL, -- 'HE_RAN_YIK', 'PRATHAN'
    status approval_status DEFAULT 'pending' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE approval_history (
    id VARCHAR(50) PRIMARY KEY,
    workflow_id VARCHAR(50) REFERENCES approval_workflows(id),
    actor_id VARCHAR(50) NOT NULL,
    actor_name VARCHAR(255) NOT NULL,
    action VARCHAR(50) NOT NULL, -- 'APPROVE', 'REJECT', 'RETURN'
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
```

---

## 7. Phase 7 & 8: RBAC & Deep Audit Trace Systems

### 7.1 Role-Based Access Control (RBAC) Matrix

| Feature Module | Admin (ผู้ดูแลระบบ) | President (ประธาน) | Treasurer (เหรัญญิก) | Member (สมาชิกทั่วไป) | Auditor (ผู้ตรวจสอบ) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **System Configuration** | Read/Write | Read | Read | No Access | Read |
| **Membership Save/Delete**| Read/Write | Read/Write | Read/Write | No Access | Read |
| **Deposit/Withdraw I/O** | Read/Write | Read | Read/Write | No Access | Read |
| **Loan Disbursement** | Read/Write | Read/Write | Read | No Access | Read |
| **Welfare Payout Approve**| Read/Write | Read/Write | Read | No Access | Read |
| **Audit Logs View** | Read/Write | Read | Read | No Access | Read/Write |

### 7.2 Audit Trace Pattern (Before/After Serialization)
To guarantee ledger integrity, no balance mutation can happen without state hashing. The audit engine logs deep snapshots:

```typescript
export interface IAuditStateTrace {
  eventId: string;
  timestamp: string;
  operatorUserId: string;
  operatorRole: string;
  actionType: 'UPDATE_LOAN' | 'WITHDRAWAL' | 'APPROVE_WELFARE';
  stateBefore: Record<string, any>;
  stateAfter: Record<string, any>;
  delta: {
    changedFields: string[];
    valuesChanged: Record<string, { from: any; to: any }>;
  };
  security: {
    ipAddress: string;
    userAgent: string;
    integrityHash: string; // HMAC computed with shared server secret to prevent manual DB tampering
  };
}
```

---

## 8. Phase 9 & 10: Document Engine & AI Service Layers

### 8.1 Document Engine Model
Certs, receipts, and meeting minutes are dynamically composed on the backend using standard HTML templates with variable bindings, compiling directly to pristine PDF documents:

```typescript
export interface IDocumentTemplate {
  templateId: string;
  type: 'RECEIPT' | 'CERTIFICATE' | 'MINUTES';
  rawHtml: string; // Contains binding expressions like: {{ member.title }}{{ member.name }}
  version: string;
  isActive: boolean;
}
```

### 8.2 AI Service Layer (Decoupled @google/genai)
AI assistance is managed independently from core business rules. Business models are passed to the AI Layer *only* after authorization checks, maintaining an airtight partition between generation code and critical transaction processors:

```typescript
// /src/server/infrastructure/ai/ai-service.ts
import { GoogleGenAI } from '@google/genai';

export class AIService {
  private client: GoogleGenAI | null = null;

  constructor(apiKey?: string) {
    if (apiKey) {
      this.client = new GoogleGenAI({ apiKey });
    }
  }

  public async summarizeMeeting(minutesText: string): Promise<string> {
    if (!this.client) return this.generateSimulatedSummary(minutesText);
    
    const prompt = `สรุปมติที่ประชุมกองทุนสัจจะต่อไปนี้อย่างเป็นทางการและกระชับ:\n${minutesText}`;
    const response = await this.client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt
    });
    return response.text || '';
  }

  public async analyzeFinancialTrend(ledgerSummary: any): Promise<string> {
    if (!this.client) return this.generateSimulatedAnalysis(ledgerSummary);
    
    const prompt = `วิเคราะห์ทิศทางและเสถียรภาพทางการเงินของกองทุนจากข้อมูลสรุปนี้:\n${JSON.stringify(ledgerSummary)}`;
    const response = await this.client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt
    });
    return response.text || '';
  }

  private generateSimulatedSummary(text: string): string {
    return `[ระบบจำลอง] สรุปการประชุมอย่างย่อ: สมาชิกเห็นพ้องให้ดำเนินกิจกรรมตามรายงานอย่างโปร่งใส`;
  }

  private generateSimulatedAnalysis(data: any): string {
    return `[ระบบจำลอง] การวิเคราะห์งบการเงิน: กองทุนมีสภาพคล่องอยู่ในเกณฑ์ปกติ มีสัดส่วนเงินฝากสัจจะสมดุลกับปริมาณเงินกู้`;
  }
}
```

---

## 9. Comprehensive Execution & Transition Plan

### 9.1 Phase-by-Phase Roadmap

```
Week 1: Folder Restructuring (Transition to core, domain, application, infra, presentation directories)
  │── Setup namespace packages & paths mapping in tsconfig
  └── Establish complete Domain Models & Base Entities
  
Week 2: PostgreSQL Schema Setup & Migration Layer
  │── Apply PostgreSQL DDL with Drizzle ORM
  └── Build multi-tenant Row Level Security (RLS) policies

Week 3: Core Engines Deployment
  │── Implement Rule Engine and Dynamic State Machines
  └── Migrate Audit Log System to track state delta changes

Week 4: Business Workflows Integration & AI Activation
  │── Refactor Express route controller handlers
  └── Connect AIService to active routes
```

### 9.2 Coding Standards (TypeScript & Angular)
1. **Immutable State:** Do not modify signal states directly in child templates. Use dedicated component actions triggering backend API services.
2. **Explicit Typings:** Never use `any` in production domain entities. Define precise interfaces and type definitions.
3. **Defense-in-Depth Validation:** Validate all incoming requests on both the client (for UX feedback) and server (for transactional safety) using structured schemas.
4. **Zoneless Signal Patterns:** Always use `computed` signals for derived layout states to maintain rendering efficiency.

---
*Authorized by the Lead Enterprise Architecture Board for immediate deployment preparation.*
