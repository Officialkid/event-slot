$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$cloudSdkConfig = Join-Path $repoRoot '.tmp-gcloud'
$localTemp = Join-Path $env:LOCALAPPDATA 'Temp\eventslot-gcloud'

if (-not (Test-Path $localTemp)) {
  New-Item -ItemType Directory -Path $localTemp | Out-Null
}

# Make sure the current Windows user can actually write temp archives here.
$fullUser = if ($env:USERDOMAIN) { "$env:USERDOMAIN\$env:USERNAME" } else { $env:USERNAME }
& icacls $localTemp /grant "${fullUser}:(OI)(CI)F" /T /C | Out-Null

# Force gcloud to use the workspace-local SDK profile instead of the locked Windows profile.
$env:APPDATA = $cloudSdkConfig
$env:CLOUDSDK_CONFIG = $cloudSdkConfig
$env:TEMP = $localTemp
$env:TMP = $localTemp
$env:TMPDIR = $localTemp

# The current Windows shell is picking up a dead localhost proxy, which breaks token refresh.
# Clear proxy variables so gcloud can reach Google directly.
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
$service = 'eventslot-web'
$imageTag = 'manual'

Write-Host "Using CLOUDSDK_CONFIG=$env:CLOUDSDK_CONFIG"
Write-Host "Deploying $service to $projectId in $region"

gcloud config set project $projectId | Out-Host
gcloud auth list | Out-Host

$archivePath = Join-Path $localTemp "eventslot-source.zip"
if (Test-Path $archivePath) {
  Remove-Item $archivePath -Force
}

$excludedNames = @(
  '.git',
  '.next',
  '.tmp-gcloud',
  '.tmp-gcloud-temp',
  '.tmp-*',
  '.docx-review',
  'node_modules',
  'coverage',
  'playwright-report',
  'test-results'
)

$sourceItems = Get-ChildItem -Force $repoRoot | Where-Object {
  $name = $_.Name
  -not ($excludedNames | Where-Object { $name -like $_ })
}

Write-Host "Creating source archive at $archivePath"
Compress-Archive -Path $sourceItems.FullName -DestinationPath $archivePath -Force

gcloud builds submit `
  --project=$projectId `
  --config=cloudbuild.yaml `
  --substitutions=_SERVICE=$service,_REGION=$region,_REPOSITORY=$repository,_IMAGE_TAG=$imageTag `
  $archivePath
