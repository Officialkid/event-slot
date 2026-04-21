# EventSlot

EventSlot is a Next.js 16 application for event registration, waitlists, organizer dashboards, analytics, and attendee workflows.

## Local Development

1. Install dependencies:

```bash
npm install
```

2. Configure environment variables in `.env`.

Neon connection guidance:
- Use pooled endpoint for `DATABASE_URL` (host contains `-pooler`)
- Use direct endpoint for `DIRECT_URL` (non-pooler host)
- Keep both set so Prisma uses pooled connections for runtime traffic and direct connections for migrations

3. Start the app:

```bash
npm run dev
```

4. Open http://localhost:3000.

## Deploying on Google Cloud (Cloud Run)

This repository is configured for container-based deployment to Google Cloud Run using Cloud Build.

### Prerequisites

1. Install and authenticate Google Cloud CLI.
2. Enable APIs in your GCP project:
	- Cloud Build API
	- Artifact Registry API
	- Cloud Run Admin API
3. Grant required IAM roles to your deploy identity:
	- Cloud Run Admin
	- Service Account User
	- Artifact Registry Writer
	- Cloud Build Editor (or equivalent)

### One-time setup

Create Artifact Registry repository (if not already created):

```bash
gcloud artifacts repositories create eventslot --repository-format=docker --location=us-central1
```

### Deploy from local machine

PowerShell helper:

```powershell
./scripts/deploy-gcp.ps1 -ProjectId YOUR_GCP_PROJECT_ID -Region us-central1 -Service eventslot-web -Repository eventslot
```

Or direct Cloud Build command:

```bash
gcloud builds submit --config cloudbuild.yaml --substitutions _REGION=us-central1,_SERVICE=eventslot-web,_REPOSITORY=eventslot
```

### Configure Cloud Run environment variables

Set required runtime environment variables on Cloud Run after the first deploy:

```bash
gcloud run services update eventslot-web \
  --region=us-central1 \
  --set-env-vars=NEXTAUTH_URL=https://YOUR_CLOUD_RUN_URL,NODE_ENV=production
```

Then add the rest of your required app secrets and env vars via:

1. Cloud Run console UI, or
2. Secret Manager + `--set-secrets`, or
3. Additional `--set-env-vars` flags.

## Current Deployment Model

- Primary deployment target: Google Cloud Run
- Build pipeline: Cloud Build (`cloudbuild.yaml`)
- Container source: `Dockerfile`
- Local Docker Compose files are kept for local workflows, but production hosting should use Cloud Run.

## Verification Commands

```bash
npm run type-check
npm run build
npm audit --audit-level=high
```
