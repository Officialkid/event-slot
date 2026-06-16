import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { normalizeMpesaPhone, startIntaSendStkPush } from '@/lib/intasend';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const body = await req.json();
  const { planName, billingCycle, phone } = body as {
    planName: string;
    billingCycle: 'monthly' | 'annual';
    phone: string;
  };

  if (!planName || !billingCycle || !phone) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Validate phone
  const normalisedPhone = normalizeMpesaPhone(phone);
  if (!/^2547\d{8}$/.test(normalisedPhone) && !/^2541\d{8}$/.test(normalisedPhone)) {
    return NextResponse.json({ error: 'Invalid M-Pesa phone number' }, { status: 400 });
  }

  const plan = await prisma.plan.findUnique({ where: { name: planName } });
  if (!plan || plan.name === 'free') {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
  }

  // Calculate amount in KES
  const kesRate = parseFloat(process.env.KES_USD_RATE ?? '130');
  const priceUsd = billingCycle === 'annual' ? plan.annualPriceUsd : plan.monthlyPriceUsd;
  const amountKes = Math.ceil(priceUsd * kesRate);
  const now = new Date();

  // Build a pending payment record first
  const existingSub = await prisma.subscription.findFirst({
    where: { userId: session.user.id, status: 'ACTIVE' },
  });
  const subscription = existingSub ?? await prisma.subscription.create({
    data: {
      userId: session.user.id,
      planId: plan.id,
      billingCycle: billingCycle === 'annual' ? 'ANNUAL' : 'MONTHLY',
      status: 'PAST_DUE',
      currentPeriodStart: now,
      currentPeriodEnd: now,
      paymentProvider: 'intasend',
      mpesaPhone: normalisedPhone,
    },
  });

  const paymentRecord = await prisma.subscriptionPayment.create({
    data: {
      subscriptionId: subscription.id,
      amountKes,
      amountUsd: priceUsd,
      exchangeRate: kesRate,
      provider: 'intasend',
      phone: normalisedPhone,
      status: 'PENDING',
    },
  });

  const paymentApiRef = `subpay_${paymentRecord.id}`;

  try {
    const stkResponse = await startIntaSendStkPush({
      apiRef: paymentApiRef,
      phone: normalisedPhone,
      amountKes,
      email: session.user.email ?? `${session.user.id}@eventslot.local`,
      name: session.user.name?.trim() || 'EventSlot User',
    });

    await prisma.subscriptionPayment.update({
      where: { id: paymentRecord.id },
      data: {
        checkoutRequestId: stkResponse.invoiceId,
        providerRef: paymentApiRef,
      },
    });

    await prisma.subscriptionPayment.update({
      where: { id: paymentRecord.id },
      data: {
        description: JSON.stringify({
          userId: session.user.id,
          planId: plan.id,
          billingCycle: billingCycle.toUpperCase(),
          priceUsd,
          amountKes,
          kesRate,
          phone: normalisedPhone,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      checkoutRequestId: stkResponse.invoiceId,
      customerMessage: 'Check your phone to complete payment.',
      amountKes,
      amountUsd: priceUsd,
    });
  } catch (err) {
    await prisma.subscriptionPayment.update({
      where: { id: paymentRecord.id },
      data: { status: 'FAILED' },
    });
    console.error('STK Push failed:', err);
    return NextResponse.json({ error: 'Payment initiation failed' }, { status: 500 });
  }
}
