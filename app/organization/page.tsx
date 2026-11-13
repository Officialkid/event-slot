import { permanentRedirect } from "next/navigation"

export default function OrganizationSingularRedirect() {
  permanentRedirect("/organizations")
}
