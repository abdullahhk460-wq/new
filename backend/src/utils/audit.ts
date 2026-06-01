import prisma from '../database/client.js';

export interface AuditLogData {
  adminId?: string | null;
  action: string;
  targetId?: string | null;
  ipAddress?: string | null;
  metadata?: any;
}

export async function logAudit(data: AuditLogData): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        adminId: data.adminId || null,
        action: data.action,
        targetId: data.targetId || null,
        ipAddress: data.ipAddress || null,
        metadata: data.metadata || {},
      },
    });
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
}

export default logAudit;
