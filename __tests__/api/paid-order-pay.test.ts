/** @jest-environment node */

import { NextRequest } from "next/server";
import { POST } from "@/app/api/paid-events/orders/[orderId]/pay/route";
import { PaidCheckoutError } from "@/lib/paidEventCheckout";

const mockStartPaidEventOrderPayment = jest.fn();

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
    startPaidEventOrderPayment: (...args: unknown[]) => mockStartPaidEventOrderPayment(...args),
    PaidCheckoutError: MockPaidCheckoutError,
  };
});

describe("POST /api/paid-events/orders/[orderId]/pay", () => {
  beforeEach(() => {
    mockStartPaidEventOrderPayment.mockReset();
  });

  it("rejects requests missing an M-Pesa phone number", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/paid-events/orders/order-1/pay", {
        method: "POST",
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ orderId: "order-1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(mockStartPaidEventOrderPayment).not.toHaveBeenCalled();
  });

  it("returns a fresh checkout prompt when payment restart succeeds", async () => {
    mockStartPaidEventOrderPayment.mockResolvedValue({
      orderId: "order-1",
      checkoutRequestId: "invoice-2",
      customerMessage: "Prompt sent.",
    });

    const response = await POST(
      new NextRequest("http://localhost/api/paid-events/orders/order-1/pay", {
        method: "POST",
        body: JSON.stringify({ mpesaPhone: "0712345678" }),
      }),
      { params: Promise.resolve({ orderId: "order-1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      orderId: "order-1",
      checkoutRequestId: "invoice-2",
      customerMessage: "Prompt sent.",
    });
    expect(mockStartPaidEventOrderPayment).toHaveBeenCalledWith("order-1", "0712345678");
  });

  it("propagates payment restart conflicts", async () => {
    mockStartPaidEventOrderPayment.mockRejectedValue(new PaidCheckoutError("This payment offer has expired.", 409));

    const response = await POST(
      new NextRequest("http://localhost/api/paid-events/orders/order-1/pay", {
        method: "POST",
        body: JSON.stringify({ mpesaPhone: "0712345678" }),
      }),
      { params: Promise.resolve({ orderId: "order-1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({
      success: false,
      error: "This payment offer has expired.",
    });
  });
});
