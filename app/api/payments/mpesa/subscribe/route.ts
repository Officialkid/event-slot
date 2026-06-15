import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { initiateStkPush, normaliseMpesaPhone } from '@/lib/daraja';

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
  const normalisedPhone = normaliseMpesaPhone(phone);
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

  // Build a pending payment record first
  let existingSub = await prisma.subscription.findFirst({
    where: { userId: session.user.id, status: 'ACTIVE' },
  });

  const paymentRecord = await prisma.subscriptionPayment.create({
    data: {
      subscriptionId: existingSub?.id ?? '', // will update after STK
      amountKes,
      amountUsd: priceUsd,
      exchangeRate: kesRate,
      provider: 'mpesa',
      phone: normalisedPhone,
      status: 'PENDING',
    },
  });

  try {
    const stkResponse = await initiateStkPush({
      phone: normalisedPhone,
      amountKes,
      accountReference: 'EventSlot',
      transactionDesc: `${plan.displayName} plan`,
    });

    if (stkResponse.ResponseCode !== '0') {
      await prisma.subscriptionPayment.update({
        where: { id: paymentRecord.id },
        data: { status: 'FAILED' },
      });
      return NextResponse.json(
        { error: 'M-Pesa request failed. Please try again.' },
        { status: 502 }
      );
    }

    // Store CheckoutRequestID so callback can match the payment
    await prisma.subscriptionPayment.update({
      where: { id: paymentRecord.id },
      data: {
        checkoutRequestId: stkResponse.CheckoutRequestID,
        providerRef: stkResponse.MerchantRequestID,
      },
    });

    // Store pending intent on the user's subscription record for callback to find
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        // Store pending upgrade info in a temp field or use a separate PendingUpgrade table
        // Here we use a simple metadata approach via the subscription's lastPaymentRef
      },
    });

    // Store the intended plan in a temp record for the callback to use
    // Use a simple key-value in the payment description field
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
      checkoutRequestId: stkResponse.CheckoutRequestID,
      customerMessage: stkResponse.CustomerMessage,
      amountKes,
      amountUsd: priceUsd,
    });
  } catch (err: any) {
    await prisma.subscriptionPayment.update({
      where: { id: paymentRecord.id },
      data: { status: 'FAILED' },
    });
    console.error('STK Push failed:', err);
    return NextResponse.json({ error: 'Payment initiation failed' }, { status: 500 });
  }
}
