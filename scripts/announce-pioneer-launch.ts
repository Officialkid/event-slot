import { prisma } from "../lib/prisma"
import { sendPioneerBadgeAnnouncementEmail } from "../lib/email"

const TITLE = "You're an EventSlot Pioneer"
const MESSAGE =
  "As one of EventSlot's earliest supporters, you've been awarded the Pioneer badge - a limited badge that marks you as part of the founding community. Check your Community tab."
const LINK = "/dashboard/community"

async function sendInAppNotifications(userIds: string[]) {
  if (!userIds.length) return 0

  const result = await prisma.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      type: "PLATFORM",
      title: TITLE,
      message: MESSAGE,
      link: LINK,
    })),
  })

  return result.count
}

async function sendEmails(emails: string[]) {
  let sent = 0
  let failed = 0

  for (const email of emails) {
    try {
      await sendPioneerBadgeAnnouncementEmail({ to: email })
      sent += 1
    } catch (error) {
      failed += 1
      console.error(`[pioneer-launch] email failed for ${email}:`, error)
    }
  }

  return { sent, failed }
}

async function main() {
  const shouldSendEmails = process.env.SEND_PIONEER_EMAILS === "true"
  const force = process.env.FORCE_PIONEER_ANNOUNCEMENT === "true"

  const existingCount = await prisma.notification.count({
    where: { title: TITLE, link: LINK },
  })

  if (existingCount > 0 && !force) {
    console.log(
      `[pioneer-launch] Found ${existingCount} existing pioneer notifications. Set FORCE_PIONEER_ANNOUNCEMENT=true to run again.`
    )
    return
  }

  const users = await prisma.user.findMany({
    select: { id: true, email: true },
  })

  const userIds = users.map((u) => u.id)
  const emails = users
    .map((u) => u.email?.trim())
    .filter((email): email is string => Boolean(email))

  console.log(`[pioneer-launch] Users found: ${users.length}`)

  const notificationCount = await sendInAppNotifications(userIds)
  console.log(`[pioneer-launch] In-app notifications sent: ${notificationCount}`)

  if (shouldSendEmails) {
    console.log(`[pioneer-launch] Sending pioneer emails to ${emails.length} users...`)
    const emailResult = await sendEmails(emails)
    console.log(`[pioneer-launch] Emails sent: ${emailResult.sent}`)
    console.log(`[pioneer-launch] Emails failed: ${emailResult.failed}`)
  } else {
    console.log("[pioneer-launch] Email sending skipped. Set SEND_PIONEER_EMAILS=true to enable.")
  }
}

main()
  .catch((error) => {
    console.error("[pioneer-launch] failed:", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
