export type TierPreset = {
  key: string
  defaultName: string
  badgeColor: string
  textColor: string
  metallic: boolean
  prestige: number
}

export const TIER_PRESETS: TierPreset[] = [
  { key: "REGULAR", defaultName: "Regular", badgeColor: "#A8A9AD", textColor: "#1A1A1A", metallic: false, prestige: 1 },
  { key: "STANDARD", defaultName: "Standard", badgeColor: "#A8A9AD", textColor: "#1A1A1A", metallic: false, prestige: 2 },
  { key: "EARLY_BIRD", defaultName: "Early Bird", badgeColor: "#0D9488", textColor: "#FFFFFF", metallic: false, prestige: 2 },
  { key: "STUDENT", defaultName: "Student", badgeColor: "#38BDF8", textColor: "#1A1A1A", metallic: false, prestige: 2 },
  { key: "BRONZE", defaultName: "Bronze", badgeColor: "#CD7F32", textColor: "#FFFFFF", metallic: true, prestige: 3 },
  { key: "VIP", defaultName: "VIP", badgeColor: "#FFD700", textColor: "#1A1A1A", metallic: true, prestige: 5 },
  { key: "GOLD", defaultName: "Gold", badgeColor: "#FFD700", textColor: "#1A1A1A", metallic: true, prestige: 5 },
  { key: "VVIP", defaultName: "VVIP", badgeColor: "#E5E4E2", textColor: "#1A1A1A", metallic: true, prestige: 7 },
  { key: "PLATINUM", defaultName: "Platinum", badgeColor: "#E5E4E2", textColor: "#1A1A1A", metallic: true, prestige: 7 },
  { key: "TABLE", defaultName: "Table of 5", badgeColor: "#6B21A8", textColor: "#FFFFFF", metallic: false, prestige: 8 },
  { key: "DIAMOND", defaultName: "Diamond", badgeColor: "#B9F2FF", textColor: "#1A1A1A", metallic: true, prestige: 9 },
  { key: "BACKSTAGE", defaultName: "Backstage", badgeColor: "#1A1A1A", textColor: "#FFFFFF", metallic: false, prestige: 10 },
]

export const TIER_PRESET_COLOR_PALETTE = Array.from(
  new Set(TIER_PRESETS.map((preset) => preset.badgeColor))
)

export function getBadgeTextColor(hexColor: string): string {
  const normalized = hexColor.trim().replace(/^#/, "")
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return "#FFFFFF"
  const r = parseInt(normalized.slice(0, 2), 16)
  const g = parseInt(normalized.slice(2, 4), 16)
  const b = parseInt(normalized.slice(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5 ? "#1A1A1A" : "#FFFFFF"
}

export function normalizeBadgeColor(value: string | null | undefined): string {
  const normalized = (value ?? "").trim()
  if (/^#[0-9a-fA-F]{6}$/.test(normalized)) return normalized.toUpperCase()
  return "#A8A9AD"
}

export function getTierPreset(key: string | null | undefined): TierPreset | null {
  if (!key) return null
  return TIER_PRESETS.find((preset) => preset.key === key) ?? null
}

export function resolveTierBadgeFields(input: {
  name: string
  presetKey?: string | null
  badgeColor?: string | null
  metallic?: boolean | null
  prestige?: number | null
}) {
  const preset = getTierPreset(input.presetKey)
  if (preset) {
    return {
      presetKey: preset.key,
      name: input.name?.trim() || preset.defaultName,
      badgeColor: preset.badgeColor,
      textColor: preset.textColor,
      metallic: preset.metallic,
      prestige: preset.prestige,
    }
  }

  const badgeColor = normalizeBadgeColor(input.badgeColor)
  return {
    presetKey: null,
    name: input.name.trim(),
    badgeColor,
    textColor: getBadgeTextColor(badgeColor),
    metallic: Boolean(input.metallic),
    prestige: Math.max(0, input.prestige ?? 0),
  }
}
