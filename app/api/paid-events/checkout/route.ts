import { NextRequest, NextResponse } from "next/server";
import { beginPaidEventCheckout, PaidCheckoutError } from "@/lib/paidEventCheckout";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as
      | {
          eventSlug?: string;
          ticketTierId?: string;
          attendee?: { answers?: Array<{ questionId: string; value: string }>; baseEmail?: string };
          consentDataProcessing?: boolean;
          consentTransactional?: boolean;
          consentMarketing?: boolean;
          source?: string;
          refCode?: string;
          utmSource?: string;
          mpesaPhone?: string;
        }
      | null;

    if (!body?.eventSlug || !body.ticketTierId || !body.attendee?.answers || !body.mpesaPhone) {
      return NextResponse.json({ success: false, error: "Event, tier, attendee answers, and M-Pesa phone are required." }, { status: 400 });
    }

    const result = await beginPaidEventCheckout({
      eventSlug: body.eventSlug,
      ticketTierId: body.ticketTierId,
      attendee: {
        answers: body.attendee.answers,
        baseEmail: body.attendee.baseEmail,
      },
      mpesaPhone: body.mpesaPhone,
      consentDataProcessing: body.consentDataProcessing,
      consentTransactional: body.consentTransactional,
      consentMarketing: body.consentMarketing,
      source: body.source,
      refCode: body.refCode,
      utmSource: body.utmSource,
      request,
    });

    if (result.kind === "waitlist") {
      return NextResponse.json(
        {
          success: true,
          results: result.results,
          eventTitle: result.eventTitle,
        },
        { status: 201 }
      );
    }

    return NextResponse.json({
      success: true,
      orderId: result.orderId,
      checkoutRequestId: result.checkoutRequestId,
      customerMessage: result.customerMessage,
      amountKes: result.amountKes,
      eventTitle: result.eventTitle,
      ticketTierName: result.ticketTierName,
      paymentMethod: result.paymentMethod,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to start paid checkout.";
    const status = error instanceof PaidCheckoutError ? error.status : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
