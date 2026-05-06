import fs from 'node:fs'
import path from 'node:path'

const repoRoot = process.cwd()
const docPath = path.join(repoRoot, 'docs', 'EVENTSLOT_SYSTEM_DOCUMENTATION.md')

const updatedAt = process.env.DOC_UPDATED_AT ?? new Date().toISOString()
const commitSha = (process.env.DOC_COMMIT_SHA ?? 'unknown').slice(0, 7)
const revision = process.env.DOC_CLOUD_RUN_REVISION ?? 'unknown'
const description = process.env.DOC_CHANGE_DESCRIPTION ?? 'Auto-deploy metadata update'

const startMarker = '<!-- AUTO-DEPLOY-CHANGELOG:START -->'
const endMarker = '<!-- AUTO-DEPLOY-CHANGELOG:END -->'
const lastUpdatedPrefix = '**Last Updated:** '
const newRow = `| ${updatedAt} | ${commitSha} | ${revision} | ${description} |`

const doc = fs.readFileSync(docPath, 'utf8')

if (!doc.includes(startMarker) || !doc.includes(endMarker)) {
  throw new Error('Auto-deploy changelog markers are missing from the canonical system doc.')
}

const updatedDoc = (() => {
  const lines = doc.split(/\r?\n/)
  const nextLines = lines.map((line) =>
    line.startsWith(lastUpdatedPrefix)
      ? `${lastUpdatedPrefix}${updatedAt} — Commit: ${commitSha} — Revision: ${revision}`
      : line
  )

  const withUpdatedLine = nextLines.join('\n')
  const startIndex = withUpdatedLine.indexOf(startMarker)
  const endIndex = withUpdatedLine.indexOf(endMarker)

  const before = withUpdatedLine.slice(0, startIndex + startMarker.length)
  const middle = withUpdatedLine.slice(startIndex + startMarker.length, endIndex)
  const after = withUpdatedLine.slice(endIndex)

  const existingRows = middle
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => line !== '| — | — | — | Auto-deploy entries will be prepended here by GitHub Actions |')

  const dedupedRows = existingRows.filter((line) => line !== newRow)
  const nextRows = [newRow, ...dedupedRows]

  return `${before}\n${nextRows.join('\n')}\n${after}`
})()

if (updatedDoc !== doc) {
  fs.writeFileSync(docPath, updatedDoc, 'utf8')
}

process.stdout.write(`Updated ${path.relative(repoRoot, docPath)}\n`)