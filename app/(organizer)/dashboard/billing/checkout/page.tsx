import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { SubscriptionCheckoutPage } from "@/components/billing/SubscriptionCheckoutPage"
import { SUBSCRIPTION_PLANS, getSubscriptionPlan } from "@/lib/subscriptionPlans"
import { normalizeBillingCycle } from "@/lib/subscriptionBilling"

export default async function BillingCheckoutRoute({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    redirect("/signin?callbackUrl=/dashboard/billing/checkout")
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      email: true,
      plan: true,
    },
  })

  const params = (await searchParams) ?? {}
  const planParam = Array.isArray(params.plan) ? params.plan[0] : params.plan
  const cycleParam = Array.isArray(params.cycle) ? params.cycle[0] : params.cycle
  const initialPlan = getSubscriptionPlan(planParam)
  const initialBillingCycle = normalizeBillingCycle(cycleParam)

  return (
    <SubscriptionCheckoutPage
      plans={SUBSCRIPTION_PLANS.filter((plan) => plan.key !== "free")}
      currentPlanKey={getSubscriptionPlan(user?.plan).key}
      initialPlanKey={initialPlan.key === "free" ? "pro" : initialPlan.key}
      initialBillingCycle={initialBillingCycle}
      accountName={user?.name?.trim() || "EventSlot account"}
      accountEmail={user?.email?.trim() || session.user.email || ""}
    />
  )
}
