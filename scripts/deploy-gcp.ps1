param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectId,

  [Parameter(Mandatory = $false)]
  [string]$Region = "us-central1",

  [Parameter(Mandatory = $false)]
  [string]$Service = "eventslot-web",

  [Parameter(Mandatory = $false)]
  [string]$Repository = "eventslot"
)

$ErrorActionPreference = "Stop"

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
gcloud builds submit --config cloudbuild.yaml --substitutions "$substitutions"
if ($LASTEXITCODE -ne 0) { throw "Cloud Build submission failed." }

Write-Host "Deployment submitted."
Write-Host "Next step: set Cloud Run environment variables and secrets if not configured yet."
