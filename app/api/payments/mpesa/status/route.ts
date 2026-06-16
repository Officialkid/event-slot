import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { activateSubscriptionPayment, failSubscriptionPayment } from '@/lib/paymentFinalizers';
import { extractInvoiceState, extractProviderReference, getIntaSendPaymentStatus } from '@/lib/intasend';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const url = new URL(req.url);
  const checkoutRequestId = url.searchParams.get('checkoutRequestId');
  if (!checkoutRequestId) {
    return NextResponse.json({ error: 'Missing checkoutRequestId' }, { status: 400 });
  }

  const payment = await prisma.subscriptionPayment.findFirst({
    where: { checkoutRequestId },
  });

  if (!payment) {
    return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
  }

  let status = payment.status
  let providerRef = payment.providerRef
  let paidAt = payment.paidAt

  if (payment.checkoutRequestId && status === 'PENDING') {
    try {
      const providerStatus = await getIntaSendPaymentStatus(payment.checkoutRequestId)
      const state = extractInvoiceState(providerStatus)
      const invoiceProviderRef = extractProviderReference(providerStatus)

      if (state === 'COMPLETE') {
        await activateSubscriptionPayment(payment.id, invoiceProviderRef ?? providerRef)
        status = 'SUCCESS'
        providerRef = invoiceProviderRef ?? providerRef
        paidAt = new Date()
      } else if (state === 'FAILED') {
        await failSubscriptionPayment(payment.id, 'FAILED')
        status = 'FAILED'
      }
    } catch {
      // If IntaSend status lookup fails, fall back to the stored status.
    }
  }

  return NextResponse.json({
    status,
    providerRef,
    paidAt,
  });
}
