import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import {
  checkOrgPermission,
  normalizeOrgHandle,
} from '@/lib/organizationPermissions'
import { recordOrgAuditLog } from '@/lib/organizationAudit'
import { OrganizationFinanceStatus } from '@prisma/client'

export async function GET(
  _req: NextRequest,
  props: { params: Promise<{ handle: string }> }
) {
  try {
    const params = await props.params
    const rawHandle = normalizeOrgHandle(params.handle)
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const org = await prisma.organization.findUnique({
      where: { handle: rawHandle },
      select: { id: true, name: true, handle: true },
    })

    if (!org) {
      return NextResponse.json({ success: false, error: 'Organization not found' }, { status: 404 })
    }

    const permCheck = await checkOrgPermission({
      userId: session.user.id,
      organizationId: org.id,
      permission: 'view_finance_summary',
    })

    if (!permCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: permCheck.reason || 'Only organization Owners have authority to view financial governance profiles.',
        },
        { status: 403 }
      )
    }

    let financeProfile = await prisma.organizationFinanceProfile.findUnique({
      where: { organizationId: org.id },
    })

    if (!financeProfile) {
      financeProfile = await prisma.organizationFinanceProfile.create({
        data: {
          organizationId: org.id,
          status: OrganizationFinanceStatus.UNCONFIGURED,
          currency: 'KES',
        },
      })
    }

    return NextResponse.json({
      success: true,
      organization: {
        id: org.id,
        name: org.name,
        handle: org.handle,
      },
      financeProfile: {
        id: financeProfile.id,
        status: financeProfile.status,
        currency: financeProfile.currency,
        beneficiaryName: financeProfile.beneficiaryName,
        payoutMethod: financeProfile.payoutMethod,
        settlementNotes: financeProfile.settlementNotes,
        payoutsEnabled: financeProfile.status === OrganizationFinanceStatus.ENABLED,
        notice:
          'Organization payouts and automated settlements require verified payment provider account linkage and compliance review. Payout execution remains disabled until provider onboarding is approved.',
      },
    })
  } catch (error) {
    console.error('[GET /api/organizations/[handle]/finance] Error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  props: { params: Promise<{ handle: string }> }
) {
  try {
    const params = await props.params
    const rawHandle = normalizeOrgHandle(params.handle)
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const org = await prisma.organization.findUnique({
      where: { handle: rawHandle },
      select: { id: true, name: true },
    })

    if (!org) {
      return NextResponse.json({ success: false, error: 'Organization not found' }, { status: 404 })
    }

    const permCheck = await checkOrgPermission({
      userId: session.user.id,
      organizationId: org.id,
      permission: 'configure_settlement',
    })

    if (!permCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: permCheck.reason || 'Only organization Owners can configure financial destinations.',
        },
        { status: 403 }
      )
    }

    let body: {
      beneficiaryName?: string
      payoutMethod?: string
      settlementNotes?: string
    }

    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
    }

    // High risk financial governance: Status transitions to PENDING_REVIEW pending provider KYB
    const updated = await prisma.organizationFinanceProfile.upsert({
      where: { organizationId: org.id },
      create: {
        organizationId: org.id,
        status: OrganizationFinanceStatus.PENDING_REVIEW,
        currency: 'KES',
        beneficiaryName: body.beneficiaryName?.trim() || null,
        payoutMethod: body.payoutMethod?.trim() || null,
        settlementNotes: body.settlementNotes?.trim() || null,
      },
      update: {
        status: OrganizationFinanceStatus.PENDING_REVIEW,
        beneficiaryName: body.beneficiaryName?.trim() || undefined,
        payoutMethod: body.payoutMethod?.trim() || undefined,
        settlementNotes: body.settlementNotes?.trim() || undefined,
      },
    })

    await recordOrgAuditLog({
      organizationId: org.id,
      actorId: session.user.id,
      action: 'FINANCE_DESTINATION_REQUESTED',
      targetType: 'FINANCE_PROFILE',
      targetId: updated.id,
      metadata: { beneficiaryName: updated.beneficiaryName, payoutMethod: updated.payoutMethod },
    })

    return NextResponse.json({
      success: true,
      message: 'Settlement configuration submitted for review. Live payouts remain disabled until provider verification.',
      financeProfile: updated,
    })
  } catch (error) {
    console.error('[PATCH /api/organizations/[handle]/finance] Error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
