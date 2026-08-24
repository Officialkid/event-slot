param(
  [Parameter(Mandatory = $false)]
  [string]$ProjectId = "eventslot",

  [Parameter(Mandatory = $false)]
  [string]$Region = "us-central1",

  [Parameter(Mandatory = $false)]
  [string]$Repository = "eventslot",

  [Parameter(Mandatory = $false)]
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$policyPath = Join-Path $PSScriptRoot "..\infra\artifact-registry-cleanup-policy.json"
$resolvedPolicyPath = (Resolve-Path $policyPath).Path

Write-Host "Setting active gcloud project..."
gcloud config set project $ProjectId
if ($LASTEXITCODE -ne 0) { throw "Failed to set gcloud project." }

Write-Host "Applying Artifact Registry cleanup policy from $resolvedPolicyPath ..."
if ($DryRun) {
  gcloud artifacts repositories set-cleanup-policies $Repository --project $ProjectId --location $Region --policy $resolvedPolicyPath --dry-run
} else {
  gcloud artifacts repositories set-cleanup-policies $Repository --project $ProjectId --location $Region --policy $resolvedPolicyPath --no-dry-run
}
if ($LASTEXITCODE -ne 0) { throw "Failed to apply Artifact Registry cleanup policy." }

Write-Host "Cleanup policy applied."
