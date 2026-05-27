import { redirect } from "next/navigation"

export default async function LegacyEventSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  // Legacy compatibility: /events/[slug] now redirects to public slug route.
  redirect(`/${slug}`)
}
