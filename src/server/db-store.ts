import { promises as fs } from 'node:fs';
import { join } from 'node:path';

import { Tenant, Member, Transaction, Loan, Installment, Welfare, Meeting, Document, AuditLog, WelfareRule, FundSettings, DbSchema, Passbook, PassbookPrintLine, ExpenseCategory, Expense } from './domain/entities.js';

export type { Tenant, Member, Transaction, Loan, Installment, Welfare, Meeting, Document, AuditLog, WelfareRule, FundSettings, DbSchema, Passbook, PassbookPrintLine, ExpenseCategory, Expense };

const dbFilePath = join(import.meta.dirname, '../../database.json');

// Complete Seed Data for rich initial experience
const initialDb: DbSchema = {
  tenants: [
    { id: 't1', name: 'กองทุนสัจจะและสวัสดิการชุมชนบ้านแสนสุข', code: 'SK-BS1', village: 'บ้านแสนสุข หมู่ 3', subdistrict: 'หนองหลัก', district: 'ไชยวาน', province: 'อุดรธานี' },
    { id: 't2', name: 'กองทุนสัจจะออมทรัพย์เพื่อการผลิตบ้านร่มเย็น', code: 'SK-RY2', village: 'บ้านร่มเย็น หมู่ 5', subdistrict: 'แม่แรม', district: 'แม่ริม', province: 'เชียงใหม่' },
    { id: 't3', name: 'กองทุนสวัสดิการชุมชนตำบลพัฒนาอัจฉริยะ', code: 'SK-PT3', village: 'บ้านพัฒนา หมู่ 1', subdistrict: 'นาดี', district: 'เมือง', province: 'สมุทรสาคร' }
  ],
  members: [
    { id: 'm1', tenantId: 't1', memberCode: 'M001', title: 'นาย', name: 'สมศักดิ์ รักดี', idCard: '3410100222334', phone: '081-234-5678', birthdate: '1961-05-12', address: '12 หมู่ 3 บ้านแสนสุข ต.หนองหลัก อ.ไชยวาน จ.อุดรธานี', joinDate: '2020-01-10', status: 'active', depositBalance: 24500, shareCount: 150, loanCount: 1 },
    { id: 'm2', tenantId: 't1', memberCode: 'M002', title: 'นาง', name: 'ทองดี มั่งมี', idCard: '3410100445566', phone: '089-876-5432', birthdate: '1965-08-20', address: '45/1 หมู่ 3 บ้านแสนสุข ต.หนองหลัก อ.ไชยวาน จ.อุดรธานี', joinDate: '2020-01-10', status: 'active', depositBalance: 42000, shareCount: 300, loanCount: 0 },
    { id: 'm3', tenantId: 't1', memberCode: 'M003', title: 'นางสาว', name: 'จันทร์เพ็ญ สว่างจิต', idCard: '3410100556677', phone: '085-555-1234', birthdate: '1978-11-03', address: '88 หมู่ 3 บ้านแสนสุข ต.หนองหลัก อ.ไชยวาน จ.อุดรธานี', joinDate: '2020-02-15', status: 'active', depositBalance: 12000, shareCount: 100, loanCount: 1 },
    { id: 'm4', tenantId: 't1', memberCode: 'M004', title: 'นาย', name: 'พูนสุข ทวีคูณ', idCard: '3410100112233', phone: '082-111-2222', birthdate: '1955-03-25', address: '109 หมู่ 3 บ้านแสนสุข ต.หนองหลัก อ.ไชยวาน จ.อุดรธานี', joinDate: '2020-02-15', status: 'active', depositBalance: 56000, shareCount: 500, loanCount: 0 },
    { id: 'm5', tenantId: 't1', memberCode: 'M005', title: 'นาย', name: 'บุญนำ น้อมจิต', idCard: '3410100998877', phone: '083-999-8888', birthdate: '1948-12-30', address: '5 หมู่ 3 บ้านแสนสุข ต.หนองหลัก อ.ไชยวาน จ.อุดรธานี', joinDate: '2020-03-01', status: 'active', depositBalance: 8500, shareCount: 50, loanCount: 0 },
    
    // Tenant 2
    { id: 'm6', tenantId: 't2', memberCode: 'M001', title: 'นาย', name: 'เกียรติศักดิ์ ยอดเขา', idCard: '3500100111222', phone: '084-123-9988', birthdate: '1972-04-15', address: '50 ต.แม่แรม อ.แม่ริม จ.เชียงใหม่', joinDate: '2021-05-05', status: 'active', depositBalance: 15000, shareCount: 100, loanCount: 0 },
    { id: 'm7', tenantId: 't2', memberCode: 'M002', title: 'นาง', name: 'พิมพา ศรีล้านนา', idCard: '3500100333444', phone: '086-555-6677', birthdate: '1980-09-18', address: '122 ต.แม่แรม อ.แม่ริม จ.เชียงใหม่', joinDate: '2021-05-05', status: 'active', depositBalance: 28000, shareCount: 200, loanCount: 0 }
  ],
  transactions: [
    { id: 'tx1', tenantId: 't1', memberId: 'm1', memberName: 'สมศักดิ์ รักดี', memberCode: 'M001', type: 'deposit', amount: 5000, date: '2026-06-01T10:00:00.000Z', receiptNo: 'RC-20260601-01', notes: 'ฝากสัจจะรายเดือน', createdBy: 'เหรัญญิกแสนสุข' },
    { id: 'tx2', tenantId: 't1', memberId: 'm1', memberName: 'สมศักดิ์ รักดี', memberCode: 'M001', type: 'share_buy', amount: 1500, date: '2026-06-01T10:05:00.000Z', receiptNo: 'RC-20260601-02', notes: 'ซื้อหุ้นสะสมเพิ่ม 150 หุ้น', createdBy: 'เหรัญญิกแสนสุข' },
    { id: 'tx3', tenantId: 't1', memberId: 'm2', memberName: 'ทองดี มั่งมี', memberCode: 'M002', type: 'deposit', amount: 10000, date: '2026-06-02T09:30:00.000Z', receiptNo: 'RC-20260602-01', notes: 'ฝากออมทรัพย์กองทุน', createdBy: 'เหรัญญิกแสนสุข' },
    { id: 'tx4', tenantId: 't1', memberId: 'm3', memberName: 'จันทร์เพ็ญ สว่างจิต', memberCode: 'M003', type: 'loan_disbursement', amount: 30000, date: '2026-06-10T14:00:00.000Z', receiptNo: 'RC-20260610-01', notes: 'จ่ายเงินกู้สัญญาที่ LN001', createdBy: 'ประธานแสนสุข' },
    { id: 'tx5', tenantId: 't1', memberId: 'm3', memberName: 'จันทร์เพ็ญ สว่างจิต', memberCode: 'M003', type: 'loan_payment', amount: 2650, date: '2026-07-01T09:00:00.000Z', receiptNo: 'RC-20260701-01', notes: 'ชำระงวดที่ 1 (เงินต้น 2,500 ดอกเบี้ย 150)', createdBy: 'เหรัญญิกแสนสุข' },
    { id: 'tx6', tenantId: 't1', memberId: 'm5', memberName: 'บุญนำ น้อมจิต', memberCode: 'M005', type: 'welfare_payout', amount: 2000, date: '2026-06-15T11:00:00.000Z', receiptNo: 'WF-20260615-01', notes: 'จ่ายสวัสดิการผู้สูงอายุประจำไตรมาส', createdBy: 'เหรัญญิกแสนสุข' }
  ],
  loans: [
    { id: 'l1', tenantId: 't1', memberId: 'm1', memberName: 'สมศักดิ์ รักดี', memberCode: 'M001', principal: 50000, interestRate: 6, durationMonths: 12, startDate: '2026-01-10', status: 'active', guarantorIds: ['m2', 'm4'], guarantorNames: ['ทองดี มั่งมี', 'พูนสุข ทวีคูณ'], monthlyPayment: 4417, remainingBalance: 30000 },
    { id: 'l2', tenantId: 't1', memberId: 'm3', memberName: 'จันทร์เพ็ญ สว่างจิต', memberCode: 'M003', principal: 30000, interestRate: 6, durationMonths: 12, startDate: '2026-06-10', status: 'active', guarantorIds: ['m1'], guarantorNames: ['สมศักดิ์ รักดี'], monthlyPayment: 2650, remainingBalance: 27500 }
  ],
  installments: [
    { id: 'it1', loanId: 'l1', tenantId: 't1', memberId: 'm1', memberName: 'สมศักดิ์ รักดี', amountPaid: 4417, principalPaid: 4167, interestPaid: 250, date: '2026-02-10T09:00:00.000Z', receiptNo: 'RC-260210-01' },
    { id: 'it2', loanId: 'l2', tenantId: 't1', memberId: 'm3', memberName: 'จันทร์เพ็ญ สว่างจิต', amountPaid: 2650, principalPaid: 2500, interestPaid: 150, date: '2026-07-01T09:00:00.000Z', receiptNo: 'RC-20260701-01' }
  ],
  welfares: [
    { id: 'wf1', tenantId: 't1', memberId: 'm5', memberName: 'บุญนำ น้อมจิต', memberCode: 'M005', type: 'elderly', amount: 2000, requestDate: '2026-06-10', approveDate: '2026-06-12', status: 'approved', notes: 'เบี้ยสวัสดิการผู้สูงอายุครบ 75 ปี' },
    { id: 'wf2', tenantId: 't1', memberId: 'm1', memberName: 'สมศักดิ์ รักดี', memberCode: 'M001', type: 'medical', amount: 1500, requestDate: '2026-06-25', status: 'pending', notes: 'ขอสวัสดิการรักษายอดตัวกรณีเข้า รพ. อำเภอ' }
  ],
  meetings: [
    {
      id: 'mt1',
      tenantId: 't1',
      title: 'การประชุมสามัญประจำเดือนมิถุนายน 2569',
      date: '2026-06-05',
      attendeesCount: 42,
      minutes: 'ระเบียบวาระที่ 1 เรื่องที่ประธานแจ้งให้ที่ประชุมทราบ: ขอบคุณสมาชิกที่มาร่วมประชุมพร้อมเพรียง\nระเบียบวาระที่ 2 รับรองรายงานการประชุมครั้งที่แล้ว: ที่ประชุมมีมติรับรองเป็นเอกฉันท์\nระเบียบวาระที่ 3 เรื่องเพื่อพิจารณา: การอนุมัติเงินกู้สำหรับนางสาวจันทร์เพ็ญ สว่างจิต จำนวน 30,000 บาท เพื่อใช้ในการเกษตรกรรม โดยมีนายสมศักดิ์ รักดี เป็นผู้ค้ำประกัน\nระเบียบวาระที่ 4 มติที่ประชุม: อนุมัติเงินกู้ 30,000 บาท อัตราดอกเบี้ยร้อยละ 6 ต่อปี ระยะเวลาผ่อนชำระ 12 เดือน ให้จ่ายเงินในวันที่ 10 มิถุนายน 2569',
      summary: 'ประธานแจ้งเปิดประชุม รับรองรายงานครั้งก่อน พิจารณาและอนุมัติเงินกู้ของ น.ส.จันทร์เพ็ญ สว่างจิต จำนวน 30,000 บาท ดอกเบี้ย 6% ผ่อนชำระ 12 เดือน ค้ำประกันโดย นายสมศักดิ์ รักดี',
      resolutions: ['อนุมัติเงินกู้ น.ส.จันทร์เพ็ญ 30,000 บาท ดอกเบี้ยร้อยละ 6 ต่อปี ค้ำประกันโดย นายสมศักดิ์ รักดี']
    }
  ],
  documents: [
    { id: 'd1', tenantId: 't1', type: 'cert', docNo: 'CER-202607-001', title: 'หนังสือรับรองสมาชิกและยอดเงินสะสม', date: '2026-07-02', sender: 'กองทุนบ้านแสนสุข', receiver: 'สมศักดิ์ รักดี', content: 'ขอรับรองว่า นายสมศักดิ์ รักดี เป็นสมาชิกกองทุนบ้านแสนสุขอย่างถูกต้อง มีเงินฝากสัจจะสะสมรวม 24,500 บาท และถือหุ้นจำนวน 150 หุ้น มูลค่ารวม 15,000 บาท ไม่มีประวัติผิดนัดชำระหนี้ ออกให้เพื่อใช้เป็นหลักฐานในการทำธุรกรรมสวัสดิการชุมชน', summary: 'หนังสือรับรองยอดเงินฝากสัจจะ 24,500 บาท และ หุ้น 150 หุ้น ของ นายสมศักดิ์ รักดี ออกให้ ณ วันที่ 2 กรกฎาคม 2569' }
  ],
  auditLogs: [
    { id: 'al1', tenantId: 't1', username: 'admin', action: 'CREATE_MEMBER', details: 'สร้างสมาชิกใหม่: นายสมศักดิ์ รักดี รหัส M001', timestamp: '2026-06-01T08:00:00.000Z' },
    { id: 'al2', tenantId: 't1', username: 'admin', action: 'DEPOSIT', details: 'บันทึกฝากเงิน 5,000 บาท สำหรับ นายสมศักดิ์ รักดี', timestamp: '2026-06-01T10:00:00.000Z' }
  ],
  settings: [
    {
      tenantId: 't1',
      sharePrice: 100,
      interestRateDeposit: 1.5,
      interestRateLoan: 6.0,
      maxLoanAmount: 100000,
      minGuarantors: 1,
      welfareRules: [
        { type: 'medical', name: 'สวัสดิการค่ารักษาพยาบาล', amount: 1500, conditions: 'เป็นสมาชิกอย่างน้อย 6 เดือน เบิกจ่ายตามจริงไม่เกิน 1,500 บาทต่อปี' },
        { type: 'elderly', name: 'สวัสดิการผู้สูงอายุประจำปี', amount: 2000, conditions: 'สมาชิกอายุครบ 60 ปีขึ้นไป จ่ายปีละครั้ง ครั้งละ 2,000 บาท' },
        { type: 'funeral', name: 'สวัสดิการฌาปนกิจสงเคราะห์', amount: 10000, conditions: 'จ่ายกรณีสมาชิกเสียชีวิต สมาชิกทุกคนร่วมสัจจะสมทบคนละ 50 บาท' },
        { type: 'education', name: 'ทุนการศึกษาบุตรสมาชิก', amount: 2000, conditions: 'เรียนดีแต่ขาดแคลนทุนทรัพย์ สูงสุดปีละ 1 ครั้งต่อครอบครัว' }
      ]
    },
    {
      tenantId: 't2',
      sharePrice: 10,
      interestRateDeposit: 2.0,
      interestRateLoan: 8.0,
      maxLoanAmount: 50000,
      minGuarantors: 2,
      welfareRules: [
        { type: 'medical', name: 'ช่วยรักษากรณีเจ็บป่วย', amount: 1000, conditions: 'นอน รพ. คืนละ 200 บาท ไม่เกิน 5 คืนต่อปี' },
        { type: 'funeral', name: 'สวัสดิการฌาปนกิจล้านนา', amount: 15000, conditions: 'จ่ายให้ทายาทสายตรงกรณีเสียชีวิต' }
      ]
    },
    {
      tenantId: 't3',
      sharePrice: 100,
      interestRateDeposit: 1.0,
      interestRateLoan: 5.0,
      maxLoanAmount: 150000,
      minGuarantors: 1,
      welfareRules: [
        { type: 'medical', name: 'สวัสดิการสุขภาพดีถ้วนหน้า', amount: 2000, conditions: 'เบิกได้ตามจ่ายจริง สูงสุด 2,000 บาทต่อปี' }
      ]
    }
  ],
  passbooks: [
    { id: 'pb1', tenantId: 't1', memberId: 'm1', memberCode: 'M001', memberName: 'สมศักดิ์ รักดี', bookNo: '1', accountNo: '1001-0001', status: 'active', issuedDate: '2020-01-10' },
    { id: 'pb2', tenantId: 't1', memberId: 'm2', memberCode: 'M002', memberName: 'ทองดี มั่งมี', bookNo: '1', accountNo: '1001-0002', status: 'active', issuedDate: '2020-01-10' },
    { id: 'pb3', tenantId: 't1', memberId: 'm3', memberCode: 'M003', memberName: 'จันทร์เพ็ญ สว่างจิต', bookNo: '1', accountNo: '1001-0003', status: 'active', issuedDate: '2020-02-15' },
    { id: 'pb4', tenantId: 't1', memberId: 'm4', memberCode: 'M004', memberName: 'พูนสุข ทวีคูณ', bookNo: '1', accountNo: '1001-0004', status: 'active', issuedDate: '2020-02-15' },
    { id: 'pb5', tenantId: 't1', memberId: 'm5', memberCode: 'M005', memberName: 'บุญนำ น้อมจิต', bookNo: '1', accountNo: '1001-0005', status: 'active', issuedDate: '2020-03-01' }
  ],
  passbookPrintLines: [],
  expenseCategories: [],
  expenses: []
};

export class DbStore {
  private data: DbSchema | null = null;

  private async load(): Promise<DbSchema> {
    if (this.data) return this.data;
    try {
      const text = await fs.readFile(dbFilePath, 'utf-8');
      const parsed = JSON.parse(text);
      if (!parsed.passbooks) parsed.passbooks = [];
      if (!parsed.passbookPrintLines) parsed.passbookPrintLines = [];
      if (!parsed.expenseCategories) parsed.expenseCategories = [];
      if (!parsed.expenses) parsed.expenses = [];
      this.data = parsed;
      return this.data!;
    } catch {
      // File doesn't exist, save default and return
      this.data = JSON.parse(JSON.stringify(initialDb));
      if (!this.data!.passbooks) this.data!.passbooks = [];
      if (!this.data!.passbookPrintLines) this.data!.passbookPrintLines = [];
      if (!this.data!.expenseCategories) this.data!.expenseCategories = [];
      if (!this.data!.expenses) this.data!.expenses = [];
      await this.save();
      return this.data!;
    }
  }

  private async save(): Promise<void> {
    if (!this.data) return;
    await fs.writeFile(dbFilePath, JSON.stringify(this.data, null, 2), 'utf-8');
  }

  // Tenant Operations
  async getTenants(): Promise<Tenant[]> {
    const db = await this.load();
    return db.tenants;
  }

  async saveTenant(tenant: Tenant): Promise<Tenant> {
    const db = await this.load();
    const idx = db.tenants.findIndex(t => t.id === tenant.id);
    if (idx >= 0) db.tenants[idx] = tenant;
    else db.tenants.push(tenant);
    await this.save();
    return tenant;
  }

  // Settings
  async getSettings(tenantId: string): Promise<FundSettings> {
    const db = await this.load();
    let set = db.settings.find(s => s.tenantId === tenantId);
    if (!set) {
      set = {
        tenantId,
        sharePrice: 100,
        interestRateDeposit: 1.5,
        interestRateLoan: 6.0,
        maxLoanAmount: 100000,
        minGuarantors: 1,
        welfareRules: [
          { type: 'medical', name: 'สวัสดิการรักษาพยาบาล', amount: 1500, conditions: 'เป็นสมาชิกอย่างน้อย 6 เดือน' }
        ]
      };
      db.settings.push(set);
      await this.save();
    }
    return set;
  }

  async updateSettings(settings: FundSettings): Promise<FundSettings> {
    const db = await this.load();
    const idx = db.settings.findIndex(s => s.tenantId === settings.tenantId);
    if (idx >= 0) db.settings[idx] = settings;
    else db.settings.push(settings);
    await this.save();
    return settings;
  }

  // Members
  async getMembers(tenantId: string): Promise<Member[]> {
    const db = await this.load();
    return db.members.filter(m => m.tenantId === tenantId);
  }

  async saveMember(member: Member): Promise<Member> {
    const db = await this.load();
    const idx = db.members.findIndex(m => m.id === member.id);
    if (idx >= 0) {
      db.members[idx] = member;
    } else {
      db.members.push(member);
    }
    await this.save();
    return member;
  }

  async deleteMember(id: string): Promise<void> {
    const db = await this.load();
    db.members = db.members.filter(m => m.id !== id);
    await this.save();
  }

  // Transactions
  async getTransactions(tenantId: string): Promise<Transaction[]> {
    const db = await this.load();
    return db.transactions.filter(t => t.tenantId === tenantId);
  }

  async saveTransaction(tx: Transaction): Promise<Transaction> {
    const db = await this.load();
    db.transactions.push(tx);
    
    // Side effect: update member balance/shares
    const mIdx = db.members.findIndex(m => m.id === tx.memberId);
    if (mIdx >= 0) {
      const member = db.members[mIdx];
      if (tx.type === 'deposit') {
        member.depositBalance += tx.amount;
      } else if (tx.type === 'withdrawal') {
        member.depositBalance -= tx.amount;
      } else if (tx.type === 'share_buy') {
        const settings = db.settings.find(s => s.tenantId === tx.tenantId);
        const price = settings?.sharePrice || 100;
        member.shareCount += Math.round(tx.amount / price);
      } else if (tx.type === 'share_sell') {
        const settings = db.settings.find(s => s.tenantId === tx.tenantId);
        const price = settings?.sharePrice || 100;
        member.shareCount -= Math.round(tx.amount / price);
      } else if (tx.type === 'welfare_payout') {
        // Just logged
      }
    }

    await this.save();
    return tx;
  }

  // Loans
  async getLoans(tenantId: string): Promise<Loan[]> {
    const db = await this.load();
    return db.loans.filter(l => l.tenantId === tenantId);
  }

  async saveLoan(loan: Loan): Promise<Loan> {
    const db = await this.load();
    const idx = db.loans.findIndex(l => l.id === loan.id);
    if (idx >= 0) {
      db.loans[idx] = loan;
    } else {
      db.loans.push(loan);
      // update loan count
      const mIdx = db.members.findIndex(m => m.id === loan.memberId);
      if (mIdx >= 0) db.members[mIdx].loanCount += 1;
    }
    await this.save();
    return loan;
  }

  // Installments / Payments
  async getInstallments(tenantId: string): Promise<Installment[]> {
    const db = await this.load();
    return db.installments.filter(i => i.tenantId === tenantId);
  }

  async saveInstallment(inst: Installment): Promise<Installment> {
    const db = await this.load();
    db.installments.push(inst);

    // Update the loan balance
    const lIdx = db.loans.findIndex(l => l.id === inst.loanId);
    if (lIdx >= 0) {
      const loan = db.loans[lIdx];
      loan.remainingBalance = Math.max(0, loan.remainingBalance - inst.principalPaid);
      if (loan.remainingBalance <= 0) {
        loan.status = 'paid';
      }
    }

    await this.save();
    return inst;
  }

  // Welfare
  async getWelfares(tenantId: string): Promise<Welfare[]> {
    const db = await this.load();
    return db.welfares.filter(w => w.tenantId === tenantId);
  }

  async saveWelfare(wf: Welfare): Promise<Welfare> {
    const db = await this.load();
    const idx = db.welfares.findIndex(w => w.id === wf.id);
    if (idx >= 0) db.welfares[idx] = wf;
    else db.welfares.push(wf);
    await this.save();
    return wf;
  }

  // Meetings
  async getMeetings(tenantId: string): Promise<Meeting[]> {
    const db = await this.load();
    return db.meetings.filter(m => m.tenantId === tenantId);
  }

  async saveMeeting(mt: Meeting): Promise<Meeting> {
    const db = await this.load();
    const idx = db.meetings.findIndex(m => m.id === mt.id);
    if (idx >= 0) db.meetings[idx] = mt;
    else db.meetings.push(mt);
    await this.save();
    return mt;
  }

  // Documents
  async getDocuments(tenantId: string): Promise<Document[]> {
    const db = await this.load();
    return db.documents.filter(d => d.tenantId === tenantId);
  }

  async saveDocument(doc: Document): Promise<Document> {
    const db = await this.load();
    const idx = db.documents.findIndex(d => d.id === doc.id);
    if (idx >= 0) db.documents[idx] = doc;
    else db.documents.push(doc);
    await this.save();
    return doc;
  }

  // Audit Logs
  async getAuditLogs(tenantId: string): Promise<AuditLog[]> {
    const db = await this.load();
    return db.auditLogs.filter(a => a.tenantId === tenantId);
  }

  async saveAuditLog(log: AuditLog): Promise<AuditLog> {
    const db = await this.load();
    db.auditLogs.push(log);
    // limit audit logs to last 1000
    if (db.auditLogs.length > 1000) {
      db.auditLogs.shift();
    }
    await this.save();
    return log;
  }

  // Passbook operations
  async getPassbooks(tenantId: string): Promise<Passbook[]> {
    const db = await this.load();
    if (!db.passbooks) db.passbooks = [];
    return db.passbooks.filter(p => p.tenantId === tenantId);
  }

  async savePassbook(pb: Passbook): Promise<Passbook> {
    const db = await this.load();
    if (!db.passbooks) db.passbooks = [];
    const idx = db.passbooks.findIndex(p => p.id === pb.id);
    if (idx >= 0) db.passbooks[idx] = pb;
    else db.passbooks.push(pb);
    await this.save();
    return pb;
  }

  async getPassbookPrintLines(tenantId: string): Promise<PassbookPrintLine[]> {
    const db = await this.load();
    if (!db.passbookPrintLines) db.passbookPrintLines = [];
    return db.passbookPrintLines.filter(l => l.tenantId === tenantId);
  }

  async savePassbookPrintLine(line: PassbookPrintLine): Promise<PassbookPrintLine> {
    const db = await this.load();
    if (!db.passbookPrintLines) db.passbookPrintLines = [];
    const idx = db.passbookPrintLines.findIndex(l => l.id === line.id);
    if (idx >= 0) db.passbookPrintLines[idx] = line;
    else db.passbookPrintLines.push(line);
    await this.save();
    return line;
  }

  async clearPassbookPrintLines(passbookId: string): Promise<void> {
    const db = await this.load();
    db.passbookPrintLines = db.passbookPrintLines.filter(l => l.passbookId !== passbookId);
    const pb = db.passbooks.find(p => p.id === passbookId);
    if (pb) {
      delete pb.lastPrintedTxId;
      delete pb.lastPrintedDate;
    }
    await this.save();
  }

  // Expense Operations
  async getExpenseCategories(tenantId: string): Promise<ExpenseCategory[]> {
    const db = await this.load();
    if (!db.expenseCategories) db.expenseCategories = [];
    return db.expenseCategories.filter(ec => ec.tenantId === tenantId);
  }

  async saveExpenseCategory(ec: ExpenseCategory): Promise<ExpenseCategory> {
    const db = await this.load();
    if (!db.expenseCategories) db.expenseCategories = [];
    const idx = db.expenseCategories.findIndex(e => e.id === ec.id);
    if (idx >= 0) db.expenseCategories[idx] = ec;
    else db.expenseCategories.push(ec);
    await this.save();
    return ec;
  }

  async getExpenses(tenantId: string): Promise<Expense[]> {
    const db = await this.load();
    if (!db.expenses) db.expenses = [];
    return db.expenses.filter(e => e.tenantId === tenantId);
  }

  async saveExpense(ex: Expense): Promise<Expense> {
    const db = await this.load();
    if (!db.expenses) db.expenses = [];
    const idx = db.expenses.findIndex(e => e.id === ex.id);
    if (idx >= 0) db.expenses[idx] = ex;
    else db.expenses.push(ex);
    await this.save();
    return ex;
  }

  // Backup & Restore
  async exportDb(): Promise<DbSchema> {
    return await this.load();
  }

  async importDb(newDb: DbSchema): Promise<void> {
    this.data = newDb;
    await this.save();
  }
}

export const dbStore = new DbStore();
