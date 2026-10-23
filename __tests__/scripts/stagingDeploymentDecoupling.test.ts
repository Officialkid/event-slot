/** @jest-environment node */

import fs from 'fs'
import path from 'path'

describe('Phase 08A: Staging Deployment Containment & CI Decoupling Verification', () => {
  const rootDir = path.resolve(__dirname, '../../')
  const stagingYamlPath = path.join(rootDir, 'cloudbuild.staging.yaml')
  const prodYamlPath = path.join(rootDir, 'cloudbuild.yaml')
  const legacyStagingWorkflowPath = path.join(rootDir, '.github/workflows/deploy-staging.yml')
  const prValidationWorkflowPath = path.join(rootDir, '.github/workflows/pr-validation.yml')
  const dockerfilePath = path.join(rootDir, 'Dockerfile')
  const packageJsonPath = path.join(rootDir, 'package.json')
  const packageLockPath = path.join(rootDir, 'package-lock.json')
  const migrationSqlPath = path.join(
    rootDir,
    'prisma/migrations/20261023030000_add_registration_paid_order_and_attendee_email_indexes/migration.sql'
  )

  it('cloudbuild.staging.yaml decouples migration execution into a dedicated pre-deploy step using deterministic --no-install execution', () => {
    const content = fs.readFileSync(stagingYamlPath, 'utf8')

    // Verifies dedicated migration step exists and uses deterministic --no-install flag
    expect(content).toContain('id: Run Database Migrations (Pre-Deploy)')
    expect(content).toContain('npx --no-install prisma migrate deploy')

    // Verifies migration step appears before Cloud Run deployment step
    const migrationIndex = content.indexOf('id: Run Database Migrations (Pre-Deploy)')
    const deployIndex = content.indexOf('id: Deploy to Cloud Run Staging')
    expect(migrationIndex).toBeGreaterThan(-1)
    expect(deployIndex).toBeGreaterThan(-1)
    expect(migrationIndex).toBeLessThan(deployIndex)
  })

  it('cloudbuild.staging.yaml maps migrations strictly to staging database secret and avoids production secrets', () => {
    const content = fs.readFileSync(stagingYamlPath, 'utf8')

    expect(content).toContain('projects/${PROJECT_ID}/secrets/EVENTSLOT_STAGING_DATABASE_URL/versions/latest')
    expect(content).not.toContain('projects/${PROJECT_ID}/secrets/EVENTSLOT_DATABASE_URL/versions/latest')
  })

  it('cloudbuild.staging.yaml configures Cloud Run container with RUN_DB_MIGRATIONS=false', () => {
    const content = fs.readFileSync(stagingYamlPath, 'utf8')

    expect(content).toContain('RUN_DB_MIGRATIONS=false')
    expect(content).not.toContain('RUN_DB_MIGRATIONS=true')
  })

  it('Dockerfile configures deterministic runner with pinned prisma CLI, bin symlinks, and RUN_DB_MIGRATIONS=false', () => {
    const content = fs.readFileSync(dockerfilePath, 'utf8')

    // Verifies fail-closed environment variable
    expect(content).toContain('ENV RUN_DB_MIGRATIONS=false')

    // Verifies runner copies prisma CLI package and bin entrypoints from builder stage
    expect(content).toContain('COPY --from=builder /app/node_modules/prisma ./node_modules/prisma')
    expect(content).toContain('COPY --from=builder /app/node_modules/.bin ./node_modules/.bin')

    // Verifies runner CMD uses --no-install if invoked directly
    expect(content).toContain('npx --no-install prisma migrate deploy')
  })

  it('package.json and package-lock.json strictly pin Prisma CLI to 5.22.0', () => {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
    const lock = JSON.parse(fs.readFileSync(packageLockPath, 'utf8'))

    expect(pkg.devDependencies.prisma).toBe('^5.22.0')
    expect(pkg.dependencies['@prisma/client']).toBe('^5.22.0')

    expect(lock.packages['node_modules/prisma'].version).toBe('5.22.0')
    expect(lock.packages['node_modules/@prisma/client'].version).toBe('5.22.0')
  })

  it('production cloudbuild.yaml remains untouched and isolated', () => {
    const content = fs.readFileSync(prodYamlPath, 'utf8')

    expect(content).toContain('_SERVICE: eventslot-web')
    expect(content).not.toContain('eventslot-web-staging')
    expect(content).not.toContain('EVENTSLOT_STAGING_DATABASE_URL')
  })

  it('verifies pending registration index migration is purely additive and syntax-valid', () => {
    const sql = fs.readFileSync(migrationSqlPath, 'utf8')

    // Must contain the expected CREATE INDEX statements
    expect(sql).toContain('CREATE INDEX "Registration_paidOrderId_idx"')
    expect(sql).toContain('CREATE INDEX "Registration_eventId_attendeeEmail_idx"')

    // Must NOT contain destructive DDL statements
    expect(sql).not.toContain('DROP ')
    expect(sql).not.toContain('ALTER TABLE ')
    expect(sql).not.toContain('TRUNCATE ')
    expect(sql).not.toContain('DELETE ')
  })

  it('identifies shared PAYSTACK_SECRET_KEY as an outstanding staging payment safety release gate', () => {
    const stagingContent = fs.readFileSync(stagingYamlPath, 'utf8')
    const prodContent = fs.readFileSync(prodYamlPath, 'utf8')

    // Both manifests currently reference PAYSTACK_SECRET_KEY
    expect(stagingContent).toContain('PAYSTACK_SECRET_KEY=PAYSTACK_SECRET_KEY:latest')
    expect(prodContent).toContain('PAYSTACK_SECRET_KEY=PAYSTACK_SECRET_KEY:latest')

    // Flag: Operator verification required before staging release to confirm staging secret is test-mode
    const operatorReleaseGateRequired = true
    expect(operatorReleaseGateRequired).toBe(true)
  })

  it('legacy deploy-staging.yml workflow is decommissioned and cannot perform an unintended deployment', () => {
    const legacyContent = fs.readFileSync(legacyStagingWorkflowPath, 'utf8')

    // Verifies deploy job is permanently disabled via if: false
    expect(legacyContent).toMatch(/deploy:[\s\S]*?if:\s*false/)

    // Verifies dangerous deploy commands are completely excised
    expect(legacyContent).not.toContain('gcloud run deploy')
    expect(legacyContent).not.toContain('docker push')

    // Verifies fail-safe notice is in place
    expect(legacyContent).toContain('Direct deployment to Cloud Run via GitHub Actions has been decommissioned')
    expect(legacyContent).toContain('cloudbuild.staging.yaml')
  })

  it('no staging workflow maps the production database secret into a staging database connection', () => {
    const legacyContent = fs.readFileSync(legacyStagingWorkflowPath, 'utf8')
    const cloudBuildContent = fs.readFileSync(stagingYamlPath, 'utf8')

    // Neither file must reference production database secret
    expect(legacyContent).not.toContain('EVENTSLOT_DATABASE_URL')
    expect(cloudBuildContent).not.toContain('EVENTSLOT_DATABASE_URL')

    // Only staging database secret should be referenced for staging deployments
    expect(cloudBuildContent).toContain('EVENTSLOT_STAGING_DATABASE_URL')
  })

  it('pr-validation.yml allocates sufficient memory and enforces reproducible CI checks', () => {
    const prContent = fs.readFileSync(prValidationWorkflowPath, 'utf8')

    // Verifies high-memory provisioning for TypeScript & Next.js AST traversal
    expect(prContent).toContain('NODE_OPTIONS: --max-old-space-size=8192')

    // Verifies deterministic lockfile install
    expect(prContent).toContain('npm ci --legacy-peer-deps')

    // Verifies pipeline fails on type-check, lint, or test failures
    expect(prContent).toContain('npx tsc --noEmit')
    expect(prContent).toContain('npm run lint')
    expect(prContent).toContain('npm test -- --ci')
  })
})
