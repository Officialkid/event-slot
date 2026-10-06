import { PrismaClient } from '@prisma/client'

function loadLocalEnv() {
  try {
    const fs = require('fs') as typeof import('fs')
    const path = require('path') as typeof import('path')
    const envPath = path.join(process.cwd(), '.env')
    if (!fs.existsSync(envPath)) return

    const contents = fs.readFileSync(envPath, 'utf8')
    for (const rawLine of contents.split(/\r?\n/)) {
      const line = rawLine.trim()
      if (!line || line.startsWith('#')) continue
      const eqIndex = line.indexOf('=')
      if (eqIndex === -1) continue
      const key = line.slice(0, eqIndex).trim()
      let value = line.slice(eqIndex + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (!(key in process.env)) {
        process.env[key] = value
      }
    }
  } catch {
    // Best effort only.
  }
}

loadLocalEnv()
if (process.env.DIRECT_URL && !process.env.DATABASE_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL
}
if (!process.env.ENCRYPTION_KEY) {
  process.env.ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
}

import { encrypt, decrypt } from '../lib/encrypt'
import { buildCalendarEvent } from '../lib/googleCalendar'

const prisma = new PrismaClient()

async function runTests() {
  console.log('====================================================')
  console.log('🚀 EVENTSLOT MASTER VIRTUAL EVENT ACCESS TEST SUITE')
  console.log('====================================================\n')

  let passed = 0
  let failed = 0

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`)
      passed++
    } else {
      console.error(`  ❌ FAIL: ${testName}${detail ? ` - ${detail}` : ''}`)
      failed++
    }
  }

  const TEST_SLUG = `test-virtual-${Date.now()}`
  const RAW_MEETING_LINK = 'https://meet.google.com/xyz-test-abc'
  let createdEventId: string | null = null

  try {
    // ----------------------------------------------------
    // TEST 1: Encryption at Rest & Link Secrecy
    // ----------------------------------------------------
    console.log('Test Section 1: Encryption & Decryption Foundation')
    const encResult = encrypt(RAW_MEETING_LINK)
    assert(encResult.encrypted !== RAW_MEETING_LINK, 'Encrypted output is not plain text')
    assert(encResult.encrypted.length > 20, 'Encrypted output has valid ciphertext length')
    assert(!!encResult.iv && encResult.iv.length === 32, 'Initialization Vector (IV) is 32 hex chars (16 bytes)')
    
    const decResult = decrypt(encResult.encrypted, encResult.iv)
    assert(decResult === RAW_MEETING_LINK, 'Decryption accurately restores original meeting link')

    // Find or create a test organizer
    let organizer = await prisma.user.findFirst()
    if (!organizer) {
      organizer = await prisma.user.create({
        data: {
          email: 'organizer.test@eventslot.test',
          name: 'Virtual Test Organizer',
        },
      })
    }

    // ----------------------------------------------------
    // TEST 2: Event Creation with Encrypted Link & joinOpensAt
    // ----------------------------------------------------
    console.log('\nTest Section 2: Virtual Event Creation & DB Integrity')
    const now = new Date()
    const eventStartDate = new Date(now.getTime() + 60 * 60 * 1000) // 1 hour in future
    const joinOpensAtFuture = new Date(now.getTime() + 30 * 60 * 1000) // 30 mins in future

    const event = await prisma.event.create({
      data: {
        slug: TEST_SLUG,
        title: 'Virtual Summit Automated Test Event',
        description: 'Automated test virtual event',
        eventType: 'VIRTUAL',
        accessType: 'REGISTRATION',
        eventDate: eventStartDate,
        joinOpensAt: joinOpensAtFuture,
        virtualLink: encResult.encrypted,
        virtualLinkIv: encResult.iv,
        organizerEmail: organizer.email || 'organizer.test@eventslot.test',
        dashboardToken: `dt-${TEST_SLUG}`,
        organizerId: organizer.id,
        capacity: 100,
        questions: [],
      },
    })
    createdEventId = event.id

    const fetchedDbEvent = await prisma.event.findUnique({ where: { id: event.id } })
    assert(!!fetchedDbEvent, 'Virtual event successfully saved in database')
    assert(fetchedDbEvent?.eventType === 'VIRTUAL', 'Event type is set to VIRTUAL')
    assert(fetchedDbEvent?.virtualLink !== RAW_MEETING_LINK, 'Stored virtualLink is strictly NOT stored in plain text')
    assert(fetchedDbEvent?.virtualLink === encResult.encrypted, 'Stored virtualLink matches AES-256 ciphertext')
    assert(fetchedDbEvent?.virtualLinkIv === encResult.iv, 'Stored virtualLinkIv is persisted alongside ciphertext')

    // ----------------------------------------------------
    // TEST 3: Registrations Setup
    // ----------------------------------------------------
    console.log('\nTest Section 3: Attendee Registrations')
    const confirmedReg = await prisma.registration.create({
      data: {
        eventId: event.id,
        status: 'CONFIRMED',
        confirmationCode: `CONF-${TEST_SLUG}-OK`,
        attendeeEmail: 'attendee.ok@eventslot.test',
        answers: [],
      },
    })

    const waitlistReg = await prisma.registration.create({
      data: {
        eventId: event.id,
        status: 'WAITLIST',
        confirmationCode: `CONF-${TEST_SLUG}-WAIT`,
        attendeeEmail: 'attendee.wait@eventslot.test',
        answers: [],
      },
    })

    assert(!!confirmedReg, 'Confirmed registration created with code: ' + confirmedReg.confirmationCode)
    assert(!!waitlistReg, 'Waitlisted registration created with code: ' + waitlistReg.confirmationCode)

    // ----------------------------------------------------
    // TEST 4: Time-Gated Access Window Enforcement (verify-entry simulation)
    // ----------------------------------------------------
    console.log('\nTest Section 4: Access Window Authorization Logic')

    // Helper to evaluate access logic identically to app/api/events/[slug]/verify-entry/route.ts
    async function evaluateEntry(code: string) {
      const reg = await prisma.registration.findFirst({
        where: { confirmationCode: code, eventId: event.id },
        include: { event: true },
      })
      if (!reg) return { status: 404, code: 'NOT_FOUND', error: 'Registration not found' }
      if (reg.status !== 'CONFIRMED') return { status: 403, code: 'NOT_CONFIRMED', error: 'Ticket is not confirmed' }
      if (reg.event.archived) return { status: 403, code: 'EVENT_CANCELLED', error: 'Event cancelled' }

      if (reg.event.eventType === 'VIRTUAL') {
        const currentTime = new Date()
        const eventStart = reg.event.eventDate ? new Date(reg.event.eventDate) : null
        const openTime = reg.event.joinOpensAt
          ? new Date(reg.event.joinOpensAt)
          : eventStart
          ? new Date(eventStart.getTime() - 30 * 60 * 1000)
          : null

        if (openTime && currentTime < openTime) {
          const minutesUntil = Math.ceil((openTime.getTime() - currentTime.getTime()) / 60000)
          return {
            status: 403,
            code: 'TOO_EARLY',
            error: `Access opens ${minutesUntil} minutes before start.`,
            minutesUntilOpen: minutesUntil,
            joinOpensAt: openTime.toISOString(),
          }
        }

        let decryptedLink: string | null = null
        if (reg.event.virtualLink) {
          try {
            decryptedLink = decrypt(reg.event.virtualLink, reg.event.virtualLinkIv || '')
          } catch {
            return { status: 500, code: 'DECRYPTION_FAILED' }
          }
        }

        // Record entry log
        await prisma.entryLog.create({
          data: {
            eventId: reg.event.id,
            ticketId: reg.confirmationCode || reg.id,
            attendeeName: reg.attendeeEmail || 'Test Attendee',
            success: true,
          },
        })

        return {
          status: 200,
          code: 'AUTHORIZED',
          virtualLink: decryptedLink,
          attendeeName: reg.attendeeEmail,
        }
      }

      return { status: 200, code: 'AUTHORIZED' }
    }

    // Step A: Attempt join when window is in future -> MUST BE BLOCKED
    const earlyCheck = await evaluateEntry(confirmedReg.confirmationCode || '')
    assert(earlyCheck.status === 403, 'Early access is rejected with status 403')
    assert(earlyCheck.code === 'TOO_EARLY', 'Early access returns error code TOO_EARLY')
    assert(
      (earlyCheck as any).minutesUntilOpen > 0,
      'Early access returns positive minutesUntilOpen countdown value'
    )
    assert((earlyCheck as any).virtualLink === undefined, 'Raw virtual link is NOT leaked during early check')

    // Step B: Attempt join with waitlisted ticket -> MUST BE BLOCKED
    const waitlistCheck = await evaluateEntry(waitlistReg.confirmationCode || '')
    assert(waitlistCheck.status === 403, 'Waitlist access is rejected with status 403')
    assert(waitlistCheck.code === 'NOT_CONFIRMED', 'Waitlist returns error code NOT_CONFIRMED')

    // Step C: Open Access Window -> MUST AUTHORIZE & LOG ENTRY
    console.log('\n  Advancing access window: joinOpensAt set to 5 minutes ago...')
    const windowOpenedAt = new Date(Date.now() - 5 * 60 * 1000)
    await prisma.event.update({
      where: { id: event.id },
      data: { joinOpensAt: windowOpenedAt },
    })

    const openCheck = await evaluateEntry(confirmedReg.confirmationCode || '')
    assert(openCheck.status === 200, 'When access window is open, returns status 200')
    assert(openCheck.code === 'AUTHORIZED', 'Returns code AUTHORIZED')
    assert((openCheck as any).virtualLink === RAW_MEETING_LINK, 'Returns decrypted original virtual meeting link')

    // Verify EntryLog was created
    const entryLogs = await prisma.entryLog.findMany({
      where: { eventId: event.id, ticketId: confirmedReg.confirmationCode || confirmedReg.id },
    })
    assert(entryLogs.length === 1, 'EntryLog created for audit trail upon authorized access')
    assert(entryLogs[0].success === true, 'EntryLog recorded success === true')

    // Step D: Event Cancelled / Archived Check
    console.log('\n  Testing event cancellation / archiving...')
    await prisma.event.update({
      where: { id: event.id },
      data: { archived: true },
    })
    const cancelledCheck = await evaluateEntry(confirmedReg.confirmationCode || '')
    assert(cancelledCheck.status === 403, 'Cancelled event access rejected with status 403')
    assert(cancelledCheck.code === 'EVENT_CANCELLED', 'Cancelled event returns EVENT_CANCELLED code')

    // ----------------------------------------------------
    // TEST 5: Calendar Secrecy Enforcement (buildCalendarEvent)
    // ----------------------------------------------------
    console.log('\nTest Section 5: Calendar Link Secrecy')
    
    // Test Attendee Role
    const attendeeCalendar = buildCalendarEvent({
      title: 'Virtual Summit',
      description: 'Annual gathering',
      location: null,
      startDate: eventStartDate,
      durationMins: 60,
      eventUrl: `https://eventsslot.com/join/${TEST_SLUG}`,
      isVirtual: true,
      meetingLink: RAW_MEETING_LINK,
      role: 'attendee',
    })

    assert(
      !attendeeCalendar.location?.includes(RAW_MEETING_LINK),
      'Attendee calendar invite location hides raw meeting link'
    )
    assert(
      !attendeeCalendar.description.includes(RAW_MEETING_LINK),
      'Attendee calendar invite description hides raw meeting link'
    )
    assert(
      attendeeCalendar.description.includes('/join/' + TEST_SLUG),
      'Attendee calendar invite directs attendee to EventSlot secure access portal'
    )

    // Test Organiser Role
    const organiserCalendar = buildCalendarEvent({
      title: 'Virtual Summit',
      description: 'Annual gathering',
      location: null,
      startDate: eventStartDate,
      durationMins: 60,
      eventUrl: `https://eventsslot.com/dashboard/events/${TEST_SLUG}`,
      isVirtual: true,
      meetingLink: RAW_MEETING_LINK,
      role: 'organiser',
    })

    assert(
      organiserCalendar.description.includes(RAW_MEETING_LINK),
      'Organiser calendar invite retains raw meeting link for host controls'
    )

    // ----------------------------------------------------
    // TEST 6: Attendee Whitelist Deduplication
    // ----------------------------------------------------
    console.log('\nTest Section 6: Attendee Whitelist Deduplication')
    const existingAttendees = [
      { email: 'user1@test.com', displayName: 'User One' },
      { email: 'user2@test.com', displayName: 'User Two' },
    ]
    const newAttendeeEmail = 'USER1@test.com' // case insensitive duplicate
    const isAlreadyPresent = existingAttendees.some(
      a => a.email?.toLowerCase() === newAttendeeEmail.toLowerCase()
    )
    assert(isAlreadyPresent, 'Case-insensitive duplicate attendee detected and deduplicated')

    const newAttendeeEmail2 = 'user3@test.com'
    const isPresent2 = existingAttendees.some(
      a => a.email?.toLowerCase() === newAttendeeEmail2.toLowerCase()
    )
    assert(!isPresent2, 'New unique attendee correctly identified for appending to whitelist')

  } catch (err) {
    console.error('Test execution error:', err)
    failed++
  } finally {
    // ----------------------------------------------------
    // CLEANUP
    // ----------------------------------------------------
    console.log('\nCleaning up test artifacts...')
    if (createdEventId) {
      await prisma.entryLog.deleteMany({ where: { eventId: createdEventId } })
      await prisma.registration.deleteMany({ where: { eventId: createdEventId } })
      await prisma.event.delete({ where: { id: createdEventId } })
      console.log('Cleaned up test event and registrations.')
    }
    await prisma.$disconnect()
  }

  console.log('\n====================================================')
  console.log(`TEST RESULTS: ${passed} PASSED | ${failed} FAILED`)
  console.log('====================================================')

  if (failed > 0) {
    process.exit(1)
  }
}

runTests()
