import { permanentRedirect } from "next/navigation"

export default function ForUniversitiesRedirect() {
  permanentRedirect("/organizations")
}
