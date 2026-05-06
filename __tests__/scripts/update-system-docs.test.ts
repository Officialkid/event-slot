/**
 * @jest-environment node
 *
 * Tests for scripts/update-system-docs.mjs
 *
 * Uses child_process.spawnSync to invoke the real script as a subprocess so the
 * test exercises the full execution path — including file I/O and env-var reading —
 * without needing to mock process.cwd() or wrestle with dynamic ESM imports.
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SCRIPT_PATH = path.resolve(process.cwd(), 'scripts', 'update-system-docs.mjs')

function buildMinimalDoc(opts: {
  placeholderRow?: string
  extraRows?: string[]
} = {}): string {
  const placeholderRow =
    opts.placeholderRow ??
    '| — | — | — | Auto-deploy entries will be prepended here by GitHub Actions |'

  const staticRows = opts.extraRows
    ? opts.extraRows.map((r) => r).join('\n')
    : ''

  return [
    '# EventSlot — Live System Documentation',
    '**Last Updated:** 2026-01-01T00:00:00Z — Commit: oldsha — Revision: rev-old',
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

function runUpdater(
  docContent: string,
  env: Record<string, string>
): { output: string; exitCode: number; stderr: string } {
  // Set up a temp dir that mirrors the repo structure the script expects:
  //   <tmpDir>/docs/EVENTSLOT_SYSTEM_DOCUMENTATION.md
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eventslot-docs-test-'))
  const docsDir = path.join(tmpDir, 'docs')
  fs.mkdirSync(docsDir)
  const docPath = path.join(docsDir, 'EVENTSLOT_SYSTEM_DOCUMENTATION.md')
  fs.writeFileSync(docPath, docContent, 'utf8')

  const result = spawnSync('node', [SCRIPT_PATH], {
    cwd: tmpDir,
    env: { ...process.env, ...env },
    encoding: 'utf8',
  })

  const output = result.status === 0 ? fs.readFileSync(docPath, 'utf8') : ''
  return {
    output,
    exitCode: result.status ?? 1,
    stderr: result.stderr ?? '',
  }
}

// ---------------------------------------------------------------------------
// Shared test metadata
// ---------------------------------------------------------------------------

const TEST_ENV = {
  DOC_UPDATED_AT: '2026-06-01T08:00:00Z',
  DOC_COMMIT_SHA: 'deadbeef12345678',
  DOC_CLOUD_RUN_REVISION: 'eventslot-web-00042-xyz',
  DOC_CHANGE_DESCRIPTION: 'Test deploy',
}

const EXPECTED_ROW =
  '| 2026-06-01T08:00:00Z | deadbee | eventslot-web-00042-xyz | Test deploy |'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('update-system-docs.mjs', () => {
  it('exits 0 on a valid document', () => {
    const { exitCode } = runUpdater(buildMinimalDoc(), TEST_ENV)
    expect(exitCode).toBe(0)
  })

  it('stamps the Last Updated line with deploy metadata', () => {
    const { output } = runUpdater(buildMinimalDoc(), TEST_ENV)
    expect(output).toContain(
      '**Last Updated:** 2026-06-01T08:00:00Z — Commit: deadbee — Revision: eventslot-web-00042-xyz'
    )
  })

  it('replaces the old Last Updated value (does not leave stale date)', () => {
    const { output } = runUpdater(buildMinimalDoc(), TEST_ENV)
    expect(output).not.toContain('Commit: oldsha')
  })

  it('prepends a new row inside the auto-deploy changelog markers', () => {
    const { output } = runUpdater(buildMinimalDoc(), TEST_ENV)
    const start = output.indexOf('<!-- AUTO-DEPLOY-CHANGELOG:START -->')
    const end = output.indexOf('<!-- AUTO-DEPLOY-CHANGELOG:END -->')
    expect(start).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)
    const block = output.slice(start, end)
    expect(block).toContain(EXPECTED_ROW)
  })

  it('preserves both marker comments verbatim', () => {
    const { output } = runUpdater(buildMinimalDoc(), TEST_ENV)
    expect(output).toContain('<!-- AUTO-DEPLOY-CHANGELOG:START -->')
    expect(output).toContain('<!-- AUTO-DEPLOY-CHANGELOG:END -->')
  })

  it('removes the placeholder row once a real entry is added', () => {
    const { output } = runUpdater(buildMinimalDoc(), TEST_ENV)
    expect(output).not.toContain(
      'Auto-deploy entries will be prepended here by GitHub Actions'
    )
  })

  it('does not duplicate the row when run twice with the same metadata', () => {
    const { output: firstPass } = runUpdater(buildMinimalDoc(), TEST_ENV)
    const { output: secondPass } = runUpdater(firstPass, TEST_ENV)
    const count = secondPass.split(EXPECTED_ROW).length - 1
    expect(count).toBe(1)
  })

  it('preserves static changelog rows that live outside the auto-managed block', () => {
    const { output } = runUpdater(buildMinimalDoc(), TEST_ENV)
    expect(output).toContain('| 2026-01-01 | bootstrap | rev-0 | Initial bootstrap |')
  })

  it('exits non-zero and reports an error when markers are missing', () => {
    const noMarkers = buildMinimalDoc()
      .replace('<!-- AUTO-DEPLOY-CHANGELOG:START -->\n', '')
      .replace('\n<!-- AUTO-DEPLOY-CHANGELOG:END -->', '')
    const { exitCode, stderr } = runUpdater(noMarkers, TEST_ENV)
    expect(exitCode).not.toBe(0)
    expect(stderr).toMatch(/markers are missing/i)
  })
})
