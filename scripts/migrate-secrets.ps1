param(
  [string]$SourceProjectId = "dotted-spot-476513-i2",
  [string]$DestinationProjectId
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($DestinationProjectId)) {
  throw "DestinationProjectId is required. Pass -DestinationProjectId <your-new-gcp-project-id>."
}

$toCopy = @(
  "EVENTSLOT_DATABASE_URL",
  "EVENTSLOT_DIRECT_URL",
  "NEXTAUTH_SECRET",
  "EVENTSLOT_NEXTAUTH_URL",
  "EVENTSLOT_GOOGLE_CLIENT_ID",
  "EVENTSLOT_GOOGLE_CLIENT_SECRET",
  "RESEND_API_KEY",
  "GEMINI_API_KEY",
  "CRON_SECRET",
  "CLOUDFLARE_R2_ACCOUNT_ID",
  "CLOUDFLARE_R2_ACCESS_KEY_ID",
  "CLOUDFLARE_R2_SECRET_ACCESS_KEY",
  "CLOUDFLARE_R2_BUCKET_NAME"
)

foreach ($secret in $toCopy) {
  Write-Host "Copying $secret ..." -NoNewline
  $value = gcloud secrets versions access latest --secret=$secret --project=$SourceProjectId 2>&1
  if ($LASTEXITCODE -ne 0) { Write-Host " SKIP (not found in source)"; continue }
  $existing = gcloud secrets describe $secret --project=$DestinationProjectId 2>$null
  if ($LASTEXITCODE -ne 0) {
    gcloud secrets create $secret --project=$DestinationProjectId --replication-policy=automatic 2>&1 | Out-Null
  }
  $tmpFile = [System.IO.Path]::GetTempFileName()
  [System.IO.File]::WriteAllText($tmpFile, $value, [System.Text.Encoding]::UTF8)
  gcloud secrets versions add $secret --project=$DestinationProjectId --data-file=$tmpFile 2>&1 | Out-Null
  Remove-Item $tmpFile
  Write-Host " OK"
}

# Admin email secrets (not in CMMS)
Write-Host "Creating SUPER_ADMIN_EMAIL ..." -NoNewline
$existing = gcloud secrets describe SUPER_ADMIN_EMAIL --project=$DestinationProjectId 2>$null
if ($LASTEXITCODE -ne 0) { gcloud secrets create SUPER_ADMIN_EMAIL --project=$DestinationProjectId --replication-policy=automatic 2>&1 | Out-Null }
$tmpFile = [System.IO.Path]::GetTempFileName()
[System.IO.File]::WriteAllText($tmpFile, "danielmwaliliofficial@gmail.com", [System.Text.Encoding]::UTF8)
gcloud secrets versions add SUPER_ADMIN_EMAIL --project=$DestinationProjectId --data-file=$tmpFile 2>&1 | Out-Null
Remove-Item $tmpFile
Write-Host " OK"

Write-Host "Creating SUPER_ADMIN_EMAIL_2 ..." -NoNewline
$existing = gcloud secrets describe SUPER_ADMIN_EMAIL_2 --project=$DestinationProjectId 2>$null
if ($LASTEXITCODE -ne 0) { gcloud secrets create SUPER_ADMIN_EMAIL_2 --project=$DestinationProjectId --replication-policy=automatic 2>&1 | Out-Null }
$tmpFile = [System.IO.Path]::GetTempFileName()
[System.IO.File]::WriteAllText($tmpFile, "eventslot.co@gmail.com", [System.Text.Encoding]::UTF8)
gcloud secrets versions add SUPER_ADMIN_EMAIL_2 --project=$DestinationProjectId --data-file=$tmpFile 2>&1 | Out-Null
Remove-Item $tmpFile
Write-Host " OK"

Write-Host ""
Write-Host "All done! Verifying secrets in the destination project:"
gcloud secrets list --project=$DestinationProjectId --format="value(name)"
