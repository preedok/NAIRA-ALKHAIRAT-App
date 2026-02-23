# Download gradle-wrapper.jar (run from repo root or mobile folder)
# Usage: PowerShell -ExecutionPolicy Bypass -File get-wrapper.ps1

$jarUrl = "https://github.com/gradle/gradle/raw/v8.10.2/gradle/wrapper/gradle-wrapper.jar"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$outPath = Join-Path $scriptDir "gradle-wrapper.jar"

if (Test-Path $outPath) {
    Write-Host "gradle-wrapper.jar already exists. Delete it first to re-download."
    exit 0
}

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$wc = New-Object System.Net.WebClient
$wc.Headers.Add("User-Agent", "Mozilla/5.0")
try {
    Write-Host "Downloading gradle-wrapper.jar..."
    $wc.DownloadFile($jarUrl, $outPath)
    Write-Host "Done. Saved to: $outPath"
} catch {
    Write-Host "Download failed: $_"
    Write-Host ""
    Write-Host "Alternative: Open Android Studio -> File -> Open -> select folder 'mobile\android' -> wait for Sync Project with Gradle Files. That will create the jar."
    exit 1
}
