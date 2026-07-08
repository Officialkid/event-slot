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

const CHANGELOG_PATH = path.join(process.cwd(), "docs", "CHANGELOG.md")
const DEPLOY_LOG_PATH = path.join(process.cwd(), "docs-site", "pages", "appendix", "changelog.mdx")
const DASH_SEPARATOR_PATTERN = "(?:—|â€”|-)"
const CHANGELOG_HEADER_REGEX = new RegExp(`^##\\s+\\[([^\\]]+)\\]\\s+${DASH_SEPARATOR_PATTERN}\\s+(.+)$`)
const DEPLOY_HEADER_REGEX = new RegExp(`^##\\s+Deploy\\s+${DASH_SEPARATOR_PATTERN}\\s+(.+)\\s+\\(([^)]+)\\)$`)

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

async function parseChangelog() {
  const text = await fs.readFile(CHANGELOG_PATH, "utf8")
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
  const text = await fs.readFile(DEPLOY_LOG_PATH, "utf8")
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

export async function getAdminUpdates() {
  const [changelog, deploys] = await Promise.all([parseChangelog(), parseDeployLog()])
  return [...deploys, ...changelog]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 25)
}
