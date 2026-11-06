$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir
$cloudSdkConfig = Join-Path $repoRoot '.tmp-gcloud'
$localTemp = Join-Path $env:LOCALAPPDATA 'Temp\eventslot-gcloud'

if (-not (Test-Path $localTemp)) {
  New-Item -ItemType Directory -Path $localTemp -Force | Out-Null
}

$fullUser = if ($env:USERDOMAIN) { "$env:USERDOMAIN\$env:USERNAME" } else { $env:USERNAME }
& icacls $localTemp /grant "${fullUser}:(OI)(CI)F" /T /C | Out-Null

$env:APPDATA = $cloudSdkConfig
$env:CLOUDSDK_CONFIG = $cloudSdkConfig
$env:TEMP = $localTemp
$env:TMP = $localTemp
$env:TMPDIR = $localTemp

@(
  'HTTP_PROXY',
  'HTTPS_PROXY',
  'http_proxy',
  'https_proxy',
  'ALL_PROXY',
  'all_proxy'
) | ForEach-Object {
  if (Test-Path "Env:$_") { Remove-Item "Env:$_" }
}

$projectId = 'project-d46be384-233e-47fb-bb5'
$region = 'us-central1'
$repository = 'eventslot'
$service = 'eventslot-web-staging'
$imageTag = "staging-" + (Get-Date -Format "yyyyMMdd-HHmmss")

Write-Host "Using CLOUDSDK_CONFIG=$env:CLOUDSDK_CONFIG"
Write-Host "Deploying $service to $projectId in $region"

gcloud config set project $projectId | Out-Host

$archivePath = Join-Path $localTemp "eventslot-staging-source.tar.gz"
if (Test-Path $archivePath) {
  Remove-Item $archivePath -Force
}

Write-Host "Creating source archive at $archivePath using tar..."
Push-Location $repoRoot
try {
  & tar.exe -czf $archivePath --exclude=.git --exclude=.next --exclude=node_modules --exclude=coverage --exclude=mobile --exclude=playwright-report --exclude=test-results --exclude=.tmp-* .
} finally {
  Pop-Location
}

if (-not (Test-Path $archivePath)) {
  throw "Failed to create source archive."
}

$archiveSizeMB = [math]::Round((Get-Item $archivePath).Length / 1MB, 2)
Write-Host "Archive created: $archiveSizeMB MB. Submitting to Google Cloud Build (cloudbuild.staging.yaml)..."

$configFile = Join-Path $repoRoot "cloudbuild.staging.yaml"

Push-Location $repoRoot
try {
  gcloud builds submit `
    --project=$projectId `
    --config=$configFile `
    "--substitutions=_SERVICE=$service,_REGION=$region,_REPOSITORY=$repository,_IMAGE_TAG=$imageTag" `
    $archivePath
} finally {
  Pop-Location
}
