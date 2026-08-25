$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$cloudSdkConfig = Join-Path $repoRoot '.tmp-gcloud'
$localTemp = Join-Path $env:LOCALAPPDATA 'Temp\eventslot-gcloud'

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

gcloud builds list --project=project-d46be384-233e-47fb-bb5 --format='table(createTime,status,id,source.repoSource.commitSha)' --limit=5
