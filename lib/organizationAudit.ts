import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'

export interface RecordOrgAuditParams {
  organizationId: string
  actorId?: string | null
  action: string
  targetType?: string | null
  targetId?: string | null
  metadata?: Record<string, unknown> | Prisma.InputJsonValue | null
}

export async function recordOrgAuditLog({
  organizationId,
  actorId,
  action,
  targetType,
  targetId,
  metadata,
}: RecordOrgAuditParams) {
  try {
    return await prisma.organizationAuditLog.create({
      data: {
        organizationId,
        actorId: actorId ?? null,
        action,
        targetType: targetType ?? null,
        targetId: targetId ?? null,
        metadata: (metadata as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      },
    })
  } catch (error) {
    // Non-blocking log failure warning to prevent breaking user flow
    console.error('[OrganizationAuditLog] Failed to record audit log:', error)
    return null
  }
}
