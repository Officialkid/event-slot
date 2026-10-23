import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isBillingCheckoutEnabled, getBillingComingSoonHeadline } from '@/lib/pricingRollout';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  if (!isBillingCheckoutEnabled()) {
    return NextResponse.json(
      { error: getBillingComingSoonHeadline() },
      { status: 403 }
    );
  }

  return NextResponse.json(
    { error: 'IntaSend M-Pesa subscription checkout has been decommissioned.' },
    { status: 410 }
  );
}
