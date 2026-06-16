import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const startMarker = '<!-- AUTO-DEPLOY-CHANGELOG:START -->'
const endMarker = '<!-- AUTO-DEPLOY-CHANGELOG:END -->'
const lastUpdatedPrefix = '**Last Updated:** '
const placeholderRow = '| â€” | â€” | â€” | Auto-deploy entries will be prepended here by GitHub Actions |'

function resolveConfig(env) {
  const updatedAt = env.DOC_UPDATED_AT ?? new Date().toISOString()
  const commitSha = (env.DOC_COMMIT_SHA ?? 'unknown').slice(0, 7)
  const revision = env.DOC_CLOUD_RUN_REVISION ?? 'unknown'
  const description = env.DOC_CHANGE_DESCRIPTION ?? 'Auto-deploy metadata update'
  const newRow = `| ${updatedAt} | ${commitSha} | ${revision} | ${description} |`

  return {
    updatedAt,
    commitSha,
    revision,
    newRow,
  }
}

export function updateSystemDocs({
  repoRoot = process.cwd(),
  env = process.env,
} = {}) {
  const docPath = path.join(repoRoot, 'docs', 'EVENTSLOT_SYSTEM_DOCUMENTATION.md')
  const { updatedAt, commitSha, revision, newRow } = resolveConfig(env)
  const doc = fs.readFileSync(docPath, 'utf8')

  if (!doc.includes(startMarker) || !doc.includes(endMarker)) {
    throw new Error('Auto-deploy changelog markers are missing from the canonical system doc.')
  }

  const lines = doc.split(/\r?\n/)
  const nextLines = lines.map((line) =>
    line.startsWith(lastUpdatedPrefix)
      ? `${lastUpdatedPrefix}${updatedAt} â€” Commit: ${commitSha} â€” Revision: ${revision}`
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
    .filter((line) => line !== placeholderRow)

  const dedupedRows = existingRows.filter((line) => line !== newRow)
  const updatedDoc = `${before}\n${[newRow, ...dedupedRows].join('\n')}\n${after}`

  if (updatedDoc !== doc) {
    fs.writeFileSync(docPath, updatedDoc, 'utf8')
  }

  return {
    docPath,
    updatedDoc,
    changed: updatedDoc !== doc,
  }
}

const currentFilePath = fileURLToPath(import.meta.url)
const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null

if (invokedPath && invokedPath === currentFilePath) {
  try {
    const { docPath } = updateSystemDocs()
    process.stdout.write(`Updated ${path.relative(process.cwd(), docPath)}\n`)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update system documentation.'
    process.stderr.write(`${message}\n`)
    process.exitCode = 1
  }
}
