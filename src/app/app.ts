/* eslint-disable @typescript-eslint/no-explicit-any */
import { ChangeDetectionStrategy, Component, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ApiService, Member, Transaction, Loan, Installment, Welfare, Meeting, Document, FundSettings } from './services/api';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-root',
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  api = inject(ApiService);
  fb = inject(FormBuilder);

  currentYear = new Date().getFullYear();
  thaiTodayDate = new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });

  // UI States
  activeTab = signal<string>('dashboard');
  largeFontMode = signal<boolean>(false);
  speechAssist = signal<boolean>(false);
  
  // RBAC Roles demonstrating permission gates
  activeRole = signal<'president' | 'treasurer' | 'secretary' | 'member'>('treasurer');
  
  // Search query for members
  memberSearchQuery = signal<string>('');
  selectedMemberIdForQr = signal<string | null>(null);
  selectedMemberForQr = computed(() => {
    const qrId = this.selectedMemberIdForQr();
    if (!qrId) return null;
    return this.api.members().find(m => m.id === qrId) || null;
  });

  // Special members management sub-tab & state
  memberSubTab = signal<'all' | 'special'>('all');
  specialMembers = computed(() => {
    return this.api.members().filter(m => m.isSpecial);
  });

  // Multi-Fund Modal State
  showNewFundModal = signal<boolean>(false);

  // Receipt & Certificate Print Modals
  receiptToPrint = signal<any | null>(null);
  certToPrint = signal<any | null>(null);

  // AI Assistant Panel State
  aiOpen = signal<boolean>(false);
  aiLoading = signal<boolean>(false);
  aiChatInput = signal<string>('');
  aiChatMessages = signal<{ sender: 'user' | 'ai'; text: string; timestamp: string }[]>([
    {
      sender: 'ai',
      text: 'สวัสดีค่ะ! ดิฉันคือ **AI ผู้ช่วยอัจฉริยะกองทุนสัจจะ** ยินดีต้อนรับคณะกรรมการและสมาชิกทุกท่านค่ะ มีอะไรให้ช่วยวิเคราะห์หรือร่างเอกสารวันนี้ไหมคะ?',
      timestamp: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  // Form Groups
  memberForm!: FormGroup;
  specialMemberForm!: FormGroup;
  transactionForm!: FormGroup;
  loanForm!: FormGroup;
  repaymentForm!: FormGroup;
  welfareForm!: FormGroup;
  meetingForm!: FormGroup;
  docForm!: FormGroup;
  settingsForm!: FormGroup;
  tenantForm!: FormGroup;

  // Search filter computed members
  filteredMembers = computed(() => {
    const query = this.memberSearchQuery().toLowerCase().trim();
    if (!query) return this.api.members();
    return this.api.members().filter(m => 
      m.name.toLowerCase().includes(query) || 
      m.memberCode.toLowerCase().includes(query) || 
      m.idCard.includes(query) || 
      m.phone.includes(query)
    );
  });

  // Recent transactions computed
  recentTransactions = computed(() => {
    return [...this.api.transactions()].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  });

  // Active/Outstanding loans computed
  activeLoans = computed(() => {
    return this.api.loans().filter(l => l.status === 'active' || l.status === 'overdue');
  });

  // Selected member for detail view inside transaction forms
  selectedMemberForTx = signal<Member | null>(null);

  constructor() {
    this.initForms();

    // Side effect to read aloud tab change if Speech Assist is active
    effect(() => {
      const tab = this.activeTab();
      const isVoice = this.speechAssist();
      if (isVoice) {
        let text = '';
        if (tab === 'dashboard') text = 'กำลังแสดง หน้าหลักและสรุปรายงานกองทุน';
        else if (tab === 'members') text = 'กำลังแสดง เมนูจัดการรายชื่อสมาชิกชุมชน';
        else if (tab === 'savings') text = 'กำลังแสดง เมนูฝากเงิน ถอนเงิน และซื้อหุ้นสะสม';
        else if (tab === 'loans') text = 'กำลังแสดง เมนูสัญญากู้ยืมและผ่อนชำระหนี้';
        else if (tab === 'welfare') text = 'กำลังแสดง เมนูสวัสดิการชุมชนและเบิกค่าพยาบาล';
        else if (tab === 'meetings') text = 'กำลังแสดง เมนูประชุมและจัดเก็บจดหมายราชการ';
        else if (tab === 'settings') text = 'กำลังแสดง เมนูตั้งค่าระเบียบและข้อกำหนดกองทุน';
        this.speak(text);
      }
    });

    // Auto update forms when setting signals load
    effect(() => {
      const currentSettings = this.api.settings();
      if (currentSettings && this.settingsForm) {
        this.settingsForm.patchValue({
          sharePrice: currentSettings.sharePrice,
          interestRateDeposit: currentSettings.interestRateDeposit,
          interestRateLoan: currentSettings.interestRateLoan,
          maxLoanAmount: currentSettings.maxLoanAmount,
          minGuarantors: currentSettings.minGuarantors,
        });
      }
    });
  }

  initForms() {
    this.memberForm = this.fb.group({
      id: [''],
      memberCode: ['', Validators.required],
      title: ['นาย', Validators.required],
      name: ['', Validators.required],
      idCard: ['', [Validators.required, Validators.pattern(/^\d{13}$/)]],
      phone: ['', Validators.required],
      birthdate: ['', Validators.required],
      address: ['', Validators.required],
      joinDate: [new Date().toISOString().substring(0, 10)],
      status: ['active', Validators.required]
    });

    this.specialMemberForm = this.fb.group({
      memberId: ['', Validators.required],
      specialRole: ['committee', Validators.required],
      authorityNotes: [''],
      approveLoans: [false],
      approveWelfare: [false],
      manageSettings: [false],
      viewAuditLogs: [false]
    });

    this.transactionForm = this.fb.group({
      memberId: ['', Validators.required],
      type: ['deposit', Validators.required],
      amount: [0, [Validators.required, Validators.min(1)]],
      receiptNo: ['RC-' + Date.now().toString().substring(6)],
      notes: ['']
    });

    this.loanForm = this.fb.group({
      memberId: ['', Validators.required],
      principal: [10000, [Validators.required, Validators.min(1000)]],
      interestRate: [6, [Validators.required, Validators.min(0)]],
      durationMonths: [12, [Validators.required, Validators.min(1)]],
      startDate: [new Date().toISOString().substring(0, 10)],
      guarantor1Id: ['', Validators.required],
      guarantor2Id: ['']
    });

    this.repaymentForm = this.fb.group({
      loanId: ['', Validators.required],
      amountPaid: [0, [Validators.required, Validators.min(1)]]
    });

    this.welfareForm = this.fb.group({
      memberId: ['', Validators.required],
      type: ['medical', Validators.required],
      amount: [1000, [Validators.required, Validators.min(100)]],
      notes: ['', Validators.required]
    });

    this.meetingForm = this.fb.group({
      title: ['', Validators.required],
      date: [new Date().toISOString().substring(0, 10), Validators.required],
      attendeesCount: [10, [Validators.required, Validators.min(1)]],
      minutes: ['', Validators.required]
    });

    this.docForm = this.fb.group({
      type: ['in', Validators.required],
      docNo: ['', Validators.required],
      title: ['', Validators.required],
      date: [new Date().toISOString().substring(0, 10), Validators.required],
      sender: ['', Validators.required],
      receiver: ['', Validators.required],
      content: ['', Validators.required]
    });

    this.tenantForm = this.fb.group({
      name: ['', Validators.required],
      code: ['', Validators.required],
      village: ['', Validators.required],
      subdistrict: ['', Validators.required],
      district: ['', Validators.required],
      province: ['', Validators.required]
    });

    // Watch member selection in TransactionForm to autofill or validate
    this.transactionForm.get('memberId')?.valueChanges.subscribe(id => {
      const m = this.api.members().find(member => member.id === id);
      this.selectedMemberForTx.set(m || null);
    });
  }

  // Text-To-Speech Assistive Voice function in Thai
  speak(text: string) {
    if ('speechSynthesis' in window) {
      // Remove Markdown tags for cleaner reading
      const cleanText = text.replace(/[*#`_-]/g, '');
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = 'th-TH';
      utterance.rate = 1.0;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    }
  }

  toggleSpeechAssist() {
    this.speechAssist.update(v => !v);
    if (this.speechAssist()) {
      this.speak("เปิดโหมดผู้ช่วยเหลือด้านเสียงเสร็จสิ้น ยินดีต้อนรับสู่ระบบกองทุนสัจจะอัจฉริยะค่ะ");
    } else {
      window.speechSynthesis.cancel();
    }
  }

  // Actions
  async switchTenant(id: string) {
    await this.api.switchTenant(id);
    this.memberForm.patchValue({
      memberCode: 'M' + String(this.api.members().length + 1).padStart(3, '0')
    });
  }

  // Create New Fund (Multi-Tenant)
  async onSubmitTenant() {
    if (this.tenantForm.invalid) return;
    const { name, code, village, subdistrict, district, province } = this.tenantForm.value;
    await this.api.createTenant(name, code, village, subdistrict, district, province);
    this.tenantForm.reset();
    this.showNewFundModal.set(false);
    if (this.speechAssist()) this.speak("สร้างกองทุนสัจจะและสวัสดิการชุมชนแห่งใหม่สำเร็จแล้วค่ะ");
  }

  // Save/Edit Member
  async onSubmitMember() {
    if (this.memberForm.invalid) return;
    const formVal = this.memberForm.value;
    const existing = formVal.id ? this.api.members().find(m => m.id === formVal.id) : null;
    
    const memberObj: Member = {
      id: formVal.id || 'm-' + Date.now(),
      tenantId: this.api.selectedTenantId(),
      memberCode: formVal.memberCode,
      title: formVal.title,
      name: formVal.name,
      idCard: formVal.idCard,
      phone: formVal.phone,
      birthdate: formVal.birthdate,
      address: formVal.address,
      joinDate: formVal.joinDate,
      status: formVal.status,
      depositBalance: existing ? (existing.depositBalance || 0) : 0,
      shareCount: existing ? (existing.shareCount || 0) : 0,
      loanCount: existing ? (existing.loanCount || 0) : 0,
      isSpecial: existing ? existing.isSpecial : false,
      specialRole: existing ? existing.specialRole : 'none',
      authorityNotes: existing ? existing.authorityNotes : '',
      authorizedActions: existing ? existing.authorizedActions : []
    };

    await this.api.saveMember(memberObj);
    this.memberForm.reset({
      title: 'นาย',
      status: 'active',
      joinDate: new Date().toISOString().substring(0, 10),
      memberCode: 'M' + String(this.api.members().length + 1).padStart(3, '0')
    });
    if (this.speechAssist()) this.speak("บันทึกข้อมูลสมาชิกท่านใหม่ เรียบร้อยค่ะ");
  }

  editMember(m: Member) {
    this.memberForm.patchValue({
      id: m.id,
      memberCode: m.memberCode,
      title: m.title,
      name: m.name,
      idCard: m.idCard,
      phone: m.phone,
      birthdate: m.birthdate,
      address: m.address,
      joinDate: m.joinDate,
      status: m.status
    });
  }

  resetMemberForm() {
    this.memberForm.reset({
      title: 'นาย',
      status: 'active',
      joinDate: new Date().toISOString().substring(0, 10),
      memberCode: 'M' + String(this.api.members().length + 1).padStart(3, '0')
    });
  }

  async deleteMember(id: string) {
    if (confirm('คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลสมาชิกท่านนี้?')) {
      await this.api.deleteMember(id);
      if (this.speechAssist()) this.speak("ลบรายชื่อสมาชิกออกจากระบบ เรียบร้อยค่ะ");
    }
  }

  // Save Special Member / Appoint Committee
  async onAppointSpecialMember() {
    if (this.specialMemberForm.invalid) return;
    const formVal = this.specialMemberForm.value;
    const m = this.api.members().find(member => member.id === formVal.memberId);
    if (!m) return;

    const authorizedActions: string[] = [];
    if (formVal.approveLoans) authorizedActions.push('approve_loans');
    if (formVal.approveWelfare) authorizedActions.push('approve_welfare');
    if (formVal.manageSettings) authorizedActions.push('manage_settings');
    if (formVal.viewAuditLogs) authorizedActions.push('view_audit_logs');

    const updatedMember: Member = {
      ...m,
      isSpecial: true,
      specialRole: formVal.specialRole,
      authorityNotes: formVal.authorityNotes || '',
      authorizedActions
    };

    await this.api.saveMember(updatedMember);
    
    const roleNameMap: Record<string, string> = {
      president: 'ประธานกองทุน',
      treasurer: 'เหรัญญิกกองทุน',
      secretary: 'เลขานุการ',
      auditor: 'ผู้ตรวจสอบกองทุน',
      committee: 'กรรมการทั่วไป'
    };
    
    if (this.speechAssist()) {
      this.speak(`แต่งตั้งคุณ ${m.name} เป็น ${roleNameMap[formVal.specialRole]} เรียบร้อยค่ะ`);
    }

    this.specialMemberForm.reset({
      specialRole: 'committee',
      approveLoans: false,
      approveWelfare: false,
      manageSettings: false,
      viewAuditLogs: false
    });
  }

  // Revoke Special Member authority
  async onRevokeSpecialMember(m: Member) {
    if (!confirm(`คุณแน่ใจหรือไม่ว่าต้องการเพิกถอนอำนาจการจัดการของ ${m.title}${m.name}?`)) return;
    
    const updatedMember: Member = {
      ...m,
      isSpecial: false,
      specialRole: 'none',
      authorityNotes: '',
      authorizedActions: []
    };

    await this.api.saveMember(updatedMember);
    if (this.speechAssist()) this.speak(`เพิกถอนสิทธิ์อำนาจการจัดการของ คุณ ${m.name} เรียบร้อยค่ะ`);
  }

  // Quick select/act as Special Member
  actAsSpecialMember(m: Member) {
    let roleToSet: 'president' | 'treasurer' | 'secretary' | 'member' = 'member';
    if (m.specialRole === 'president') roleToSet = 'president';
    else if (m.specialRole === 'treasurer') roleToSet = 'treasurer';
    else if (m.specialRole === 'secretary') roleToSet = 'secretary';
    else roleToSet = 'treasurer'; // Default to treasurer for general committee with management authority

    this.activeRole.set(roleToSet);
    alert(`สลับบทบาทการควบคุมระบบไปยัง: ${m.title}${m.name} (${m.specialRole === 'president' ? 'ประธาน' : m.specialRole === 'treasurer' ? 'เหรัญญิก' : 'กรรมการ'}) แล้ว`);
    if (this.speechAssist()) {
      this.speak(`สลับบทบาทไปยังผู้จัดการ คุณ ${m.name} แล้วค่ะ`);
    }
  }

  // Get Thai name for role
  getRoleThaiName(role?: string): string {
    if (!role) return 'สมาชิกทั่วไป';
    const mapping: Record<string, string> = {
      president: '👑 ประธานกองทุน',
      treasurer: '💰 เหรัญญิกกองทุน',
      secretary: '📝 เลขานุการ',
      auditor: '🔍 ผู้ตรวจสอบกองทุน',
      committee: '👥 กรรมการทั่วไป',
      none: 'สมาชิกทั่วไป'
    };
    return mapping[role] || 'สมาชิกทั่วไป';
  }

  // Submit Savings/Share transaction
  async onSubmitTransaction() {
    if (this.transactionForm.invalid) return;
    const formVal = this.transactionForm.value;
    const member = this.api.members().find(m => m.id === formVal.memberId);
    if (!member) return;

    // Check withdrawal balance
    if (formVal.type === 'withdrawal' && member.depositBalance < formVal.amount) {
      alert('ล้มเหลว: ยอดเงินฝากสัจจะคงเหลือไม่เพียงพอสำหรับการถอนในครั้งนี้');
      return;
    }

    const tx: Transaction = {
      id: 'tx-' + Date.now(),
      tenantId: this.api.selectedTenantId(),
      memberId: member.id,
      memberName: member.name,
      memberCode: member.memberCode,
      type: formVal.type,
      amount: formVal.amount,
      date: new Date().toISOString(),
      receiptNo: formVal.receiptNo,
      notes: formVal.notes || '',
      createdBy: this.activeRole() === 'treasurer' ? 'เหรัญญิกกองทุน' : 'ผู้ดูแลระบบ'
    };

    await this.api.saveTransaction(tx);
    
    // Receipt popup preview
    this.receiptToPrint.set({
      title: tx.type === 'deposit' ? 'ใบเสร็จรับเงินฝากสัจจะประจำเดือน' : tx.type === 'share_buy' ? 'ใบเสร็จซื้อหุ้นสะสมเพิ่ม' : 'ใบเสร็จสำคัญถอนเงินสัจจะ',
      receiptNo: tx.receiptNo,
      date: tx.date,
      memberName: tx.memberName,
      memberCode: tx.memberCode,
      amount: tx.amount,
      type: tx.type,
      createdBy: tx.createdBy,
      notes: tx.notes
    });

    this.transactionForm.reset({
      type: 'deposit',
      amount: 0,
      receiptNo: 'RC-' + Date.now().toString().substring(6)
    });
    
    if (this.speechAssist()) this.speak("บันทึกรายการบัญชีและสร้างใบรับเงินสำเร็จแล้วค่ะ");
  }

  // Submit Loan Agreement
  async onSubmitLoan() {
    if (this.loanForm.invalid) return;
    const formVal = this.loanForm.value;
    const borrower = this.api.members().find(m => m.id === formVal.memberId);
    const g1 = this.api.members().find(m => m.id === formVal.guarantor1Id);
    const g2 = this.api.members().find(m => m.id === formVal.guarantor2Id);

    if (!borrower || !g1) return;

    if (borrower.id === g1.id || (g2 && borrower.id === g2.id)) {
      alert('ล้มเหลว: ผู้กู้ไม่สามารถค้ำประกันตนเองได้');
      return;
    }

    // Verify limit rules
    const maxLimit = this.api.settings()?.maxLoanAmount || 100000;
    if (formVal.principal > maxLimit) {
      alert(`ล้มเหลว: วงเงินกู้สูงเกินข้อระเบียบล่าสุดของกองทุน (สูงสุดไม่เกิน ${maxLimit.toLocaleString()} บาท)`);
      return;
    }

    // Calculate monthly installment with simplified flat interest
    const principal = formVal.principal;
    const r = formVal.interestRate / 100;
    const months = formVal.durationMonths;
    const totalInterest = principal * r * (months / 12);
    const monthlyPayment = Math.round((principal + totalInterest) / months);

    const loanObj: Loan = {
      id: 'LN-' + Date.now().toString().substring(6),
      tenantId: this.api.selectedTenantId(),
      memberId: borrower.id,
      memberName: borrower.name,
      memberCode: borrower.memberCode,
      principal,
      interestRate: formVal.interestRate,
      durationMonths: months,
      startDate: formVal.startDate,
      status: 'active',
      guarantorIds: g2 ? [g1.id, g2.id] : [g1.id],
      guarantorNames: g2 ? [g1.name, g2.name] : [g1.name],
      monthlyPayment,
      remainingBalance: principal
    };

    // Save loan
    await this.api.saveLoan(loanObj);

    // Save transaction for cash out
    const tx: Transaction = {
      id: 'tx-' + Date.now(),
      tenantId: this.api.selectedTenantId(),
      memberId: borrower.id,
      memberName: borrower.name,
      memberCode: borrower.memberCode,
      type: 'loan_disbursement',
      amount: principal,
      date: new Date().toISOString(),
      receiptNo: 'DISB-' + loanObj.id,
      notes: `เบิกจ่ายเงินกู้ตามสัญญาเลขที่ ${loanObj.id}`,
      createdBy: 'ประธานกรรมการ'
    };
    await this.api.saveTransaction(tx);

    this.loanForm.reset({
      principal: 10000,
      interestRate: this.api.settings()?.interestRateLoan || 6,
      durationMonths: 12,
      startDate: new Date().toISOString().substring(0, 10)
    });

    if (this.speechAssist()) this.speak("บันทึกสัญญากู้อัจฉริยะและสั่งจ่ายเงินทุนเวียน เรียบร้อยค่ะ");
  }

  // Repay Loan Installment
  async payInstallment(loan: Loan, amount: number) {
    if (!amount || amount <= 0) return;

    // Split flat payment into roughly 90% principal, 10% interest for simulation
    const interestRatio = (loan.interestRate / 100) / 12;
    const calculatedInterest = Math.min(amount, Math.round(loan.remainingBalance * interestRatio * 12));
    const principalPaid = Math.min(loan.remainingBalance, amount - calculatedInterest);

    const inst: Installment = {
      id: 'inst-' + Date.now(),
      loanId: loan.id,
      tenantId: this.api.selectedTenantId(),
      memberId: loan.memberId,
      memberName: loan.memberName,
      amountPaid: amount,
      principalPaid,
      interestPaid: calculatedInterest,
      date: new Date().toISOString(),
      receiptNo: 'REP-' + Date.now().toString().substring(6)
    };

    await this.api.saveInstallment(inst);

    // Also record transaction entry
    const tx: Transaction = {
      id: 'tx-' + Date.now(),
      tenantId: this.api.selectedTenantId(),
      memberId: loan.memberId,
      memberName: loan.memberName,
      memberCode: loan.memberCode,
      type: 'loan_payment',
      amount: amount,
      date: new Date().toISOString(),
      receiptNo: inst.receiptNo,
      notes: `ชำระหนี้สัญญา ${loan.id} (เงินต้น ${principalPaid.toLocaleString()} ดอกเบี้ย ${calculatedInterest.toLocaleString()})`,
      createdBy: 'เหรัญญิกกองทุน'
    };
    await this.api.saveTransaction(tx);

    // Receipt print popup
    this.receiptToPrint.set({
      title: 'ใบเสร็จชำระเงินกู้และดอกเบี้ยสัจจะ',
      receiptNo: inst.receiptNo,
      date: inst.date,
      memberName: loan.memberName,
      memberCode: loan.memberCode,
      amount: amount,
      type: 'loan_payment',
      createdBy: 'เหรัญญิกกองทุน',
      notes: `ชำระค่างวดสัญญากู้ ${loan.id} คงเหลือเงินต้นค้างชำระ ${Math.max(0, loan.remainingBalance - principalPaid).toLocaleString()} บาท`
    });

    if (this.speechAssist()) this.speak("บันทึกรับเงินผ่อนชำระหนี้ เรียบร้อยค่ะ");
  }

  // Submit Welfare Benefit claim
  async onSubmitWelfare() {
    if (this.welfareForm.invalid) return;
    const formVal = this.welfareForm.value;
    const m = this.api.members().find(member => member.id === formVal.memberId);
    if (!m) return;

    const rule = this.api.settings()?.welfareRules.find(r => r.type === formVal.type);
    const allowedAmount = rule?.amount || formVal.amount;

    const wfObj: Welfare = {
      id: 'wf-' + Date.now(),
      tenantId: this.api.selectedTenantId(),
      memberId: m.id,
      memberName: m.name,
      memberCode: m.memberCode,
      type: formVal.type,
      amount: allowedAmount,
      requestDate: new Date().toISOString().substring(0, 10),
      status: 'approved', // Auto-approves for convenience in dashboard testing
      approveDate: new Date().toISOString().substring(0, 10),
      notes: formVal.notes
    };

    await this.api.saveWelfare(wfObj);

    // Record cash out transaction
    const tx: Transaction = {
      id: 'tx-' + Date.now(),
      tenantId: this.api.selectedTenantId(),
      memberId: m.id,
      memberName: m.name,
      memberCode: m.memberCode,
      type: 'welfare_payout',
      amount: allowedAmount,
      date: new Date().toISOString(),
      receiptNo: 'WF-PAY-' + wfObj.id,
      notes: `เบิกจ่ายงบสวัสดิการชุมชน ประเภท: ${rule?.name || wfObj.type}`,
      createdBy: 'ประธานกรรมการสวัสดิการ'
    };
    await this.api.saveTransaction(tx);

    this.welfareForm.reset({
      type: 'medical',
      amount: 1000
    });

    if (this.speechAssist()) this.speak("จัดทำเอกสารเบิกจ่ายสวัสดิการเกื้อกูลผู้สูงอายุหรือรักษาพยาบาล เรียบร้อยค่ะ");
  }

  // Meetings
  async onSubmitMeeting() {
    if (this.meetingForm.invalid) return;
    const formVal = this.meetingForm.value;

    const mt: Meeting = {
      id: 'mt-' + Date.now(),
      tenantId: this.api.selectedTenantId(),
      title: formVal.title,
      date: formVal.date,
      attendeesCount: formVal.attendeesCount,
      minutes: formVal.minutes,
      resolutions: ['ที่ประชุมรับรองรายงานและเห็นพ้องด้านระเบียบปฏิทิน']
    };

    await this.api.saveMeeting(mt);
    this.meetingForm.reset({
      date: new Date().toISOString().substring(0, 10),
      attendeesCount: 10
    });
    if (this.speechAssist()) this.speak("บันทึกข้อมูลและระเบียบวาระรายงานประชุมเสร็จสิ้นค่ะ");
  }

  // Document Registry
  async onSubmitDoc() {
    if (this.docForm.invalid) return;
    const formVal = this.docForm.value;

    const doc: Document = {
      id: 'doc-' + Date.now(),
      tenantId: this.api.selectedTenantId(),
      type: formVal.type,
      docNo: formVal.docNo,
      title: formVal.title,
      date: formVal.date,
      sender: formVal.sender,
      receiver: formVal.receiver,
      content: formVal.content
    };

    await this.api.saveDocument(doc);
    this.docForm.reset({
      type: 'in',
      date: new Date().toISOString().substring(0, 10)
    });
    if (this.speechAssist()) this.speak("ลงทะเบียนจัดเก็บจดหมายเข้าออกของกองทุนแล้วค่ะ");
  }

  // Update Settings
  async onSaveSettings() {
    if (this.settingsForm.invalid || !this.api.settings()) return;
    const formVal = this.settingsForm.value;
    const current = this.api.settings()!;

    const updated: FundSettings = {
      tenantId: current.tenantId,
      sharePrice: formVal.sharePrice,
      interestRateDeposit: formVal.interestRateDeposit,
      interestRateLoan: formVal.interestRateLoan,
      maxLoanAmount: formVal.maxLoanAmount,
      minGuarantors: formVal.minGuarantors,
      welfareRules: current.welfareRules
    };

    await this.api.saveSettings(updated);
    alert('บันทึกการเปลี่ยนแปลงระเบียบกองทุนอัจฉริยะแล้ว ค่านโยบายการปล่อยกู้และดอกเบี้ยมีผลบังคับใช้ในระบบทันที');
    if (this.speechAssist()) this.speak("บันทึกนโยบายและระเบียบกองทุนฉบับปรับปรุงเสร็จสิ้นค่ะ");
  }

  // AI Actions Triggered from UI Buttons
  async onAiTrigger(actionType: string, contextObj?: any) {
    this.aiOpen.set(true);
    this.aiLoading.set(true);
    
    let label = '';
    if (actionType === 'summarize') label = 'ช่วยสรุปบันทึกการประชุมสามัญ';
    else if (actionType === 'analyze-finance') label = 'ช่วยวิเคราะห์กระแสการเงิน';
    else if (actionType === 'analyze-liquidity') label = 'ช่วยประเมินสภาพคล่องกองทุนและสำรองสวัสดิการ';
    else if (actionType === 'flag-anomalies') label = 'ตรวจสอบพฤติกรรมการกู้ยืมและค้ำประกันผิดปกติ';
    else if (actionType === 'draft-doc') label = 'ร่างหนังสือสวัสดิการอย่างเป็นทางการ';

    this.aiChatMessages.update(messages => [
      ...messages,
      { sender: 'user', text: label, timestamp: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) }
    ]);

    const result = await this.api.callAi(actionType, '', contextObj);
    
    this.aiChatMessages.update(messages => [
      ...messages,
      { sender: 'ai', text: result, timestamp: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) }
    ]);
    
    this.aiLoading.set(false);
    if (this.speechAssist()) this.speak("ผู้ช่วย AI ได้สรุปและจัดทำรายงานวิเคราะห์ให้เสร็จสมบูรณ์แล้วค่ะ");
  }

  // Interactive AI chat
  async sendAiChat() {
    const input = this.aiChatInput().trim();
    if (!input) return;

    this.aiChatMessages.update(messages => [
      ...messages,
      { sender: 'user', text: input, timestamp: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) }
    ]);
    this.aiChatInput.set('');
    this.aiLoading.set(true);

    const result = await this.api.callAi('chat', input);

    this.aiChatMessages.update(messages => [
      ...messages,
      { sender: 'ai', text: result, timestamp: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) }
    ]);
    this.aiLoading.set(false);

    if (this.speechAssist()) {
      // Read brief summary of AI chat response
      const brief = result.substring(0, 100) + "...";
      this.speak(brief);
    }
  }

  // AI Certificate Drawer
  async generateMemberCert(m: Member) {
    this.loadingCertId = m.id;
    const certText = await this.api.callAi('draft-doc', '', {
      memberName: m.name,
      idCard: m.idCard,
      depositBalance: m.depositBalance,
      shareCount: m.shareCount,
      memberCode: m.memberCode
    });
    this.certToPrint.set({
      memberName: m.name,
      content: certText
    });
    this.loadingCertId = '';
    if (this.speechAssist()) this.speak("ร่างหนังสือรับรองสัจจะของสมาชิกเสร็จแล้วค่ะ พร้อมสำหรับการพิมพ์รายงาน");
  }
  loadingCertId = '';

  // Simulation voice trigger
  simulateVoiceSearch() {
    const speechPrompts = [
      'ค้นหาสมาชิกชื่อ สมศักดิ์',
      'วิเคราะห์รายรับรายจ่ายล่าสุด',
      'สรุปการประชุมประจำปี',
      'ช่วยร่างหนังสือรับรอง นายสมศักดิ์ รักดี',
      'สภาพคล่องการค้ำประกันปลอดภัยไหม'
    ];
    const randPrompt = speechPrompts[Math.floor(Math.random() * speechPrompts.length)];
    
    if (this.speechAssist()) this.speak(`ค้นหาด้วยเสียงพบลำดับประโยค: "${randPrompt}" กำลังเรียกประมวลผลด่วนค่ะ`);
    
    if (randPrompt.startsWith('ค้นหา')) {
      const name = randPrompt.split('ชื่อ ')[1] || 'สมศักดิ์';
      this.memberSearchQuery.set(name);
      this.activeTab.set('members');
    } else if (randPrompt.includes('วิเคราะห์')) {
      this.onAiTrigger('analyze-finance');
    } else if (randPrompt.includes('สภาพคล่อง')) {
      this.onAiTrigger('analyze-liquidity');
    } else {
      this.aiChatInput.set(randPrompt);
      this.aiOpen.set(true);
      this.sendAiChat();
    }
  }

  // Backup file upload handler
  onBackupFileSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e: any) => {
      try {
        const json = JSON.parse(e.target.result);
        await this.api.restoreBackup(json);
        alert('กู้คืนสำรองระบบฐานข้อมูลกองทุนสัจจะและสวัสดิการชุมชนสำเร็จสมบูรณ์!');
        if (this.speechAssist()) this.speak("กู้คืนข้อมูลสำรองจากแหล่งเก็บข้อมูล เรียบร้อยค่ะ");
      } catch (err: any) {
        alert('ล้มเหลวในการอ่านไฟล์สำรอง: ' + err.message);
      }
    };
    reader.readAsText(file);
  }

  // Trigger browser print
  printCurrentElement() {
    window.print();
  }

  // Download DB directly
  downloadBackupUrl() {
    window.open('/api/backup/download', '_blank');
  }
}
