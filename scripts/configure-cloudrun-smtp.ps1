param(
  [string]$ProjectId = $env:GCP_PROJECT_ID,
  [string]$Service = "eventslot-web",
  [string]$Region = "us-central1",
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($ProjectId)) {
  throw "ProjectId is required. Pass -ProjectId <your-gcp-project-id> or set GCP_PROJECT_ID in your environment."
}

$requiredSecrets = @(
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_SECURE",
  "SMTP_USER",
  "SMTP_PASSWORD",
  "SMTP_FROM"
)

function Invoke-GcloudChecked {
  param([string[]]$Args)

  $display = "gcloud " + ($Args -join " ")
  if ($DryRun) {
    Write-Output "[dry-run] $display"
    return
  }

  & gcloud @Args
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed: $display"
  }
}

Write-Output "Checking SMTP secrets in project $ProjectId..."

foreach ($secret in $requiredSecrets) {
  & gcloud secrets describe $secret --project $ProjectId *> $null
  if ($LASTEXITCODE -ne 0) {
    throw "Missing Secret Manager secret: $secret. Create it first, then rerun this script."
  }
}

$secretMappings = @(
  "SMTP_HOST=SMTP_HOST:latest",
  "SMTP_PORT=SMTP_PORT:latest",
  "SMTP_SECURE=SMTP_SECURE:latest",
  "SMTP_USER=SMTP_USER:latest",
  "SMTP_PASSWORD=SMTP_PASSWORD:latest",
  "SMTP_FROM=SMTP_FROM:latest"
) -join ","

Write-Output "Updating Cloud Run service $Service in $Region to use SMTP..."

Invoke-GcloudChecked @(
  "run", "services", "update", $Service,
  "--project", $ProjectId,
  "--region", $Region,
  "--set-env-vars", "EMAIL_PROVIDER=smtp",
  "--update-secrets", $secretMappings
)

Write-Output "SMTP Cloud Run configuration applied. Open /admin/health and confirm SMTP provider is healthy."
