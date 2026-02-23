# Build Android via drive virtual (subst) untuk hindari error
# "Could not move temporary workspace" di Windows (antivirus mengunci path asli).
# Jalankan dari repo root: .\mobile\run-android-subst.ps1
# Atau dari mobile: .\run-android-subst.ps1

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = (Resolve-Path (Join-Path $scriptDir "..")).Path
$drive = "G:"

# Hapus .gradle dulu agar build dari bersih di path baru
$gradleDir = Join-Path $scriptDir "android\.gradle"
if (Test-Path $gradleDir) {
    Remove-Item -Recurse -Force $gradleDir -ErrorAction SilentlyContinue
}

try {
    # Subst: G: -> C:\dev\bintang-global-group (path lain menyesuaikan)
    & subst $drive $repoRoot
    Set-Location "$drive\mobile"
    # Pakai port 8082 agar tidak prompt "Use port 8082 instead?" saat 8081 sudah dipakai
& npm run android -- --port 8082
    exit $LASTEXITCODE
} finally {
    # Lepas drive virtual
    & subst $drive /d 2>$null
}
