param(
  [Parameter(Mandatory = $false)]
  [string]$ProjectId = $env:GCP_PROJECT_ID,

  [Parameter(Mandatory = $false)]
  [string[]]$EnvFiles = @(".env.local", ".env"),

  [Parameter(Mandatory = $false)]
  [switch]$AllowGeneratedPlaceholders
)

$ErrorActionPreference = "Stop"
$PSNativeCommandUseErrorActionPreference = $false

if ([string]::IsNullOrWhiteSpace($ProjectId)) {
  throw "ProjectId is required. Pass -ProjectId <your-gcp-project-id> or set GCP_PROJECT_ID in your environment."
}

function Get-EnvFileValues {
  param([string]$Path)

  $result = @{}
  if (-not (Test-Path $Path)) {
    return $result
  }

  foreach ($line in Get-Content $Path) {
    $trimmed = $line.Trim().TrimStart([char]0xFEFF)
    if ([string]::IsNullOrWhiteSpace($trimmed) -or $trimmed.StartsWith("#")) {
      continue
    }

    $match = [regex]::Match($trimmed, '^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$')
    if (-not $match.Success) {
      continue
    }

    $key = $match.Groups[1].Value
    $value = $match.Groups[2].Value.Trim().TrimStart([char]0xFEFF)

    if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
      $value = $value.Substring(1, $value.Length - 2)
    }

    $value = $value.TrimStart([char]0xFEFF)

    $result[$key] = $value
  }

  return $result
}

function Ensure-GcpSecret {
  param(
    [string]$Name,
    [string]$Value
  )

  $tmpFile = [System.IO.Path]::GetTempFileName()
  try {
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($tmpFile, $Value, $utf8NoBom)
    & cmd.exe /c "gcloud.cmd secrets describe $Name --project=$ProjectId >nul 2>nul"
    if ($LASTEXITCODE -ne 0) {
      & cmd.exe /c "gcloud.cmd secrets create $Name --project=$ProjectId --replication-policy=automatic >nul 2>nul"
      if ($LASTEXITCODE -ne 0) {
        throw "Failed to create secret $Name"
      }
    }

    & cmd.exe /c "gcloud.cmd secrets versions add $Name --project=$ProjectId --data-file=$tmpFile >nul 2>nul"
    if ($LASTEXITCODE -ne 0) {
      throw "Failed to add secret version for $Name"
    }
  } finally {
    Remove-Item $tmpFile -ErrorAction SilentlyContinue
  }
}

$values = @{}
foreach ($file in $EnvFiles) {
  foreach ($entry in (Get-EnvFileValues -Path $file).GetEnumerator()) {
    if (-not $values.ContainsKey($entry.Key) -or [string]::IsNullOrWhiteSpace($values[$entry.Key])) {
      $values[$entry.Key] = $entry.Value
    }
  }
}

$sourceToSecret = [ordered]@{
  "DATABASE_URL" = "EVENTSLOT_DATABASE_URL"
  "DIRECT_URL" = "EVENTSLOT_DIRECT_URL"
  "NEXTAUTH_SECRET" = "NEXTAUTH_SECRET"
  "GOOGLE_CLIENT_ID" = "EVENTSLOT_GOOGLE_CLIENT_ID"
  "GOOGLE_CLIENT_SECRET" = "EVENTSLOT_GOOGLE_CLIENT_SECRET"
  "RESEND_API_KEY" = "RESEND_API_KEY"
  "GEMINI_API_KEY" = "GEMINI_API_KEY"
  "CRON_SECRET" = "CRON_SECRET"
  "R2_ACCOUNT_ID" = "CLOUDFLARE_R2_ACCOUNT_ID"
  "R2_ACCESS_KEY_ID" = "CLOUDFLARE_R2_ACCESS_KEY_ID"
  "R2_SECRET_ACCESS_KEY" = "CLOUDFLARE_R2_SECRET_ACCESS_KEY"
  "R2_BUCKET_NAME" = "CLOUDFLARE_R2_BUCKET_NAME"
  "R2_PUBLIC_URL" = "CLOUDFLARE_R2_PUBLIC_URL"
  "SUPER_ADMIN_EMAIL" = "SUPER_ADMIN_EMAIL"
  "SUPER_ADMIN_EMAIL_2" = "SUPER_ADMIN_EMAIL_2"
  "PAYSTACK_SECRET_KEY" = "PAYSTACK_SECRET_KEY"
  "GROQ_API_KEY" = "GROQ_API_KEY"
  "OPENROUTER_API_KEY" = "OPENROUTER_API_KEY"
  "ANTHROPIC_API_KEY" = "ANTHROPIC_API_KEY"
  "OPENAI_API_KEY" = "OPENAI_API_KEY"
  "ENCRYPTION_KEY" = "ENCRYPTION_KEY"
  "QR_SECRET" = "QR_SECRET"
}

$placeholderSecrets = @{
  "GEMINI_API_KEY" = $null
  "QR_SECRET" = $null
}

$geminiBytes = New-Object byte[] 32
$rngGemini = [System.Security.Cryptography.RandomNumberGenerator]::Create()
try {
  $rngGemini.GetBytes($geminiBytes)
} finally {
  $rngGemini.Dispose()
}
$placeholderSecrets["GEMINI_API_KEY"] = "placeholder-" + ([System.BitConverter]::ToString($geminiBytes).Replace("-", "").ToLowerInvariant())

$qrBytes = New-Object byte[] 32
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
try {
  $rng.GetBytes($qrBytes)
} finally {
  $rng.Dispose()
}
$placeholderSecrets["QR_SECRET"] = [System.BitConverter]::ToString($qrBytes).Replace("-", "").ToLowerInvariant()

Write-Host "Uploading runtime secrets to project $ProjectId..."

foreach ($pair in $sourceToSecret.GetEnumerator()) {
  $sourceKey = $pair.Key
  $secretName = $pair.Value

  if ($values.ContainsKey($sourceKey) -and -not [string]::IsNullOrWhiteSpace($values[$sourceKey])) {
    Write-Host "  $secretName <- $sourceKey"
    Ensure-GcpSecret -Name $secretName -Value $values[$sourceKey]
    continue
  }

  if ($placeholderSecrets.ContainsKey($secretName) -and $AllowGeneratedPlaceholders) {
    Write-Host "  $secretName <- generated placeholder (no local value found)"
    Ensure-GcpSecret -Name $secretName -Value $placeholderSecrets[$secretName]
    continue
  }

  Write-Host "  skipping $secretName (no local value found for $sourceKey)"
}

Write-Host ""
Write-Host "Secret upload complete. Current secret names in destination project:"
& cmd.exe /c "gcloud.cmd secrets list --project=$ProjectId --format=value(name)"
