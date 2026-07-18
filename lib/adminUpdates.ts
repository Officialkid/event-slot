import fs from "node:fs/promises"
import path from "node:path"

type AdminUpdateSource = "changelog" | "deploy"

export type AdminUpdateItem = {
  date: Date
  dateLabel: string
  slug: string
  source: AdminUpdateSource
  title: string
  summary?: string
  points: string[]
  version?: string
}

export type AdminDeployStatus = {
  documentedAt: string | null
  documentedCommit: string | null
  documentedRevision: string | null
  latestDeployEntry: AdminUpdateItem | null
  notes: string[]
}

const CHANGELOG_PATH = path.join(process.cwd(), "docs", "CHANGELOG.md")
const DEPLOY_LOG_PATH = path.join(process.cwd(), "docs-site", "pages", "appendix", "changelog.mdx")
const SYSTEM_DOC_PATH = path.join(process.cwd(), "docs", "EVENTSLOT_SYSTEM_DOCUMENTATION.md")
const DASH_SEPARATOR_PATTERN = "(?:â€”|Ã¢â‚¬â€|-)"
const CHANGELOG_HEADER_REGEX = new RegExp(`^##\\s+\\[([^\\]]+)\\]\\s+${DASH_SEPARATOR_PATTERN}\\s+(.+)$`)
const DEPLOY_HEADER_REGEX = new RegExp(`^##\\s+Deploy\\s+${DASH_SEPARATOR_PATTERN}\\s+(.+)\\s+\\(([^)]+)\\)$`)
const SYSTEM_DOC_STATUS_REGEX = /\*\*Last Updated:\*\*\s*(.+?)\s*(?:â€”|Ã¢â‚¬â€|-)\s*Commit:\s*([A-Za-z0-9]+)\s*(?:â€”|Ã¢â‚¬â€|-)\s*Revision:\s*([^\s]+)/i

function monthIndex(month: string) {
  const months = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"]
  return months.indexOf(month.toLowerCase())
}

function parseDateLabel(label: string) {
  const match = label.trim().match(/^([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})$/)
  if (!match) return new Date(0)

  const [, month, day, year] = match
  const monthNumber = monthIndex(month)
  if (monthNumber < 0) return new Date(0)

  return new Date(Date.UTC(Number(year), monthNumber, Number(day)))
}

function parseFlexibleDate(label: string | null | undefined) {
  if (!label) return new Date(0)

  const fallback = parseDateLabel(label)
  if (fallback.getTime() > 0) return fallback

  const timestamp = Date.parse(label)
  return Number.isNaN(timestamp) ? new Date(0) : new Date(timestamp)
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function cleanBullet(line: string) {
  return line.replace(/^\s*-\s*/, "").trim()
}

function cleanBlockquote(line: string) {
  return line.replace(/^\s*>\s*/, "").trim()
}

function trimMd(value: string) {
  return value.replace(/\*\*/g, "").replace(/`/g, "").trim()
}

async function readOptionalText(filePath: string) {
  try {
    return await fs.readFile(filePath, "utf8")
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null
    throw error
  }
}

async function parseChangelog() {
  const text = await readOptionalText(CHANGELOG_PATH)
  if (!text) return []
  const lines = text.split(/\r?\n/)
  const items: AdminUpdateItem[] = []

  let current: AdminUpdateItem | null = null
  let inSection = false

  for (const rawLine of lines) {
    const line = rawLine.trim()
    const versionMatch = line.match(CHANGELOG_HEADER_REGEX)

    if (versionMatch) {
      if (current) items.push(current)

      const [, version, dateLabel] = versionMatch
      current = {
        date: parseDateLabel(dateLabel),
        dateLabel,
        slug: `${version}-${slugify(dateLabel)}`,
        source: "changelog",
        title: `Release ${version}`,
        summary: undefined,
        points: [],
        version,
      }
      inSection = false
      continue
    }

    if (!current) continue

    const sectionMatch = line.match(/^###\s+(.+)$/)
    if (sectionMatch) {
      current.title = trimMd(sectionMatch[1])
      current.slug = `${current.version ?? "release"}-${slugify(current.title)}`
      inSection = true
      continue
    }

    if (!inSection) continue
    if (!line || line === "---") continue

    if (line.startsWith("- ")) {
      current.points.push(trimMd(cleanBullet(line)))
      continue
    }

    if (!current.summary && !line.startsWith("**")) {
      current.summary = trimMd(line)
    }
  }

  if (current) items.push(current)

  return items.filter((item) => item.title && (item.summary || item.points.length > 0))
}

async function parseDeployLog() {
  const text = await readOptionalText(DEPLOY_LOG_PATH)
  if (!text) return []
  const lines = text.split(/\r?\n/)
  const items: AdminUpdateItem[] = []
  let current: AdminUpdateItem | null = null

  for (const rawLine of lines) {
    const line = rawLine.trim()
    const deployMatch = line.match(DEPLOY_HEADER_REGEX)

    if (deployMatch) {
      if (current) items.push(current)

      const [, dateLabel, version] = deployMatch
      current = {
        date: parseDateLabel(dateLabel),
        dateLabel,
        slug: `${version}-${slugify(dateLabel)}`,
        source: "deploy",
        title: `Deploy ${version}`,
        summary: undefined,
        points: [],
        version,
      }
      continue
    }

    if (!current || !line || line === "---") continue

    if (line.startsWith(">")) {
      const summary = trimMd(cleanBlockquote(line))
      if (!current.summary) {
        current.summary = summary
      } else {
        current.points.push(summary)
      }
    }
  }

  if (current) items.push(current)
  return items
}

async function parseSystemDocStatus() {
  const text = await readOptionalText(SYSTEM_DOC_PATH)
  if (!text) {
    return {
      documentedAt: null,
      documentedCommit: null,
      documentedRevision: null,
    }
  }
  const match = text.match(SYSTEM_DOC_STATUS_REGEX)

  if (!match) {
    return {
      documentedAt: null,
      documentedCommit: null,
      documentedRevision: null,
    }
  }

  return {
    documentedAt: match[1]?.trim() ?? null,
    documentedCommit: match[2]?.trim() ?? null,
    documentedRevision: match[3]?.trim() ?? null,
  }
}

export async function getAdminUpdates() {
  const [changelog, deploys] = await Promise.all([parseChangelog(), parseDeployLog()])
  return [...deploys, ...changelog]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 25)
}

export async function getAdminDeployStatus(): Promise<AdminDeployStatus> {
  const [systemDocStatus, deploys] = await Promise.all([parseSystemDocStatus(), parseDeployLog()])
  const latestDeployEntry = [...deploys].sort((a, b) => b.date.getTime() - a.date.getTime())[0] ?? null
  const notes: string[] = []

  if (!systemDocStatus.documentedRevision || !systemDocStatus.documentedCommit) {
    notes.push("The canonical system document is missing deploy metadata.")
  }

  if (latestDeployEntry?.version && systemDocStatus.documentedRevision && latestDeployEntry.version !== systemDocStatus.documentedRevision) {
    notes.push("The latest deploy log entry does not match the revision stamped into the main system document.")
  }

  if (latestDeployEntry && systemDocStatus.documentedAt && parseFlexibleDate(latestDeployEntry.dateLabel).getTime() > parseFlexibleDate(systemDocStatus.documentedAt).getTime()) {
    notes.push("The deploy timeline looks newer than the canonical system document header, so production status may be stale.")
  }

  if (notes.length === 0) {
    notes.push("Deploy metadata is internally consistent across the changelog sources currently checked in the repo.")
  }

  return {
    ...systemDocStatus,
    latestDeployEntry,
    notes,
  }
}
