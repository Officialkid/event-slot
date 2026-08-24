param(
  [Parameter(Mandatory = $false)]
  [string]$ProjectId = $env:GCP_PROJECT_ID,

  [Parameter(Mandatory = $false)]
  [string]$Region = "us-central1",

  [Parameter(Mandatory = $false)]
  [string]$Service = "eventslot-web",

  [Parameter(Mandatory = $false)]
  [string]$Repository = "eventslot",

  [Parameter(Mandatory = $false)]
  [ValidateSet("resend", "smtp")]
  [string]$EmailProvider = "resend",

  [Parameter(Mandatory = $false)]
  [switch]$SkipSmokeTests
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($ProjectId)) {
  throw "ProjectId is required. Pass -ProjectId <your-gcp-project-id> or set GCP_PROJECT_ID in your environment."
}

Write-Host "Setting active gcloud project..."
gcloud config set project $ProjectId
if ($LASTEXITCODE -ne 0) { throw "Failed to set gcloud project." }

Write-Host "Ensuring Artifact Registry repository exists..."
$previousErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = "Continue"
gcloud artifacts repositories describe $Repository --location $Region --format="value(name)" 2>$null | Out-Null
$repoDescribeExitCode = $LASTEXITCODE
$ErrorActionPreference = $previousErrorActionPreference

if ($repoDescribeExitCode -ne 0) {
  gcloud artifacts repositories create $Repository --repository-format docker --location $Region --description "EventSlot images"
  if ($LASTEXITCODE -ne 0) { throw "Failed to create Artifact Registry repository." }
}

Write-Host "Submitting Cloud Build..."
$imageTag = (Get-Date -Format "yyyyMMdd-HHmmss")
$substitutions = "_REGION=$Region,_SERVICE=$Service,_REPOSITORY=$Repository,_IMAGE_TAG=$imageTag"
$buildConfig = if ($EmailProvider -eq "smtp") { "cloudbuild.smtp.yaml" } else { "cloudbuild.yaml" }
Write-Host "Using deploy config $buildConfig for email provider mode '$EmailProvider'."
gcloud builds submit --config $buildConfig --substitutions "$substitutions"
if ($LASTEXITCODE -ne 0) { throw "Cloud Build submission failed." }

Write-Host "Deployment submitted."
if (-not $SkipSmokeTests) {
  Write-Host "Running Cloud Run smoke tests (5 checks)..."
  $serviceUrl = gcloud run services describe $Service --region $Region --project $ProjectId --format="value(status.url)"
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($serviceUrl)) {
    throw "Failed to resolve Cloud Run service URL for smoke tests."
  }

  $identityToken = gcloud auth print-identity-token --audiences=$serviceUrl
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($identityToken)) {
    $identityToken = gcloud auth print-identity-token
  }
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($identityToken)) {
    throw "Failed to get identity token for Cloud Run smoke tests."
  }

  $env:CLOUD_RUN_ID_TOKEN = $identityToken
  node scripts/cloudrun-smoke-tests.mjs --base-url=$serviceUrl
  Remove-Item Env:CLOUD_RUN_ID_TOKEN -ErrorAction SilentlyContinue
  if ($LASTEXITCODE -ne 0) { throw "Smoke tests failed." }
}

Write-Host "Next step: set Cloud Run environment variables and secrets if not configured yet."
