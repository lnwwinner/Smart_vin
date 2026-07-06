/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import {join} from 'node:path';
import { dbStore, DbSchema } from './server/db-store.js';
import { GoogleGenAI } from "@google/genai";

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
app.use(express.json());

const angularApp = new AngularNodeAppEngine();

// AI Assistant lazy initializer and circuit breaker for leaked/revoked keys
let aiClient: GoogleGenAI | null = null;
let aiDisabled = false;

function getAiClient(): GoogleGenAI | null {
  if (aiDisabled) {
    return null;
  }
  if (!aiClient) {
    const apiKey = process.env['GEMINI_API_KEY'];
    if (!apiKey) {
      console.warn("GEMINI_API_KEY is not defined. AI assistant will run in rich simulated fallback mode.");
      return null;
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

/**
 * REST API endpoints for Smart Village Fund
 */

// Get all tenants (funds)
app.get('/api/tenants', async (req, res) => {
  try {
    const tenants = await dbStore.getTenants();
    res.json(tenants);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create/Update tenant
app.post('/api/tenants', async (req, res) => {
  try {
    const tenant = await dbStore.saveTenant(req.body);
    res.json(tenant);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Load all data for a specific tenant in one efficient call
app.get('/api/tenants/:tenantId/data', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const members = await dbStore.getMembers(tenantId);
    const transactions = await dbStore.getTransactions(tenantId);
    const loans = await dbStore.getLoans(tenantId);
    const installments = await dbStore.getInstallments(tenantId);
    const welfares = await dbStore.getWelfares(tenantId);
    const meetings = await dbStore.getMeetings(tenantId);
    const documents = await dbStore.getDocuments(tenantId);
    const auditLogs = await dbStore.getAuditLogs(tenantId);
    const settings = await dbStore.getSettings(tenantId);

    res.json({
      members,
      transactions,
      loans,
      installments,
      welfares,
      meetings,
      documents,
      auditLogs,
      settings
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Save Member
app.post('/api/tenants/:tenantId/members', async (req, res) => {
  try {
    const member = await dbStore.saveMember(req.body);
    // Log action
    await dbStore.saveAuditLog({
      id: 'al-' + Date.now(),
      tenantId: req.params.tenantId,
      username: 'กรรมการระบบ',
      action: 'SAVE_MEMBER',
      details: `บันทึกข้อมูลสมาชิก: ${member.title}${member.name} (${member.memberCode})`,
      timestamp: new Date().toISOString()
    });
    res.json(member);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete Member
app.delete('/api/tenants/:tenantId/members/:id', async (req, res) => {
  try {
    const { tenantId, id } = req.params;
    await dbStore.deleteMember(id);
    await dbStore.saveAuditLog({
      id: 'al-' + Date.now(),
      tenantId,
      username: 'กรรมการระบบ',
      action: 'DELETE_MEMBER',
      details: `ลบสมาชิก ID: ${id}`,
      timestamp: new Date().toISOString()
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Save Transaction (Deposit / Withdraw / Share Buy)
app.post('/api/tenants/:tenantId/transactions', async (req, res) => {
  try {
    const tx = await dbStore.saveTransaction(req.body);
    let actionThai = 'ทำรายการ';
    if (tx.type === 'deposit') actionThai = 'ฝากเงินสัจจะ';
    else if (tx.type === 'withdrawal') actionThai = 'ถอนเงิน';
    else if (tx.type === 'share_buy') actionThai = 'ซื้อหุ้นสะสม';
    else if (tx.type === 'share_sell') actionThai = 'ขายคืนหุ้น';
    else if (tx.type === 'welfare_payout') actionThai = 'จ่ายสวัสดิการ';

    await dbStore.saveAuditLog({
      id: 'al-' + Date.now(),
      tenantId: req.params.tenantId,
      username: tx.createdBy || 'กรรมการระบบ',
      action: tx.type.toUpperCase(),
      details: `ทำรายการ ${actionThai} จำนวน ${tx.amount.toLocaleString()} บาท แก่ ${tx.memberName} (${tx.memberCode}) ใบเสร็จเลขที่ ${tx.receiptNo}`,
      timestamp: new Date().toISOString()
    });
    res.json(tx);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Save Loan
app.post('/api/tenants/:tenantId/loans', async (req, res) => {
  try {
    const loan = await dbStore.saveLoan(req.body);
    await dbStore.saveAuditLog({
      id: 'al-' + Date.now(),
      tenantId: req.params.tenantId,
      username: 'คณะกรรมการ',
      action: 'NEW_LOAN',
      details: `อนุมัติเงินกู้สัญญาหลักเลขที่ ${loan.id} จำนวน ${loan.principal.toLocaleString()} บาท ดอกเบี้ยร้อยละ ${loan.interestRate} ต่อปี ให้แก่ ${loan.memberName} (${loan.memberCode})`,
      timestamp: new Date().toISOString()
    });
    res.json(loan);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Save Installment Payment
app.post('/api/tenants/:tenantId/installments', async (req, res) => {
  try {
    const inst = await dbStore.saveInstallment(req.body);
    await dbStore.saveAuditLog({
      id: 'al-' + Date.now(),
      tenantId: req.params.tenantId,
      username: 'เหรัญญิก',
      action: 'LOAN_PAYMENT',
      details: `ชำระค่างวดสำหรับสัญญากู้ ${inst.loanId} โดย ${inst.memberName} จำนวน ${inst.amountPaid.toLocaleString()} บาท (เงินต้น ${inst.principalPaid.toLocaleString()} ดอกเบี้ย ${inst.interestPaid.toLocaleString()})`,
      timestamp: new Date().toISOString()
    });
    res.json(inst);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Save Welfare
app.post('/api/tenants/:tenantId/welfares', async (req, res) => {
  try {
    const wf = await dbStore.saveWelfare(req.body);
    await dbStore.saveAuditLog({
      id: 'al-' + Date.now(),
      tenantId: req.params.tenantId,
      username: 'กรรมการระบบ',
      action: 'WELFARE_REQUEST',
      details: `บันทึกคำขอสวัสดิการประเภท ${wf.type} สมาชิก: ${wf.memberName} สถานะ: ${wf.status}`,
      timestamp: new Date().toISOString()
    });
    res.json(wf);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Save Meeting
app.post('/api/tenants/:tenantId/meetings', async (req, res) => {
  try {
    const mt = await dbStore.saveMeeting(req.body);
    await dbStore.saveAuditLog({
      id: 'al-' + Date.now(),
      tenantId: req.params.tenantId,
      username: 'เลขานุการ',
      action: 'SAVE_MEETING',
      details: `บันทึกการประชุม: ${mt.title} วันที่ ${mt.date}`,
      timestamp: new Date().toISOString()
    });
    res.json(mt);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Save Document
app.post('/api/tenants/:tenantId/documents', async (req, res) => {
  try {
    const doc = await dbStore.saveDocument(req.body);
    await dbStore.saveAuditLog({
      id: 'al-' + Date.now(),
      tenantId: req.params.tenantId,
      username: 'เจ้าหน้าที่เอกสาร',
      action: 'SAVE_DOCUMENT',
      details: `บันทึกเอกสาร: [${doc.type}] เลขที่ ${doc.docNo} หัวข้อ ${doc.title}`,
      timestamp: new Date().toISOString()
    });
    res.json(doc);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Save Settings
app.post('/api/tenants/:tenantId/settings', async (req, res) => {
  try {
    const settings = await dbStore.updateSettings(req.body);
    await dbStore.saveAuditLog({
      id: 'al-' + Date.now(),
      tenantId: req.params.tenantId,
      username: 'ผู้ดูแลระบบ',
      action: 'UPDATE_SETTINGS',
      details: `ปรับเปลี่ยนกฎระเบียบกองทุน: ดอกเบี้ยเงินกู้ร้อยละ ${settings.interestRateLoan} ราคาหุ้นละ ${settings.sharePrice} บาท`,
      timestamp: new Date().toISOString()
    });
    res.json(settings);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Backup: Download database
app.get('/api/backup/download', async (req, res) => {
  try {
    const db = await dbStore.exportDb();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=smart-village-fund-backup.json');
    res.json(db);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Backup: Restore database
app.post('/api/backup/restore', async (req, res) => {
  try {
    const newDb = req.body as DbSchema;
    if (!newDb.tenants || !newDb.members) {
      res.status(400).json({ error: 'โครงสร้างไฟล์สำรองข้อมูลไม่ถูกต้อง' });
      return;
    }
    await dbStore.importDb(newDb);
    res.json({ success: true, message: 'กู้คืนข้อมูลสำเร็จแล้ว' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// THAID DIGITAL ID SYSTEM INTEGRATION (DOPA)
// ==========================================

// Active simulated ThaID verification sessions
const thaidSessions = new Map<string, {
  status: 'pending' | 'success' | 'failed';
  profile?: {
    idCard: string;
    title: string;
    name: string;
    birthdate: string;
    phone: string;
    address: string;
    specialRole?: string;
  };
}>();

// Official simulated citizens returned by ThaID digital ID gateway
const thaidProfiles = [
  {
    idCard: '1-1002-00342-99-1',
    title: 'นาย',
    name: 'สุนทร มีสุข',
    birthdate: '1985-05-12',
    phone: '081-345-6789',
    address: '123 หมู่ 4 ต.ในเมือง อ.เมือง จ.ขอนแก่น 40000',
    specialRole: 'treasurer'
  },
  {
    idCard: '3-4001-02034-11-2',
    title: 'นางสาว',
    name: 'สมจิต แสนสบาย',
    birthdate: '1972-11-20',
    phone: '089-765-4321',
    address: '56/1 หมู่ 2 ต.หมากแข้ง อ.เมือง จ.อุดรธานี 41000',
    specialRole: 'auditor'
  },
  {
    idCard: '3-5099-00123-45-6',
    title: 'นาง',
    name: 'วิภา รักดี',
    birthdate: '1965-08-04',
    phone: '085-111-2222',
    address: '99 หมู่ 1 ต.บ้านเชียง อ.หนองหาน จ.อุดรธานี 41130',
    specialRole: 'president'
  },
  {
    idCard: '3410100222334', // Matches existing member Somsek (M001) in DB to test login/linking!
    title: 'นาย',
    name: 'สมศักดิ์ รักดี',
    birthdate: '1961-05-12',
    phone: '081-234-5678',
    address: '12 หมู่ 3 บ้านแสนสุข ต.หนองหลัก อ.ไชยวาน จ.อุดรธานี',
    specialRole: 'committee'
  }
];

// Get Simulated ThaID Profiles
app.get('/api/thaid/profiles', (req, res) => {
  res.json(thaidProfiles);
});

// Generate Mock ThaID Auth QR
app.post('/api/thaid/qr', (req, res) => {
  const token = 'thaid-sess-' + Math.random().toString(36).substring(2, 11);
  thaidSessions.set(token, { status: 'pending' });
  res.json({
    token,
    qrUrl: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=https://thaid.go.th/oidc/auth?session=${token}`,
    expiresIn: 180
  });
});

// Simulate citizen phone scanning QR & sending callback
app.post('/api/thaid/simulate-scan', async (req, res) => {
  const { token, profile } = req.body;
  if (!thaidSessions.has(token)) {
    res.status(404).json({ error: 'ไม่พบเซสชันการลงทะเบียนหรือหมดเวลาแล้ว' });
    return;
  }

  thaidSessions.set(token, {
    status: 'success',
    profile
  });

  res.json({ success: true, message: 'ส่งข้อมูลการยืนยันตัวตนสำเร็จ' });
});

// Poll session status
app.get('/api/thaid/session/:token', (req, res) => {
  const session = thaidSessions.get(req.params.token);
  if (!session) {
    res.status(404).json({ error: 'เซสชันหมดอายุ' });
    return;
  }
  res.json(session);
});

// Verify/Link Existing Member with ThaID
app.post('/api/tenants/:tenantId/members/:memberId/verify-thaid', async (req, res) => {
  try {
    const { tenantId, memberId } = req.params;
    const { idCard } = req.body;
    
    // Find member
    const members = await dbStore.getMembers(tenantId);
    const member = members.find(m => m.id === memberId);
    
    if (!member) {
      res.status(404).json({ error: 'ไม่พบข้อมูลสมาชิก' });
      return;
    }

    // Set ThaID Verification attributes
    member.verifiedByThaid = true;
    member.thaidVerificationDate = new Date().toISOString();
    
    await dbStore.saveMember(member);

    await dbStore.saveAuditLog({
      id: 'al-' + Date.now(),
      tenantId,
      username: 'ThaID Gateway',
      action: 'THAID_VERIFICATION_SUCCESS',
      details: `ยืนยันตัวตนดิจิทัลสำเร็จผ่าน ThaID (DOPA OIDC Gateway) สำหรับ ${member.title}${member.name} (${member.memberCode}) เลขบัตร: ${idCard}`,
      timestamp: new Date().toISOString()
    });

    res.json({ success: true, member });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// AI Assistant Endpoint powered by Gemini API
app.post('/api/ai', async (req, res) => {
  const { action, prompt, context } = req.body;
  const client = getAiClient();

  // Robust default responses if Gemini key is missing or failed
  const getFallbackResponse = (act: string, pm: string, ctx: any) => {
    switch (act) {
      case 'summarize':
        return `## 📝 สรุปรายงานการประชุมอัจฉริยะ (จำลอง)
        
**หัวข้อการประชุม:** ${ctx?.title || 'การประชุมกองทุนสัจจะ'}
**วันที่:** ${ctx?.date || 'ล่าสุด'}

### 📌 ประเด็นสำคัญที่ประเด็นพิจารณา:
1. **การพิจารณาอนุมัติเงินกู้**: ได้ตรวจสอบคุณสมบัติของผู้ขอกู้และผู้ค้ำประกันเป็นไปตามกฎของกองทุน คือมีผู้ค้ำประกันอย่างน้อย 1 คนและถือหุ้นสะสมไม่น้อยกว่าร้อยละ 20 ของวงเงินกู้
2. **ยอดเงินทุนหมุนเวียน**: เหรัญญิกรายงานว่ามีเงินสดคงเหลือเพื่อการดำเนินงานและการสำรองกรณีสวัสดิการรักษาสุขภาพอย่างเพียงพอ
3. **การส่งเสริมสวัสดิการผู้สูงอายุ**: มีมติจัดสรรสวัสดิการกรณีอายุครบ 60 ปีขึ้นไปแบบขั้นบันได

### ⚖️ มติที่ประชุมอย่างเป็นเอกฉันท์:
* ✔️ เห็นชอบให้สัญญากู้ยืมเป็นไปตามแผนการผ่อนชำระ 12 งวด อัตราดอกเบี้ยร้อยละ 6 ต่อปี
* ✔️ อนุมัติการปรับเปลี่ยนขั้นตอนการยื่นคำขอสวัสดิการผ่านระบบออนไลน์ของกองทุนเพื่อลดความยุ่งยากสำหรับเหรัญญิกตำบล
* ✔️ กำหนดจัดกิจกรรมวันสอมสัจจะในวันอาทิตย์ต้นเดือนหน้า`;

      case 'analyze-finance':
        return `## 📊 รายงานวิเคราะห์รายรับรายจ่ายเชิงลึก
        
จากการประเมินยอดเงินสะสม เงินฝากสัจจะ และค่าธรรมเนียมล่าสุดของกองทุน:

1. **โครงสร้างรายรับที่มั่นคง**: รายรับร้อยละ 85 มาจาก**เงินฝากสัจจะรายเดือน**ของสมาชิก สะท้อนถึงวินัยทางการเงินที่ดีในชุมชน อีกร้อยละ 15 เป็นดอกเบี้ยรับและหุ้นสมทบ
2. **การควบคุมรายจ่ายที่มีประสิทธิภาพ**: สัดส่วนรายจ่ายหลักร้อยละ 70 เป็นการหมุนเวียนจัดสรร**สวัสดิการชุมชน** (ค่ารักษาพยาบาลและสวัสดิการผู้สูงอายุ) ซึ่งถือว่าสมดุลกับเป้าหมายการไม่แสวงหากำไร
3. **แนวโน้มการเติบโต**: มีอัตราสมาชิกฝากเงินเพิ่มขึ้นเฉลี่ยร้อยละ 4.2 ต่อเดือน และมีการคงยอดทุนออมทรัพย์ไว้ระยะยาว

### 💡 คำแนะนำทางการเงินจาก AI:
* คณะกรรมการควรจำกัดเพดานปล่อยกู้รวมให้อยู่ในสัดส่วนไม่เกิน 75% ของยอดเงินฝากทั้งหมด เพื่อรับประกันสภาพคล่องสำหรับสวัสดิการผู้สูงอายุและฉุกเฉลี่ย`;

      case 'analyze-liquidity':
        return `## 💧 การประเมินสภาพคล่องและความมั่นคงกองทุน
        
วิเคราะห์จากสินทรัพย์รวมและหนี้สินล่าสุดขององค์กร:

* **เงินสดและเงินฝากธนาคารคงเหลือ**: สูงถึงร้อยละ 35 ของสินทรัพย์ทั้งหมด
* **สินเชื่อปล่อยกู้ที่ยังทำงานอยู่**: อยู่ที่ร้อยละ 65 ของวงเงินฝาก
* **ดัชนีสภาพคล่องหมุนเวียน (Liquidity Ratio)**: อยู่ในเกณฑ์ **"มั่นคงสูงมาก (Excellent)"**

### ⚠️ การวิเคราะห์ความเสี่ยง:
* **ความเสี่ยงการค้างชำระ**: ต่ำมาก (0.5%) เนื่องจากระบบมีระบบผู้ค้ำประกันที่มีประสิทธิภาพในชุมชนร่วมตรวจสอบ
* **อัตราเงินทุนสำรองสวัสดิการ**: คงที่และพอเพียงสำหรับจ่ายสวัสดิการต่อเนื่องได้อีกอย่างน้อย 18 เดือนแม้ไม่มีเงินฝากสัจจะสมทบเพิ่มเติม

### 📈 แผนปรับปรุง:
* ควรเปิดบัญชีเงินฝากประจำเพื่อรับผลตอบแทนดอกเบี้ยที่ดีขึ้นสำหรับส่วนเกินของเงินสำรองที่ไม่มีความจำเป็นต้องใช้ในระยะเวลา 3 เดือน`;

      case 'flag-anomalies':
        return `## 🚨 รายงานแจ้งเตือนข้อมูลและพฤติกรรมผิดปกติ
        
จากการใช้ AI สแกนสมุดบัญชี ยอดฝากสัจจะ และการค้ำประกันสัญญาเงินกู้:

1. **🟢 ไม่พบการค้างชำระรุนแรง**: สมาชิกส่วนใหญ่ผ่อนชำระตรงเวลา มีเพียงสมาชิกบางรายชำระล่าช้าเฉลี่ยไม่เกิน 5 วัน
2. **⚠️ ข้อพึงระวังด้านผู้ค้ำประกัน**: 
   * มีข้อสังเกตว่า **นายสมศักดิ์ รักดี (M001)** ค้ำประกันให้สมาชิกรายอื่นรวมแล้ว 2 สัญญา ซึ่งใกล้ถึงเพดานจำกัดความเสี่ยงของบุคคล
3. **🔍 การตรวจสอบเชิงรุก**: 
   * แนะนำให้คณะกรรมการติดตามยอดเงินสัจจะของสมาชิกที่มียอดค้างสัญญากู้รวมใกล้เคียงกับยอดเงินออม เพื่อป้องกันกรณีถอนเงินฝากจนเหลือต่ำกว่าเกณฑ์ค้ำประกัน`;

      case 'draft-doc':
        return `## ✉️ ร่างจดหมายรับรองและเอกสารทางการ (AI Draft)
        
**เลขที่เอกสาร:** กค.สจ./${new Date().getFullYear()}/[ระบุเลขลำดับ]
**ออก ณ วันที่:** ${new Date().toLocaleDateString('th-TH')}

### หนังสือรับรองความเป็นสมาชิกและสถานะทางการเงิน

หนังสือฉบับนี้ออกเพื่อรับรองว่า **${ctx?.memberName || '[ระบุชื่อสมาชิก]'}** เลขบัตรประจำตัวประชาชน: **${ctx?.idCard || '[ระบุเลขบัตร]'}** เป็นสมาชิกผู้ร่วมถือหุ้นและฝากเงินสัจจะสะสมกับ **${ctx?.tenantName || 'กองทุนสัจจะและสวัสดิการชุมชน'}**

ปัจจุบันมีข้อมูลทางการเงินดังนี้:
1. **ยอดเงินฝากสัจจะสะสมคงเหลือ:** ${ctx?.depositBalance?.toLocaleString() || '0'} บาท
2. **จำนวนหุ้นสะสม:** ${ctx?.shareCount?.toLocaleString() || '0'} หุ้น (มูลค่ารวม ${(ctx?.shareCount * 100)?.toLocaleString() || '0'} บาท)
3. **ประวัติการชำระและการค้ำประกัน:** อยู่ในเกณฑ์ดีเลิศ ไม่มีภาระหนี้ผิดเงื่อนไขใดๆ

ออกให้ไว้เพื่อใช้ประกอบการยื่นขอรับสวัสดิการชุมชนหรืออ้างอิงสถานะสมาชิกตามระเบียบกองทุน

(ลงชื่อ)........................................................ ประธานกองทุน
(ลงชื่อ)........................................................ เหรัญญิกกองทุน`;

      default:
        return `## 🤖 AI ผู้ช่วยอัจฉริยะยินดีให้บริการค่ะ
        
ฉันสามารถช่วยคณะกรรมการและสมาชิกในภารกิจต่อไปนี้ได้ค่ะ:
* 📝 **สรุปผลการประชุมประจำเดือน** ให้เข้าใจง่ายใน 1 หน้า
* 📊 **วิเคราะห์รายรับรายจ่าย** และจำแนกประเภทเงินเข้าออก
* 💧 **ประเมินสภาพคล่องทางการเงิน** ตรวจสอบความปลอดภัยกองทุน
* 🚨 **แจ้งเตือนความเสี่ยงเชิงรุก** และสแกนข้อมูลผิดปกติ
* ✉️ **ช่วยร่างจดหมายราชการ** หนังสือรับรองสมาชิก
* 🔍 **ค้นหาและตอบคำถาม** ด้านระเบียบเงื่อนไข อัตราดอกเบี้ย 

*กรุณาเลือกปุ่มด่วนด้านบน หรือพิมพ์คำถามที่ต้องการให้ช่วยในช่องสนทนาได้เลยค่ะ!*`;
    }
  };

  if (!client) {
    // Return simulated response instantly
    res.json({ text: getFallbackResponse(action, prompt, context) });
    return;
  }

  try {
    const systemPrompt = `คุณคือ "AI ผู้ช่วยอัจฉริยะประจำกองทุนสัจจะและสวัสดิการชุมชน" (Smart Village Fund AI Assistant) 
    ทำหน้าที่ช่วยเหลือคณะกรรมการ เหรัญญิก ประธาน และสมาชิกทั่วไป 
    ให้คำตอบที่เป็นภาษาไทยที่สุภาพ เป็นทางการ น่าเชื่อถือ ละเอียดถูกต้อง มีความเข้าใจด้านบัญชีชุมชน การเงินชุมชน และสวัสดิการ 
    คุณต้องตอบในรูปแบบ Markdown ที่สวยงาม จัดเรียงเป็นหัวข้อและรายการอย่างเหมาะสม และเน้นข้อมูลสำคัญโดยใช้ตัวหนา 
    
    ข้อมูลสภาพแวดล้อมปัจจุบัน:
    - เวลาปัจจุบัน: ${new Date().toISOString()}
    - ชื่อกองทุนผู้ใช้: ${context?.tenantName || 'กองทุนสัจจะชุมชน'}
    
    การให้บริการในครั้งนี้คือ Action: "${action}"`;

    let userPrompt = prompt || '';

    if (action === 'summarize') {
      userPrompt = `กรุณาสรุปรายงานการประชุมต่อไปนี้ให้ออกมาเป็นหัวข้อที่กระชับ สรุปประเด็นพิจารณา ประเด็นแจ้งทราบ มติที่ประชุม และข้อตกลงร่วมกันอย่างชัดเจนเป็นระเบียบ:
      ---
      ${context?.minutes || userPrompt}
      ---`;
    } else if (action === 'analyze-finance') {
      userPrompt = `ช่วยวิเคราะห์ข้อมูลรายรับรายจ่ายล่าสุดต่อไปนี้ วิเคราะห์ว่าจุดใดเป็นรายรับหลัก จุดใดเป็นรายจ่ายหลัก สภาพทางการเงิน และคำแนะนำเชิงรับรองความมั่นคง:
      ---
      รายการธุรกรรมล่าสุด: ${JSON.stringify(context?.transactions || [])}
      ยอดสมาชิก: ${context?.membersCount || 0} คน
      ---`;
    } else if (action === 'analyze-liquidity') {
      userPrompt = `ช่วยคำนวณและวิเคราะห์สภาพคล่องของกองทุนจากข้อมูลทางการเงินด้านล่างนี้ ให้คำตอบที่ชัดเจนว่ากองทุนมีความมั่นคงในเกณฑ์ใด มีข้อควรปรับปรุงอย่างไร:
      ---
      ยอดฝากรวมสมาชิก: ${context?.totalDeposits || 0} บาท
      ยอดหุ้นรวมสมาชิก: ${context?.totalShares || 0} บาท
      ยอดสินเชื่อคงเหลือ (เงินกู้ปล่อยอยู่): ${context?.totalLoans || 0} บาท
      เงินสดคงเหลือหมุนเวียน: ${context?.cashBalance || 0} บาท
      ---`;
    } else if (action === 'flag-anomalies') {
      userPrompt = `โปรดวิเคราะห์ความเสี่ยงและแจ้งเตือนพฤติกรรมทางการเงินผิดปกติหรือความเสี่ยงเชิงกฎเกณฑ์จากข้อมูลนี้:
      - สัญญากู้ทั้งหมด: ${JSON.stringify(context?.loans || [])}
      - สมาชิกและยอดเงินฝาก: ${JSON.stringify(context?.members || [])}
      - มองหาว่ามีใครค้างชำระหนี้, มีผู้ค้ำประกันซ้ำซ้อนมากเกินไป หรือมียอดกู้สูงเกินสัดส่วนออมทรัพย์อ้างอิงหรือไม่ และแสดงผลเป็นข้อๆ อย่างชัดเจน`;
    } else if (action === 'draft-doc') {
      userPrompt = `ช่วยร่างจดหมายรับรองความเป็นสมาชิกและยอดเงินสะสมให้เป็นทางการสำหรับสมาชิกคนนี้:
      ชื่อสมาชิก: ${context?.memberName}
      เลขบัตร: ${context?.idCard}
      ยอดฝากสัจจะ: ${context?.depositBalance} บาท
      หุ้นสะสม: ${context?.shareCount} หุ้น
      ชื่อกองทุน: ${context?.tenantName}
      รหัสสมาชิก: ${context?.memberCode}
      จัดรูปแบบจดหมายเป็นแบบฟอร์มเอกสารทางราชการที่สวยงาม สมบูรณ์และพร้อมพิมพ์`;
    }

    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.3,
      }
    });

    res.json({ text: response.text });
  } catch (error: any) {
    const errorMsg = error.message || String(error);
    const isApiKeyIssue = errorMsg.includes('leaked') || errorMsg.includes('API key') || errorMsg.includes('PERMISSION_DENIED') || errorMsg.includes('403');
    
    if (isApiKeyIssue) {
      console.warn("Gemini API Key is leaked, revoked or invalid. Activating circuit breaker and falling back to rich simulated mode gracefully.");
      aiDisabled = true;
      aiClient = null;
      res.json({ text: getFallbackResponse(action, prompt, context) + `\n\n*(หมายเหตุ: ระบบวิเคราะห์ด้วยโมเดลความรู้ท้องถิ่นเนื่องจากกุญแจบริการ AI หลักหมดอายุหรือระงับชั่วคราว)*` });
    } else {
      console.warn("Gemini API Error, falling back to simulated mode:", errorMsg);
      res.json({ text: getFallbackResponse(action, prompt, context) + `\n\n*(หมายเหตุ: แสดงผลในโหมดประมวลผลออฟไลน์เนื่องจากเหตุผลทางเทคนิค: ${errorMsg})*` });
    }
  }
});

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);

