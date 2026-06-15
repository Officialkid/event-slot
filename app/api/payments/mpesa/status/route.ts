import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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

  return NextResponse.json({
    status: payment.status,          // PENDING | SUCCESS | FAILED | CANCELLED
    providerRef: payment.providerRef,
    paidAt: payment.paidAt,
  });
}
