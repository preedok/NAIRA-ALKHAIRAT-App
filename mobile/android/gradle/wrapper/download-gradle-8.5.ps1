# Unduh Gradle 8.5 ke gradle/wrapper/ agar build pakai file lokal (hindari bug "Could not move" di Windows).
# Jalankan sekali: .\download-gradle-8.5.ps1

$url = "https://services.gradle.org/distributions/gradle-8.5-all.zip"
$outDir = $PSScriptRoot
$outFile = Join-Path $outDir "gradle-8.5-all.zip"

if (Test-Path $outFile) {
    Write-Host "gradle-8.5-all.zip sudah ada. Hapus dulu jika ingin unduh ulang."
    exit 0
}

Write-Host "Mengunduh Gradle 8.5 (~110 MB)..."
try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri $url -OutFile $outFile -UseBasicParsing
    Write-Host "Selesai. Sekarang jalankan: npm run android"
} catch {
    Write-Host "Gagal: $_"
    Write-Host "Unduh manual: $url -> simpan ke $outFile"
    exit 1
}
