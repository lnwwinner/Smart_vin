/* eslint-disable @typescript-eslint/no-explicit-any */
import { Member, Loan, Welfare, FundSettings, WelfareRule } from '../domain/entities';

/**
 * Smart Village Fund Platform - Core Rule Engine & Approval Workflow Core
 */

export class RuleEngine {
  /**
   * Evaluates if a member is eligible for a loan of a specific amount
   */
  public static validateLoanEligibility(
    member: Member,
    requestedAmount: number,
    settings: FundSettings,
    activeLoansCount: number
  ): { eligible: boolean; reason?: string } {
    if (member.status !== 'active') {
      return { eligible: false, reason: 'สมาชิกไม่มีสถานะปกติ (Active)' };
    }

    if (activeLoansCount > 0) {
      return { eligible: false, reason: 'สมาชิกยังมีสัญญาเงินกู้ค้างชำระอยู่' };
    }

    if (requestedAmount > settings.maxLoanAmount) {
      return { 
        eligible: false, 
        reason: `วงเงินกู้เกินขีดจำกัดที่ระเบียบกำหนดไว้สูงสุด (${settings.maxLoanAmount.toLocaleString()} บาท)` 
      };
    }

    // Traditional village rule: Loan cannot exceed 5 times the member's share value
    const shareValue = member.shareCount * settings.sharePrice;
    const maxAllowedByShares = shareValue * 5;
    if (requestedAmount > maxAllowedByShares && requestedAmount > 10000) {
      return {
        eligible: false,
        reason: `วงเงินกู้เกิน 5 เท่าของมูลค่าหุ้นสะสมที่มี (${maxAllowedByShares.toLocaleString()} บาท) ตามระเบียบความเสี่ยง`
      };
    }

    return { eligible: true };
  }

  /**
   * Evaluates if a member is eligible for a specific welfare category
   */
  public static validateWelfareEligibility(
    member: Member,
    welfareType: 'medical' | 'elderly' | 'funeral' | 'education',
    settings: FundSettings
  ): { eligible: boolean; amountAllowed: number; reason?: string } {
    const rule = settings.welfareRules.find(r => r.type === welfareType);
    if (!rule) {
      return { eligible: false, amountAllowed: 0, reason: 'ไม่พบกฎระเบียบของสวัสดิการประเภทนี้' };
    }

    if (member.status !== 'active') {
      return { eligible: false, amountAllowed: 0, reason: 'สถานะสมาชิกไม่ปกติ' };
    }

    if (welfareType === 'elderly') {
      // Calculate age from birthdate (assuming YYYY-MM-DD format)
      const birthYear = new Date(member.birthdate).getFullYear();
      const currentYear = new Date().getFullYear();
      const age = currentYear - birthYear;
      if (age < 60) {
        return { 
          eligible: false, 
          amountAllowed: 0, 
          reason: `อายุของสมาชิก (${age} ปี) ยังไม่ครบเกณฑ์สวัสดิการผู้สูงอายุ 60 ปี` 
        };
      }
    }

    return { eligible: true, amountAllowed: rule.amount };
  }
}

/**
 * Sequential Approval Flow State Machine definitions (Phase 6)
 */
export interface ApprovalStep {
  stepName: string;
  assignedRole: 'HE_RAN_YIK' | 'PRATHAN' | 'COMMITTEE';
  sequence: number;
}

export class ApprovalWorkflowEngine {
  public static getStepsForEntity(entityType: 'LOAN' | 'WELFARE'): ApprovalStep[] {
    if (entityType === 'LOAN') {
      return [
        { stepName: 'ตรวจสอบหลักค้ำประกัน', assignedRole: 'HE_RAN_YIK', sequence: 1 },
        { stepName: 'อนุมัติวงเงินกู้', assignedRole: 'PRATHAN', sequence: 2 }
      ];
    } else {
      return [
        { stepName: 'อนุมัติความถูกต้องสิทธิ์สวัสดิการ', assignedRole: 'HE_RAN_YIK', sequence: 1 }
      ];
    }
  }
}
