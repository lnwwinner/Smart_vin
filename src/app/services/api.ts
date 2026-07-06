/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable, signal, computed } from '@angular/core';

export interface Tenant {
  id: string;
  name: string;
  code: string;
  village: string;
  subdistrict: string;
  district: string;
  province: string;
}

export interface Member {
  id: string;
  tenantId: string;
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
  verifiedByThaid?: boolean;
  thaidVerificationDate?: string;
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
}

export interface Loan {
  id: string;
  tenantId: string;
  memberId: string;
  memberName: string;
  memberCode: string;
  principal: number;
  interestRate: number;
  durationMonths: number;
  startDate: string;
  status: 'pending' | 'active' | 'paid' | 'overdue';
  guarantorIds: string[];
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
}

export interface Welfare {
  id: string;
  tenantId: string;
  memberId: string;
  memberName: string;
  memberCode: string;
  type: 'medical' | 'elderly' | 'funeral' | 'education';
  amount: number;
  requestDate: string;
  approveDate?: string;
  status: 'pending' | 'approved' | 'rejected';
  notes: string;
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
}

export interface AuditLog {
  id: string;
  tenantId: string;
  username: string;
  action: string;
  details: string;
  timestamp: string;
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

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  // Signals representing state
  tenants = signal<Tenant[]>([]);
  selectedTenantId = signal<string>('t1');

  members = signal<Member[]>([]);
  transactions = signal<Transaction[]>([]);
  loans = signal<Loan[]>([]);
  installments = signal<Installment[]>([]);
  welfares = signal<Welfare[]>([]);
  meetings = signal<Meeting[]>([]);
  documents = signal<Document[]>([]);
  auditLogs = signal<AuditLog[]>([]);
  settings = signal<FundSettings | null>(null);

  loading = signal<boolean>(false);
  error = signal<string | null>(null);

  // Computed totals for dashboard
  totalDeposits = computed(() => this.members().reduce((sum, m) => sum + m.depositBalance, 0));
  totalShares = computed(() => {
    const sPrice = this.settings()?.sharePrice || 100;
    return this.members().reduce((sum, m) => sum + m.shareCount, 0) * sPrice;
  });
  totalLoansDisbursed = computed(() => this.loans().reduce((sum, l) => sum + l.principal, 0));
  totalLoansOutstanding = computed(() => this.loans().reduce((sum, l) => sum + (l.status === 'active' || l.status === 'overdue' ? l.remainingBalance : 0), 0));
  totalWelfarePayout = computed(() => this.welfares()
    .filter(w => w.status === 'approved')
    .reduce((sum, w) => sum + w.amount, 0)
  );

  // Simulated cash book balance: Total deposits + Share sales + Loan payments - Loan disbursements - Welfare payouts
  cashBalance = computed(() => {
    const depositsSum = this.totalDeposits();
    const sharesSum = this.totalShares();
    const loanPaymentsSum = this.installments().reduce((sum, i) => sum + i.amountPaid, 0);
    const loanDisbursedSum = this.loans().filter(l => l.status !== 'pending').reduce((sum, l) => sum + l.principal, 0);
    const welfaresSum = this.totalWelfarePayout();
    
    // Add seed factor to match bank balance
    return Math.max(50000, 1500000 + depositsSum + sharesSum + loanPaymentsSum - loanDisbursedSum - welfaresSum);
  });

  selectedTenant = computed(() => this.tenants().find(t => t.id === this.selectedTenantId()));

  constructor() {
    this.init();
  }

  async init() {
    await this.loadTenants();
    if (this.tenants().length > 0) {
      // default to first tenant
      const firstId = this.tenants()[0].id;
      this.selectedTenantId.set(firstId);
      await this.loadTenantData(firstId);
    }
  }

  // Load list of tenants
  async loadTenants() {
    try {
      this.loading.set(true);
      const res = await fetch('/api/tenants');
      if (!res.ok) throw new Error('ไม่สามารถโหลดข้อมูลกองทุนได้');
      const data = await res.json();
      this.tenants.set(data);
    } catch (err: any) {
      this.error.set(err.message);
    } finally {
      this.loading.set(false);
    }
  }

  // Load complete tenant data
  async loadTenantData(tenantId: string) {
    if (!tenantId) return;
    try {
      this.loading.set(true);
      this.error.set(null);
      const res = await fetch(`/api/tenants/${tenantId}/data`);
      if (!res.ok) throw new Error('ไม่สามารถเชื่อมต่อข้อมูลภายในของกองทุนได้');
      const data = await res.json();
      
      this.members.set(data.members || []);
      this.transactions.set(data.transactions || []);
      this.loans.set(data.loans || []);
      this.installments.set(data.installments || []);
      this.welfares.set(data.welfares || []);
      this.meetings.set(data.meetings || []);
      this.documents.set(data.documents || []);
      this.auditLogs.set(data.auditLogs || []);
      this.settings.set(data.settings || null);
    } catch (err: any) {
      this.error.set(err.message);
    } finally {
      this.loading.set(false);
    }
  }

  // Switch active tenant
  async switchTenant(tenantId: string) {
    this.selectedTenantId.set(tenantId);
    await this.loadTenantData(tenantId);
  }

  // Create new fund tenant
  async createTenant(name: string, code: string, village: string, subdistrict: string, district: string, province: string) {
    try {
      this.loading.set(true);
      const id = 't-' + Date.now();
      const res = await fetch('/api/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name, code, village, subdistrict, district, province })
      });
      if (!res.ok) throw new Error('ล้มเหลวในการสร้างกองทุนใหม่');
      await this.loadTenants();
      await this.switchTenant(id);
    } catch (err: any) {
      this.error.set(err.message);
    } finally {
      this.loading.set(false);
    }
  }

  // Save/Update member
  async saveMember(member: Member) {
    try {
      this.loading.set(true);
      const res = await fetch(`/api/tenants/${this.selectedTenantId()}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(member)
      });
      if (!res.ok) throw new Error('ล้มเหลวในการบันทึกข้อมูลสมาชิก');
      await this.loadTenantData(this.selectedTenantId());
    } catch (err: any) {
      this.error.set(err.message);
      throw err;
    } finally {
      this.loading.set(false);
    }
  }

  // Delete member
  async deleteMember(id: string) {
    try {
      this.loading.set(true);
      const res = await fetch(`/api/tenants/${this.selectedTenantId()}/members/${id}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('ล้มเหลวในการลบสมาชิก');
      await this.loadTenantData(this.selectedTenantId());
    } catch (err: any) {
      this.error.set(err.message);
      throw err;
    } finally {
      this.loading.set(false);
    }
  }

  // Save Transaction
  async saveTransaction(tx: Transaction) {
    try {
      this.loading.set(true);
      const res = await fetch(`/api/tenants/${this.selectedTenantId()}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tx)
      });
      if (!res.ok) throw new Error('ล้มเหลวในการทำรายการธุรกรรม');
      await this.loadTenantData(this.selectedTenantId());
    } catch (err: any) {
      this.error.set(err.message);
      throw err;
    } finally {
      this.loading.set(false);
    }
  }

  // Save Loan
  async saveLoan(loan: Loan) {
    try {
      this.loading.set(true);
      const res = await fetch(`/api/tenants/${this.selectedTenantId()}/loans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loan)
      });
      if (!res.ok) throw new Error('ล้มเหลวในการบันทึกสัญญากู้ยืม');
      await this.loadTenantData(this.selectedTenantId());
    } catch (err: any) {
      this.error.set(err.message);
      throw err;
    } finally {
      this.loading.set(false);
    }
  }

  // Save Installment Payment
  async saveInstallment(inst: Installment) {
    try {
      this.loading.set(true);
      const res = await fetch(`/api/tenants/${this.selectedTenantId()}/installments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inst)
      });
      if (!res.ok) throw new Error('ล้มเหลวในการบันทึกการรับชำระเงินต้นและดอกเบี้ย');
      await this.loadTenantData(this.selectedTenantId());
    } catch (err: any) {
      this.error.set(err.message);
      throw err;
    } finally {
      this.loading.set(false);
    }
  }

  // Save Welfare
  async saveWelfare(wf: Welfare) {
    try {
      this.loading.set(true);
      const res = await fetch(`/api/tenants/${this.selectedTenantId()}/welfares`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(wf)
      });
      if (!res.ok) throw new Error('ล้มเหลวในการบันทึกสวัสดิการชุมชน');
      await this.loadTenantData(this.selectedTenantId());
    } catch (err: any) {
      this.error.set(err.message);
      throw err;
    } finally {
      this.loading.set(false);
    }
  }

  // Save Meeting
  async saveMeeting(mt: Meeting) {
    try {
      this.loading.set(true);
      const res = await fetch(`/api/tenants/${this.selectedTenantId()}/meetings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mt)
      });
      if (!res.ok) throw new Error('ล้มเหลวในการบันทึกรายงานประชุม');
      await this.loadTenantData(this.selectedTenantId());
    } catch (err: any) {
      this.error.set(err.message);
      throw err;
    } finally {
      this.loading.set(false);
    }
  }

  // Save Document
  async saveDocument(doc: Document) {
    try {
      this.loading.set(true);
      const res = await fetch(`/api/tenants/${this.selectedTenantId()}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(doc)
      });
      if (!res.ok) throw new Error('ล้มเหลวในการบันทึกหนังสือราชการ/เอกสาร');
      await this.loadTenantData(this.selectedTenantId());
    } catch (err: any) {
      this.error.set(err.message);
      throw err;
    } finally {
      this.loading.set(false);
    }
  }

  // Save Settings
  async saveSettings(settings: FundSettings) {
    try {
      this.loading.set(true);
      const res = await fetch(`/api/tenants/${this.selectedTenantId()}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      if (!res.ok) throw new Error('ล้มเหลวในการบันทึกระเบียบข้อกำหนด');
      await this.loadTenantData(this.selectedTenantId());
    } catch (err: any) {
      this.error.set(err.message);
      throw err;
    } finally {
      this.loading.set(false);
    }
  }

  // Restore Database backup
  async restoreBackup(dbJson: any) {
    try {
      this.loading.set(true);
      const res = await fetch('/api/backup/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dbJson)
      });
      if (!res.ok) throw new Error('ล้มเหลวในการกู้คืนข้อมูลสำรอง');
      await this.loadTenants();
      await this.loadTenantData(this.selectedTenantId());
    } catch (err: any) {
      this.error.set(err.message);
      throw err;
    } finally {
      this.loading.set(false);
    }
  }

  // Call Gemini AI
  async callAi(action: string, prompt: string, context?: any): Promise<string> {
    try {
      // Build smart default context
      const defaultContext = {
        tenantName: this.selectedTenant()?.name,
        members: this.members().map(m => ({ id: m.id, memberCode: m.memberCode, name: m.name, idCard: m.idCard, depositBalance: m.depositBalance, shareCount: m.shareCount, loanCount: m.loanCount })),
        transactions: this.transactions().slice(0, 10),
        loans: this.loans(),
        membersCount: this.members().length,
        totalDeposits: this.totalDeposits(),
        totalShares: this.totalShares(),
        totalLoans: this.totalLoansOutstanding(),
        cashBalance: this.cashBalance(),
        ...context
      };

      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, prompt, context: defaultContext })
      });
      if (!res.ok) throw new Error('AI ล้มเหลวในการตอบกลับ');
      const data = await res.json();
      return data.text;
    } catch (err: any) {
      console.error(err);
      return `❌ เกิดข้อผิดพลาดทางเทคนิคในการเรียก AI: ${err.message}`;
    }
  }

  // ==========================================
  // THAID INTEGRATION SERVICES
  // ==========================================

  async getThaidProfiles(): Promise<any[]> {
    const res = await fetch('/api/thaid/profiles');
    if (!res.ok) throw new Error('ไม่สามารถเชื่อมต่อรายชื่อจำลองของระบบ ThaID ได้');
    return res.json();
  }

  async generateThaidQr(): Promise<{ token: string, qrUrl: string, expiresIn: number }> {
    const res = await fetch('/api/thaid/qr', { method: 'POST' });
    if (!res.ok) throw new Error('ไม่สามารถสร้างเซสชัน ThaID QR ได้');
    return res.json();
  }

  async simulateThaidScan(token: string, profile: any): Promise<any> {
    const res = await fetch('/api/thaid/simulate-scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, profile })
    });
    if (!res.ok) throw new Error('ล้มเหลวในการส่งผลการสแกนจำลอง');
    return res.json();
  }

  async checkThaidSession(token: string): Promise<{ status: 'pending' | 'success' | 'failed', profile?: any }> {
    const res = await fetch(`/api/thaid/session/${token}`);
    if (!res.ok) throw new Error('ล้มเหลวในการดึงสถานะเซสชัน');
    return res.json();
  }

  async verifyExistingMemberWithThaid(memberId: string, idCard: string): Promise<any> {
    const res = await fetch(`/api/tenants/${this.selectedTenantId()}/members/${memberId}/verify-thaid`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idCard })
    });
    if (!res.ok) throw new Error('ล้มเหลวในการอัปเดตสถานะการตรวจสอบ ThaID');
    const data = await res.json();
    await this.loadTenantData(this.selectedTenantId());
    return data;
  }
}
