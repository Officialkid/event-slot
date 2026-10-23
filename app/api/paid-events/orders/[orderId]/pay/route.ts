import { NextRequest, NextResponse } from "next/server";
import { PaidCheckoutError, startPaidEventOrderPayment } from "@/lib/paidEventCheckout";

export async function POST(request: NextRequest, props: { params: Promise<{ orderId: string }> }) {
  try {
    const { orderId } = await props.params;
    const body = (await request.json().catch(() => ({}))) as { mpesaPhone?: string } | null;

    if (!orderId) {
      return NextResponse.json({ success: false, error: "Order id is required." }, { status: 400 });
    }

    const result = await startPaidEventOrderPayment(orderId, body?.mpesaPhone);
    return NextResponse.json({
      success: true,
      orderId: result.orderId,
      checkoutRequestId: result.checkoutRequestId,
      url: result.authorizationUrl,
      authorizationUrl: result.authorizationUrl,
      customerMessage: result.customerMessage,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to start payment.";
    const status = error instanceof PaidCheckoutError ? error.status : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
