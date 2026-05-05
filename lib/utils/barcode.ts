import { v4 as uuidv4 } from "uuid";

export function generateMemberBarcode(membershipNo: string): string {
  return `MEM-${membershipNo}`;
}

export function generateCopyBarcode(accessionNo: string, copyNo: number): string {
  return `BK-${accessionNo}-${String(copyNo).padStart(3, "0")}`;
}

export function generateAccessionNo(year: number, sequence: number): string {
  return `${year}/${String(sequence).padStart(5, "0")}`;
}

export function generateRequisitionNo(year: number, sequence: number): string {
  return `REQ/${year}/${String(sequence).padStart(4, "0")}`;
}

export function generatePONo(year: number, sequence: number): string {
  return `PO/${year}/${String(sequence).padStart(4, "0")}`;
}

export function generateReceiptNo(): string {
  return `RCPT-${Date.now()}`;
}
