import { redirect } from "next/navigation"
import { cookies } from "next/headers"

interface Props {
  searchParams: Promise<{ ref?: string }>
}

export default async function JoinPage({ searchParams }: Props) {
  const { ref } = await searchParams

  if (ref) {
    const cookieStore = await cookies()
    cookieStore.set("eventslot_ref", ref, {
      maxAge: 7 * 24 * 60 * 60,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    })
  }

  redirect("/signup")
}
