/**
 * Smart Village Fund Platform - Domain Layer Entities
 * Defined following Clean Architecture & Domain-Driven Design (DDD) principles.
 */

export interface IAuditable {
  id: string;
  tenantId: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
  status?: string;
  version?: number;
  isDeleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
}

export interface Tenant {
  id: string;
  name: string;
  code: string;
  village: string;
  subdistrict: string;
  district: string;
  province: string;
  createdAt?: string;
  updatedAt?: string;
  version?: number;
  isDeleted?: boolean;
}

export interface Member extends IAuditable {
  memberCode: string;
  title: string;
  name: string;
  idCard: string;
  phone: string;
  birthdate: string;
  address: string;
  joinDate: string;
  status: 'active' | 'inactive';
  depositBalance: number;
  shareCount: number;
  loanCount: number;
  isSpecial?: boolean;
  specialRole?: 'president' | 'treasurer' | 'secretary' | 'auditor' | 'committee' | 'none';
  authorityNotes?: string;
  authorizedActions?: string[];
}

export interface Transaction {
  id: string;
  tenantId: string;
  memberId: string;
  memberName: string;
  memberCode: string;
  type: 'deposit' | 'withdrawal' | 'share_buy' | 'share_sell' | 'loan_disbursement' | 'loan_payment' | 'welfare_payout';
  amount: number;
  date: string;
  receiptNo: string;
  notes: string;
  createdBy: string;
  createdAt?: string;
  version?: number;
  isDeleted?: boolean;
}

export interface Loan extends IAuditable {
  memberId: string;
  memberName: string;
  memberCode: string;
  principal: number;
  interestRate: number; // e.g., 6 for 6% per year
  durationMonths: number;
  startDate: string;
  status: 'pending' | 'active' | 'paid' | 'overdue';
  guarantorIds: string[]; // memberIds
  guarantorNames: string[];
  monthlyPayment: number;
  remainingBalance: number;
}

export interface Installment {
  id: string;
  loanId: string;
  tenantId: string;
  memberId: string;
  memberName: string;
  amountPaid: number;
  principalPaid: number;
  interestPaid: number;
  date: string;
  receiptNo: string;
  createdAt?: string;
  createdBy?: string;
  version?: number;
  isDeleted?: boolean;
}

export interface Welfare extends IAuditable {
  memberId: string;
  memberName: string;
  memberCode: string;
  type: 'medical' | 'elderly' | 'funeral' | 'education';
  amount: number;
  requestDate: string;
  approveDate?: string;
  notes: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface Meeting {
  id: string;
  tenantId: string;
  title: string;
  date: string;
  attendeesCount: number;
  minutes: string;
  summary?: string;
  resolutions: string[];
  createdAt?: string;
  createdBy?: string;
  version?: number;
  isDeleted?: boolean;
}

export interface Document {
  id: string;
  tenantId: string;
  type: 'in' | 'out' | 'cert';
  docNo: string;
  title: string;
  date: string;
  sender: string;
  receiver: string;
  content: string;
  summary?: string;
  createdAt?: string;
  createdBy?: string;
  version?: number;
  isDeleted?: boolean;
}

export interface AuditLog {
  id: string;
  tenantId: string;
  username: string;
  action: string;
  details: string;
  timestamp: string;
  stateBefore?: string;
  stateAfter?: string;
  ipAddress?: string;
  deviceInfo?: string;
}

export interface WelfareRule {
  type: 'medical' | 'elderly' | 'funeral' | 'education';
  name: string;
  amount: number;
  conditions: string;
}

export interface FundSettings {
  tenantId: string;
  sharePrice: number;
  interestRateDeposit: number;
  interestRateLoan: number;
  maxLoanAmount: number;
  minGuarantors: number;
  welfareRules: WelfareRule[];
}

export interface DbSchema {
  tenants: Tenant[];
  members: Member[];
  transactions: Transaction[];
  loans: Loan[];
  installments: Installment[];
  welfares: Welfare[];
  meetings: Meeting[];
  documents: Document[];
  auditLogs: AuditLog[];
  settings: FundSettings[];
}
