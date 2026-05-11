# Clean and re-upload OAuth secrets to GCP Secret Manager
# Fixes null bytes, BOM, CRLF, and whitespace corruption

$PROJECT_ID = "eventslot"

$secrets = @(
    @{ Name = 'EVENTSLOT_GOOGLE_CLIENT_ID';     LocalFile = 'eventslot_google_client_id.txt' },
    @{ Name = 'EVENTSLOT_GOOGLE_CLIENT_SECRET'; LocalFile = 'eventslot_google_client_secret.txt' }
)

$allOk = $true

foreach ($entry in $secrets) {
    $secretName = $entry.Name
    $localFile  = $entry.LocalFile

    Write-Host "Processing $secretName from $localFile ..."

    if (-not (Test-Path $localFile)) {
        Write-Host "[FAIL] Local file '$localFile' not found. Skipping."
        $allOk = $false
        continue
    }

    # Read raw bytes, convert to string (UTF-8, no BOM)
    $rawBytes   = [System.IO.File]::ReadAllBytes($localFile)
    $rawString  = [System.Text.Encoding]::UTF8.GetString($rawBytes)

    # Strip BOM if present
    $rawString = $rawString.TrimStart([char]0xFEFF)

    # Strip null bytes
    $rawString = $rawString -replace '\x00', ''

    # Strip all line endings and whitespace
    $cleanValue = $rawString.Trim() -replace '[\r\n]', ''

    if ([string]::IsNullOrEmpty($cleanValue)) {
        Write-Host "[FAIL] '$secretName' resolved to empty string after cleaning. Aborting."
        $allOk = $false
        continue
    }

    Write-Host "  Clean value length: $($cleanValue.Length) chars"

    # Write clean value to temp file without BOM
    $tempFile = "$env:TEMP\$secretName`_clean.txt"
    $encoding = New-Object System.Text.UTF8Encoding($false)  # UTF-8, no BOM
    [System.IO.File]::WriteAllText($tempFile, $cleanValue, $encoding)

    # Verify temp file has no null bytes
    $tempBytes  = [System.IO.File]::ReadAllBytes($tempFile)
    $hasNull    = $tempBytes -contains 0x00
    if ($hasNull) {
        Write-Host "[FAIL] Temp file still contains null bytes. Aborting upload for $secretName."
        Remove-Item $tempFile -ErrorAction SilentlyContinue
        $allOk = $false
        continue
    }

    # Upload new version to GCP Secret Manager
    $result = & gcloud secrets versions add $secretName --data-file=$tempFile --project=$PROJECT_ID 2>&1

    Remove-Item $tempFile -ErrorAction SilentlyContinue

    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] $secretName updated successfully in GCP Secret Manager."
    } else {
        Write-Host "[FAIL] Failed to update $secretName."
        Write-Host $result
        $allOk = $false
    }
}

Write-Host ""
if ($allOk) {
    Write-Host "All OAuth secrets cleaned and re-uploaded successfully."
} else {
    Write-Host "One or more secrets failed. Check output above."
    exit 1
}
