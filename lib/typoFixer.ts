/**
 * Typo suggestions dictionary and helper for Question prompts and labels.
 */

const COMMON_TYPOS: Record<string, string> = {
  aboyt: "about",
  abotu: "about",
  teh: "the",
  wnat: "want",
  woudl: "would",
  culd: "could",
  shoud: "should",
  pleae: "please",
  plase: "please",
  whaat: "what",
  wht: "what",
  howw: "how",
  whch: "which",
  wiht: "with",
  taht: "that",
  thsi: "this",
  thier: "their",
  there: "their",
  recieve: "receive",
  seperate: "separate",
  attendeees: "attendees",
  atendee: "attendee",
  regsitration: "registration",
  registrtion: "registration",
  registartion: "registration",
  orgnaizer: "organizer",
  organzier: "organizer",
  loaction: "location",
  locaiton: "location",
  schedle: "schedule",
  schdule: "schedule",
  dropdow: "dropdown",
  dropdwon: "dropdown",
  prefered: "preferred",
  occured: "occurred",
  experiance: "experience",
  succesful: "successful",
  catagory: "category",
  requred: "required",
  requierd: "required",
}

export function detectTypoSuggestions(text: string): { original: string; suggestion: string }[] {
  if (!text || typeof text !== "string") return []

  const words = text.split(/[\s,?.!;:()"]+/)
  const found: { original: string; suggestion: string }[] = []
  const seen = new Set<string>()

  for (const rawWord of words) {
    const clean = rawWord.toLowerCase()
    if (!clean || seen.has(clean)) continue
    if (COMMON_TYPOS[clean]) {
      seen.add(clean)
      found.push({ original: rawWord, suggestion: COMMON_TYPOS[clean] })
    }
  }

  return found
}

export function applyTypoCorrection(text: string, original: string, suggestion: string): string {
  const regex = new RegExp(`\\b${original}\\b`, "gi")
  return text.replace(regex, (match) => {
    // Preserve initial capital if match was capitalized
    if (match[0] === match[0].toUpperCase()) {
      return suggestion.charAt(0).toUpperCase() + suggestion.slice(1)
    }
    return suggestion
  })
}
