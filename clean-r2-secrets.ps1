# Clean and update R2 secrets by removing UTF-8 BOM and CRLF

$secrets = @(
    'CLOUDFLARE_R2_PUBLIC_URL',
    'CLOUDFLARE_R2_ACCESS_KEY_ID',
    'CLOUDFLARE_R2_SECRET_ACCESS_KEY',
    'CLOUDFLARE_R2_BUCKET_NAME'
)

foreach ($secretName in $secrets) {
    Write-Host "Cleaning $secretName..."
    
    try {
        # Get current value
        $rawValue = & gcloud secrets versions access latest --secret=$secretName --project=eventslot 2>&1
        
        # Convert to string and clean
        $cleanValue = [string]$rawValue
        $cleanValue = $cleanValue.Trim()
        
        # Write to temp file using .NET to ensure clean encoding
        $tempFile = "$env:TEMP\$($secretName).txt"
        
        # Use StreamWriter with UTF8Encoding(false) to avoid BOM
        $encoding = New-Object System.Text.UTF8Encoding($false)
        [System.IO.File]::WriteAllText($tempFile, $cleanValue, $encoding)
        
        # Upload to GCP
        $result = & gcloud secrets versions add $secretName --data-file=$tempFile --project=eventslot 2>&1
        
        if ($result -match 'Created version') {
            Write-Host "[OK] $secretName cleaned and updated"
        } else {
            Write-Host "[FAIL] Failed to update $secretName"
            Write-Host $result
        }
        
        # Clean up temp file
        Remove-Item $tempFile -ErrorAction SilentlyContinue
    } catch {
        Write-Host "[ERROR] Error processing $secretName : $_"
    }
}

Write-Host "R2 secret cleanup complete"
