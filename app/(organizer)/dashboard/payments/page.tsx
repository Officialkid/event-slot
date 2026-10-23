import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { getOrganizerPaymentsDashboardData } from "@/lib/organizerPayments"
import { OrganizerPaymentsPage } from "@/components/payments/OrganizerPaymentsPage"

export default async function PaymentsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    redirect("/signin")
  }

  const data = await getOrganizerPaymentsDashboardData(session.user.id)

  return <OrganizerPaymentsPage data={data} />
}
