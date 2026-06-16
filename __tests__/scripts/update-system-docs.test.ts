/**
 * @jest-environment node
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const SCRIPT_PATH = path.resolve(process.cwd(), 'scripts', 'update-system-docs.mjs')

function buildMinimalDoc(opts: {
  placeholderRow?: string
  extraRows?: string[]
} = {}): string {
  const placeholderRow =
    opts.placeholderRow ??
    '| â€” | â€” | â€” | Auto-deploy entries will be prepended here by GitHub Actions |'

  const staticRows = opts.extraRows ? opts.extraRows.join('\n') : ''

  return [
    '# EventSlot â€” Live System Documentation',
    '**Last Updated:** 2026-01-01T00:00:00Z â€” Commit: oldsha â€” Revision: rev-old',
    '',
    '## 15. Changelog',
    '| Date | Commit | Revision | Description |',
    '|---|---|---|---|',
    '| 2026-01-01 | bootstrap | rev-0 | Initial bootstrap |',
    staticRows,
    '<!-- AUTO-DEPLOY-CHANGELOG:START -->',
    placeholderRow,
    '<!-- AUTO-DEPLOY-CHANGELOG:END -->',
    '',
    '**End of EventSlot System Documentation**',
  ]
    .filter((line) => line !== '')
    .join('\n')
}

async function runUpdater(
  docContent: string,
  env: Record<string, string>
): Promise<{ output: string; exitCode: number; stderr: string }> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eventslot-docs-test-'))
  const docsDir = path.join(tmpDir, 'docs')
  fs.mkdirSync(docsDir)
  const docPath = path.join(docsDir, 'EVENTSLOT_SYSTEM_DOCUMENTATION.md')
  fs.writeFileSync(docPath, docContent, 'utf8')

  try {
    const { updateSystemDocs } = await import(pathToFileURL(SCRIPT_PATH).href)
    updateSystemDocs({ repoRoot: tmpDir, env: { ...process.env, ...env } })

    return {
      output: fs.readFileSync(docPath, 'utf8'),
      exitCode: 0,
      stderr: '',
    }
  } catch (error) {
    return {
      output: '',
      exitCode: 1,
      stderr: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

const TEST_ENV = {
  DOC_UPDATED_AT: '2026-06-01T08:00:00Z',
  DOC_COMMIT_SHA: 'deadbeef12345678',
  DOC_CLOUD_RUN_REVISION: 'eventslot-web-00042-xyz',
  DOC_CHANGE_DESCRIPTION: 'Test deploy',
}

const EXPECTED_ROW =
  '| 2026-06-01T08:00:00Z | deadbee | eventslot-web-00042-xyz | Test deploy |'

describe('update-system-docs.mjs', () => {
  it('exits 0 on a valid document', async () => {
    const { exitCode } = await runUpdater(buildMinimalDoc(), TEST_ENV)
    expect(exitCode).toBe(0)
  })

  it('stamps the Last Updated line with deploy metadata', async () => {
    const { output } = await runUpdater(buildMinimalDoc(), TEST_ENV)
    expect(output).toContain(
      '**Last Updated:** 2026-06-01T08:00:00Z â€” Commit: deadbee â€” Revision: eventslot-web-00042-xyz'
    )
  })

  it('replaces the old Last Updated value (does not leave stale date)', async () => {
    const { output } = await runUpdater(buildMinimalDoc(), TEST_ENV)
    expect(output).not.toContain('Commit: oldsha')
  })

  it('prepends a new row inside the auto-deploy changelog markers', async () => {
    const { output } = await runUpdater(buildMinimalDoc(), TEST_ENV)
    const start = output.indexOf('<!-- AUTO-DEPLOY-CHANGELOG:START -->')
    const end = output.indexOf('<!-- AUTO-DEPLOY-CHANGELOG:END -->')
    expect(start).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)
    const block = output.slice(start, end)
    expect(block).toContain(EXPECTED_ROW)
  })

  it('preserves both marker comments verbatim', async () => {
    const { output } = await runUpdater(buildMinimalDoc(), TEST_ENV)
    expect(output).toContain('<!-- AUTO-DEPLOY-CHANGELOG:START -->')
    expect(output).toContain('<!-- AUTO-DEPLOY-CHANGELOG:END -->')
  })

  it('removes the placeholder row once a real entry is added', async () => {
    const { output } = await runUpdater(buildMinimalDoc(), TEST_ENV)
    expect(output).not.toContain('Auto-deploy entries will be prepended here by GitHub Actions')
  })

  it('does not duplicate the row when run twice with the same metadata', async () => {
    const { output: firstPass } = await runUpdater(buildMinimalDoc(), TEST_ENV)
    const { output: secondPass } = await runUpdater(firstPass, TEST_ENV)
    const count = secondPass.split(EXPECTED_ROW).length - 1
    expect(count).toBe(1)
  })

  it('preserves static changelog rows that live outside the auto-managed block', async () => {
    const { output } = await runUpdater(buildMinimalDoc(), TEST_ENV)
    expect(output).toContain('| 2026-01-01 | bootstrap | rev-0 | Initial bootstrap |')
  })

  it('exits non-zero and reports an error when markers are missing', async () => {
    const noMarkers = buildMinimalDoc()
      .replace('<!-- AUTO-DEPLOY-CHANGELOG:START -->\n', '')
      .replace('\n<!-- AUTO-DEPLOY-CHANGELOG:END -->', '')
    const { exitCode, stderr } = await runUpdater(noMarkers, TEST_ENV)
    expect(exitCode).not.toBe(0)
    expect(stderr).toMatch(/markers are missing/i)
  })
})
