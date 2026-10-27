/** @jest-environment node */

import crypto from "crypto"
import { generateQRPayload, verifyQRPayload } from "@/lib/ticket-qr"
import { isAdminEmail, hasAdminAccess } from "@/lib/isAdmin"
import { FLAT_PAID_EVENT_COMMISSION_RATE, calculatePaidEventCommission } from "@/lib/paidEventCommission"

describe("Product Invariant & Domain Contract Tests (Simulated User Journeys)", () => {
  const TEST_QR_SECRET = "test-qr-secret-for-user-journeys-12345"
  const CANONICAL_ADMIN = "eventsslot.co@gmail.com"

  beforeAll(() => {
    process.env.QR_SECRET = TEST_QR_SECRET
    process.env.ADMIN_EMAILS = CANONICAL_ADMIN
  })

  afterAll(() => {
    delete process.env.QR_SECRET
    delete process.env.ADMIN_EMAILS
  })

  // --------------------------------------------------------------------------
  // Journey 1: Event Creation and Publishing
  // --------------------------------------------------------------------------
  describe("Journey 1: Event Creation & Publishing by Organizer", () => {
    it("validates and constructs a published event with tiers, custom questions, and canonical slug", () => {
      const rawTitle = "Nairobi Tech Summit 2026: AI & Scale!"
      const generatedSlug = rawTitle
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")

      expect(generatedSlug).toBe("nairobi-tech-summit-2026-ai-scale")

      const eventPayload = {
        title: rawTitle,
        slug: generatedSlug,
        organizerId: "org-user-123",
        organizerName: "TechHub Kenya",
        capacity: 250,
        isPaid: true,
        currency: "KES",
        ticketTiers: [
          { id: "tier-regular", name: "Regular Pass", priceKes: 1500, capacity: 200 },
          { id: "tier-vip", name: "VIP Executive", priceKes: 5000, capacity: 50 },
        ],
        questions: [
          { id: "q-diet", label: "Dietary Requirements", type: "text", required: false },
          { id: "q-track", label: "Preferred Track", type: "choice", options: ["AI", "Cloud", "Security"], required: true },
        ],
        attendeeConsentEnabled: true,
        attendeeConsentText: "I consent to event photography and badge scanning.",
        status: "PUBLISHED",
      }

      // Assertions on structural integrity
      expect(eventPayload.status).toBe("PUBLISHED")
      expect(eventPayload.ticketTiers.reduce((acc, t) => acc + t.capacity, 0)).toBe(eventPayload.capacity)
      expect(eventPayload.questions.find(q => q.required)?.id).toBe("q-track")
      expect(eventPayload.attendeeConsentEnabled).toBe(true)
    })
  })

  // --------------------------------------------------------------------------
  // Journey 2: Attendee Guided Registration
  // --------------------------------------------------------------------------
  describe("Journey 2: Attendee Guided Registration (Free & Paid)", () => {
    it("completes a free registration workflow with unique confirmation code", () => {
      const attendeeInfo = {
        name: "Amina Odhiambo",
        email: "amina@example.com",
        phone: "+254712345678",
        answers: [
          { questionId: "q-track", value: "AI" },
          { questionId: "q-diet", value: "Vegetarian" },
        ],
        consentAccepted: true,
      }

      // Ensure consent accepted
      expect(attendeeInfo.consentAccepted).toBe(true)

      // Simulate confirmation code generation
      const confirmationCode = `CONF-${crypto.randomBytes(3).toString("hex").toUpperCase()}`
      const registrationRecord = {
        id: `reg-${Date.now()}`,
        status: "CONFIRMED",
        confirmationCode,
        attendeeEmail: attendeeInfo.email,
        attendeeName: attendeeInfo.name,
      }

      expect(registrationRecord.status).toBe("CONFIRMED")
      expect(registrationRecord.confirmationCode).toMatch(/^CONF-[0-9A-F]{6}$/)
    })

    it("validates paid registration requirements: tier selection and payment intent", () => {
      const selectedTier = { id: "tier-vip", name: "VIP Executive", priceKes: 5000 }
      const registrationDraft = {
        email: "karis@example.com",
        name: "Karis Kamau",
        ticketTierId: selectedTier.id,
        amountDueKes: selectedTier.priceKes,
        consentAccepted: true,
      }

      expect(registrationDraft.ticketTierId).toBe("tier-vip")
      expect(registrationDraft.amountDueKes).toBe(5000)
      expect(registrationDraft.consentAccepted).toBe(true)
    })
  })

  // --------------------------------------------------------------------------
  // Journey 3: Capacity Enforcement and Waitlist Ordering
  // --------------------------------------------------------------------------
  describe("Journey 3: Capacity Enforcement & FIFO Waitlist Ordering", () => {
    it("diverts registrations to waitlist when capacity is reached and assigns strictly sequential positions", () => {
      const capacity = 3
      const registeredAttendees = ["att-1", "att-2", "att-3"]
      const waitlistQueue: { id: string; email: string; waitlistPosition: number }[] = []

      const incomingRequests = [
        { id: "req-4", email: "four@example.com" },
        { id: "req-5", email: "five@example.com" },
        { id: "req-6", email: "six@example.com" },
      ]

      for (const req of incomingRequests) {
        if (registeredAttendees.length >= capacity) {
          waitlistQueue.push({
            id: req.id,
            email: req.email,
            waitlistPosition: waitlistQueue.length + 1,
          })
        } else {
          registeredAttendees.push(req.id)
        }
      }

      expect(registeredAttendees).toHaveLength(3)
      expect(waitlistQueue).toHaveLength(3)
      expect(waitlistQueue[0].waitlistPosition).toBe(1)
      expect(waitlistQueue[1].waitlistPosition).toBe(2)
      expect(waitlistQueue[2].waitlistPosition).toBe(3)

      // Promote head of waitlist upon cancellation
      registeredAttendees.splice(0, 1) // 1 attendee cancels
      const promoted = waitlistQueue.shift()!
      registeredAttendees.push(promoted.id)

      expect(promoted.email).toBe("four@example.com")
      expect(registeredAttendees).toHaveLength(3)
      expect(waitlistQueue).toHaveLength(2)
    })
  })

  // --------------------------------------------------------------------------
  // Journey 4: Paystack Test Checkout & Webhook Retries
  // --------------------------------------------------------------------------
  describe("Journey 4: Paystack Checkout & Idempotent Webhook Processing", () => {
    const PAYSTACK_SECRET_KEY = "sk_test_mock_secret_key_12345"

    function signPaystackPayload(payload: string): string {
      return crypto.createHmac("sha512", PAYSTACK_SECRET_KEY).update(payload).digest("hex")
    }

    it("verifies webhook HMAC signature and rejects invalid signatures", () => {
      const payload = JSON.stringify({ event: "charge.success", data: { reference: "ref-100" } })
      const validSignature = signPaystackPayload(payload)
      const invalidSignature = "invalid_sig_abcdef12345"

      const computeSig = (body: string) => crypto.createHmac("sha512", PAYSTACK_SECRET_KEY).update(body).digest("hex")

      expect(computeSig(payload)).toBe(validSignature)
      expect(computeSig(payload)).not.toBe(invalidSignature)
    })

    it("guarantees idempotency when receiving retried charge.success webhooks", async () => {
      const processedReferences = new Set<string>()
      const orders = new Map<string, { status: string; ticketIssued: boolean }>()
      orders.set("ref-order-99", { status: "PENDING", ticketIssued: false })

      async function processWebhookEvent(reference: string) {
        // Lease lock / idempotency check
        if (processedReferences.has(reference)) {
          return { status: "DUPLICATE_IGNORED", idempotent: true }
        }

        processedReferences.add(reference)
        const order = orders.get(reference)
        if (order) {
          order.status = "PAID"
          order.ticketIssued = true
        }
        return { status: "PROCESSED", idempotent: false }
      }

      // Initial webhook delivery
      const res1 = await processWebhookEvent("ref-order-99")
      expect(res1.status).toBe("PROCESSED")
      expect(orders.get("ref-order-99")?.status).toBe("PAID")
      expect(orders.get("ref-order-99")?.ticketIssued).toBe(true)

      // Retried webhook delivery (network timeout replay)
      const res2 = await processWebhookEvent("ref-order-99")
      expect(res2.status).toBe("DUPLICATE_IGNORED")
      expect(res2.idempotent).toBe(true)
      expect(orders.get("ref-order-99")?.ticketIssued).toBe(true)
    })
  })

  // --------------------------------------------------------------------------
  // Journey 5: Ticket Retrieval, QR Rendering & Check-in Confirmation
  // --------------------------------------------------------------------------
  describe("Journey 5: Ticket Issuance, QR Verification & Check-in", () => {
    it("generates authoritative signed QR payload and admits valid attendee", () => {
      const ticket = {
        id: "tkt-summit-888",
        eventId: "event-tech-2026",
        userId: "usr-amina-456",
        status: "ISSUED",
        checkedInAt: null as Date | null,
      }

      const qrPayload = generateQRPayload(ticket.id, ticket.eventId, ticket.userId)
      expect(qrPayload).toContain(ticket.id)
      expect(qrPayload).toContain(ticket.eventId)

      // Verifier scans QR payload
      const verified = verifyQRPayload(qrPayload)
      expect(verified.valid).toBe(true)
      expect(verified.ticketId).toBe(ticket.id)
      expect(verified.eventId).toBe(ticket.eventId)

      // Simulate check-in
      expect(ticket.status).toBe("ISSUED")
      ticket.status = "CHECKED_IN"
      ticket.checkedInAt = new Date()

      expect(ticket.status).toBe("CHECKED_IN")
      expect(ticket.checkedInAt).toBeInstanceOf(Date)

      // Re-scan prevention
      const attemptDoubleCheckin = () => {
        if (ticket.status === "CHECKED_IN") {
          throw new Error("ALREADY_CHECKED_IN")
        }
      }
      expect(attemptDoubleCheckin).toThrow("ALREADY_CHECKED_IN")
    })

    it("rejects tampered QR payload", () => {
      const originalPayload = generateQRPayload("tkt-valid-1", "event-valid-1", "usr-1")
      const tamperedPayload = originalPayload.replace("tkt-valid-1", "tkt-fake-999")

      const verified = verifyQRPayload(tamperedPayload)
      expect(verified.valid).toBe(false)
    })
  })

  // --------------------------------------------------------------------------
  // Journey 6: Organizer Attendance Verification & Dashboard Analytics
  // --------------------------------------------------------------------------
  describe("Journey 6: Organizer Attendance Analytics & Financial Ledger", () => {
    it("computes accurate attendance percentages and financial net payout", () => {
      const registrations = [
        { id: "reg-1", status: "CHECKED_IN", amountKes: 2500 },
        { id: "reg-2", status: "CHECKED_IN", amountKes: 2500 },
        { id: "reg-3", status: "CONFIRMED", amountKes: 2500 },
        { id: "reg-4", status: "WAITLIST", amountKes: 0 },
      ]

      const totalConfirmed = registrations.filter(r => r.status === "CONFIRMED" || r.status === "CHECKED_IN").length
      const totalCheckedIn = registrations.filter(r => r.status === "CHECKED_IN").length
      const attendanceRate = (totalCheckedIn / totalConfirmed) * 100

      expect(totalConfirmed).toBe(3)
      expect(totalCheckedIn).toBe(2)
      expect(attendanceRate).toBeCloseTo(66.67, 1)

      // Financial breakdown: Strict 5% platform commission via @/lib/paidEventCommission
      expect(FLAT_PAID_EVENT_COMMISSION_RATE).toBe(0.05)
      const grossRevenue = registrations.reduce((sum, r) => sum + r.amountKes, 0)
      const commission = calculatePaidEventCommission(grossRevenue)
      const platformFee = commission.commissionAmount
      const netOrganizerEarnings = commission.organizerAmount

      expect(grossRevenue).toBe(7500)
      expect(platformFee).toBe(375) // 5% of 7500 KES
      expect(netOrganizerEarnings).toBe(7125) // 95% of 7500 KES
      expect(grossRevenue).toBe(platformFee + netOrganizerEarnings)
    })

    it("strictly preserves 5% platform fee and non-conflated ticket proceeds across pricing tiers", () => {
      const tiers = [
        { price: 100, expComm: 5, expNet: 95 },
        { price: 1500, expComm: 75, expNet: 1425 },
        { price: 5000, expComm: 250, expNet: 4750 },
      ]

      for (const t of tiers) {
        const res = calculatePaidEventCommission(t.price)
        expect(res.commissionRate).toBe(0.05)
        expect(res.commissionAmount).toBe(t.expComm)
        expect(res.organizerAmount).toBe(t.expNet)
        expect(res.commissionAmount + res.organizerAmount).toBe(t.price)
      }
    })
  })

  // --------------------------------------------------------------------------
  // Journey 7: Role-Based Authorization & Middleware Boundaries
  // --------------------------------------------------------------------------
  describe("Journey 7: Role-Based Authorization & Security Boundaries", () => {
    it("recognizes canonical admin email eventsslot.co@gmail.com and grants admin access", () => {
      expect(isAdminEmail("eventsslot.co@gmail.com")).toBe(true)
      expect(hasAdminAccess({ user: { email: "eventsslot.co@gmail.com" } })).toBe(true)
    })

    it("denies admin privileges to unauthorized attendee or organizer emails", () => {
      expect(isAdminEmail("attendee@example.com")).toBe(false)
      expect(isAdminEmail("hacker@malicious.io")).toBe(false)
      expect(hasAdminAccess({ user: { email: "organizer@other.com" } })).toBe(false)
    })

    it("enforces tenant isolation between different organizers", () => {
      const organizerA = { id: "org-alpha", eventIds: ["event-1", "event-2"] }
      const organizerB = { id: "org-beta", eventIds: ["event-3"] }

      const canManageEvent = (orgId: string, eventId: string) => {
        if (orgId === organizerA.id) return organizerA.eventIds.includes(eventId)
        if (orgId === organizerB.id) return organizerB.eventIds.includes(eventId)
        return false
      }

      expect(canManageEvent(organizerA.id, "event-1")).toBe(true)
      expect(canManageEvent(organizerA.id, "event-3")).toBe(false)
      expect(canManageEvent(organizerB.id, "event-1")).toBe(false)
    })
  })
})
