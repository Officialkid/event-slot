import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { updateProfileSchema } from "@/lib/schemas/profile.schema"
import { createNotification } from "@/lib/notifications"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        name: true,
        email: true,
        image: true,
        username: true,
        organizationName: true,
        contactPhone: true,
        contactWhatsapp: true,
        contactEmail: true,
        preferredLanguage: true,
        password: true,
        googleCalendarConnected: true,
        twoFactorEnabled: true,
        showFollowerCountPublicly: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    return NextResponse.json({
      name: user.name,
      email: user.email,
      image: user.image,
      username: user.username,
      organizationName: user.organizationName,
      contactPhone: user.contactPhone,
      contactWhatsapp: user.contactWhatsapp,
      contactEmail: user.contactEmail,
      preferredLanguage: user.preferredLanguage,
      hasPassword: !!user.password,
      calendarConnected: !!user.googleCalendarConnected,
      twoFactorEnabled: !!user.twoFactorEnabled,
      showFollowerCountPublicly: user.showFollowerCountPublicly ?? true,
    })
  } catch (err) {
    console.error("[profile] GET error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let rawBody: unknown
    try {
      rawBody = await req.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const parsed = updateProfileSchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
        { status: 400 }
      )
    }

    const {
      name,
      username,
      organizationName,
      contactPhone,
      contactWhatsapp,
      contactEmail,
      twoFactorEnabled,
      preferredLanguage,
      showFollowerCountPublicly,
    } = parsed.data
    const data: {
      name?: string
      username?: string
      organizationName?: string | null
      contactPhone?: string | null
      contactWhatsapp?: string | null
      contactEmail?: string | null
      twoFactorEnabled?: boolean
      preferredLanguage?: string
      showFollowerCountPublicly?: boolean
    } = {}

    if (typeof name === "string" && name.trim().length > 0) {
      data.name = name.trim()
    }
    if (typeof username === "string" && username.trim().length > 0) {
      const cleanUsername = username.toLowerCase().trim()
      const existing = await prisma.user.findUnique({ where: { username: cleanUsername } })
      if (existing && existing.id !== session.user.id) {
        return NextResponse.json({ error: "Username is already taken" }, { status: 409 })
      }
      data.username = cleanUsername
    }
    if (organizationName !== undefined) {
      data.organizationName = typeof organizationName === "string" ? organizationName.trim() : null
    }
    if (contactPhone !== undefined) {
      data.contactPhone = typeof contactPhone === "string" ? contactPhone.trim() : null
    }
    if (contactWhatsapp !== undefined) {
      data.contactWhatsapp = typeof contactWhatsapp === "string" ? contactWhatsapp.trim() : null
    }
    if (contactEmail !== undefined) {
      data.contactEmail = typeof contactEmail === "string" ? contactEmail.trim().toLowerCase() : null
    }
    if (typeof twoFactorEnabled === "boolean") {
      data.twoFactorEnabled = twoFactorEnabled
      await prisma.auditLog.create({
        data: {
          actorId: session.user.id,
          action: twoFactorEnabled ? "2FA_ENABLED" : "2FA_DISABLED",
          metadata: { at: new Date().toISOString() },
        },
      }).catch(() => {})

      await createNotification({
        userId: session.user.id,
        type: "PLATFORM",
        title: twoFactorEnabled ? "Two-Factor Authentication Enabled" : "Security Alert: Two-Factor Authentication Disabled",
        message: twoFactorEnabled
          ? "Two-factor authentication has been enabled for your EventSlot account."
          : "Two-factor authentication was disabled for your account. If this wasn't you, please change your password immediately.",
        link: "/dashboard/profile",
      }).catch(() => {})
    }
    if (typeof preferredLanguage === "string") {
      data.preferredLanguage = preferredLanguage
    }
    if (typeof showFollowerCountPublicly === "boolean") {
      data.showFollowerCountPublicly = showFollowerCountPublicly
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No changes provided" }, { status: 400 })
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[profile] PATCH error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const eventOwnerFilters: Array<{ organizerId?: string; organizerEmail?: string }> = [{ organizerId: user.id }]
    if (user.email) {
      eventOwnerFilters.push({ organizerEmail: user.email })
    }

    await prisma.$transaction(async (tx) => {
      await tx.eventPass.deleteMany({
        where: { organizerId: user.id },
      })

      await tx.event.deleteMany({
        where: {
          OR: eventOwnerFilters,
        },
      })

      // These relations are not guaranteed to cascade in every deployed schema.
      await tx.teamMember.deleteMany({
        where: {
          OR: [
            { ownerId: user.id },
            { memberId: user.id },
          ],
        },
      })
      await tx.organizerFeedback.deleteMany({ where: { organizerId: user.id } })
      await tx.eventUnlock.deleteMany({ where: { userId: user.id } })
      await tx.billingLaunchInterest.deleteMany({ where: { userId: user.id } })
      await tx.reportDownloadTransaction.deleteMany({ where: { userId: user.id } })
      await tx.paygUsage.deleteMany({ where: { userId: user.id } })
      await tx.paygInvoice.deleteMany({ where: { userId: user.id } })
      await tx.referral.deleteMany({
        where: {
          OR: [
            { referrerId: user.id },
            { referredUserId: user.id },
          ],
        },
      })
      await tx.message.updateMany({
        where: { authorId: user.id },
        data: { authorId: null },
      })
      if (user.email) {
        await tx.loginSecurityState.deleteMany({
          where: { email: user.email },
        })
      }

      const ledgerCount = await tx.financialLedgerEntry.count({
        where: { organizerId: user.id },
      })
      if (ledgerCount > 0) {
        throw new Error("CANNOT_DELETE_WITH_FINANCIAL_RECORDS")
      }

      await tx.user.delete({ where: { id: user.id } })
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof Error && err.message === "CANNOT_DELETE_WITH_FINANCIAL_RECORDS") {
      return NextResponse.json(
        { error: "Cannot delete account with existing financial transaction history. Please contact support to deactivate your account." },
        { status: 400 }
      )
    }
    console.error("[profile] DELETE error:", err)
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 })
  }
}
