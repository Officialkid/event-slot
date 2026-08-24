import { NextRequest, NextResponse } from "next/server";
import { PaidCheckoutError, startPaidEventOrderPayment } from "@/lib/paidEventCheckout";

export async function POST(request: NextRequest, props: { params: Promise<{ orderId: string }> }) {
  try {
    const { orderId } = await props.params;
    const body = (await request.json().catch(() => null)) as { mpesaPhone?: string } | null;

    if (!orderId || !body?.mpesaPhone) {
      return NextResponse.json({ success: false, error: "Order id and M-Pesa phone are required." }, { status: 400 });
    }

    const result = await startPaidEventOrderPayment(orderId, body.mpesaPhone);
    return NextResponse.json({
      success: true,
      orderId: result.orderId,
      checkoutRequestId: result.checkoutRequestId,
      customerMessage: result.customerMessage,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to start payment.";
    const status = error instanceof PaidCheckoutError ? error.status : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
