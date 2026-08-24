/** @jest-environment node */

import { NextRequest } from "next/server";
import { POST } from "@/app/api/paid-events/checkout/route";
import { PaidCheckoutError } from "@/lib/paidEventCheckout";

const mockBeginPaidEventCheckout = jest.fn();

jest.mock("@/lib/paidEventCheckout", () => {
  class MockPaidCheckoutError extends Error {
    status: number;

    constructor(message: string, status = 400) {
      super(message);
      this.name = "PaidCheckoutError";
      this.status = status;
    }
  }

  return {
    __esModule: true,
    beginPaidEventCheckout: (...args: unknown[]) => mockBeginPaidEventCheckout(...args),
    PaidCheckoutError: MockPaidCheckoutError,
  };
});

describe("POST /api/paid-events/checkout", () => {
  beforeEach(() => {
    mockBeginPaidEventCheckout.mockReset();
  });

  it("rejects requests missing required checkout fields", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/paid-events/checkout", {
        method: "POST",
        body: JSON.stringify({
          eventSlug: "test-event",
          attendee: { answers: [{ questionId: "email", value: "user@test.com" }] },
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(mockBeginPaidEventCheckout).not.toHaveBeenCalled();
  });

  it("returns checkout details when payment initiation succeeds", async () => {
    mockBeginPaidEventCheckout.mockResolvedValue({
      kind: "checkout",
      orderId: "order-1",
      checkoutRequestId: "invoice-1",
      eventTitle: "Summit",
      ticketTierName: "VIP",
      amountKes: 2500,
      paymentMethod: "mpesa",
      customerMessage: "Approve the prompt.",
    });

    const response = await POST(
      new NextRequest("http://localhost/api/paid-events/checkout", {
        method: "POST",
        body: JSON.stringify({
          eventSlug: "summit",
          ticketTierId: "tier-1",
          attendee: { answers: [{ questionId: "email", value: "user@test.com" }] },
          mpesaPhone: "0712345678",
          consentDataProcessing: true,
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      orderId: "order-1",
      checkoutRequestId: "invoice-1",
      eventTitle: "Summit",
      ticketTierName: "VIP",
      amountKes: 2500,
      paymentMethod: "mpesa",
    });
    expect(mockBeginPaidEventCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        eventSlug: "summit",
        ticketTierId: "tier-1",
        mpesaPhone: "0712345678",
        consentDataProcessing: true,
      })
    );
  });

  it("returns waitlist success payloads with created status", async () => {
    mockBeginPaidEventCheckout.mockResolvedValue({
      kind: "waitlist",
      eventTitle: "Summit",
      results: [
        {
          status: "waitlist",
          waitlistPosition: 3,
          registrationId: "reg-1",
          registrationNumber: 42,
        },
      ],
    });

    const response = await POST(
      new NextRequest("http://localhost/api/paid-events/checkout", {
        method: "POST",
        body: JSON.stringify({
          eventSlug: "summit",
          ticketTierId: "tier-1",
          attendee: { answers: [{ questionId: "email", value: "user@test.com" }] },
          mpesaPhone: "0712345678",
          consentDataProcessing: true,
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toEqual({
      success: true,
      eventTitle: "Summit",
      results: [
        {
          status: "waitlist",
          waitlistPosition: 3,
          registrationId: "reg-1",
          registrationNumber: 42,
        },
      ],
    });
  });

  it("propagates paid checkout validation statuses", async () => {
    mockBeginPaidEventCheckout.mockRejectedValue(new PaidCheckoutError("Tier is full.", 409));

    const response = await POST(
      new NextRequest("http://localhost/api/paid-events/checkout", {
        method: "POST",
        body: JSON.stringify({
          eventSlug: "summit",
          ticketTierId: "tier-1",
          attendee: { answers: [{ questionId: "email", value: "user@test.com" }] },
          mpesaPhone: "0712345678",
          consentDataProcessing: true,
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({ success: false, error: "Tier is full." });
  });
});
