# Jika sistem pakai Java 25+, Gradle 8.10 belum mendukung. Gunakan JDK 17 dari Android Studio (JBR).
$javaVersion = (java -version 2>&1) | Select-String "version"
if ($javaVersion -match '"2[5-9]\.' -or $javaVersion -match '"25\.') {
    $jbrPaths = @(
        "${env:ProgramFiles}\Android\Android Studio\jbr",
        "${env:ProgramFiles(x86)}\Android\Android Studio\jbr",
        "$env:LOCALAPPDATA\Programs\Android Studio\jbr"
    )
    foreach ($p in $jbrPaths) {
        if (Test-Path "$p\bin\java.exe") {
            $env:JAVA_HOME = $p
            Write-Host "Menggunakan JBR (JDK 17) untuk build: $env:JAVA_HOME"
            break
        }
    }
    if (-not $env:JAVA_HOME -and (Test-Path "android\gradle.properties")) {
        Write-Host "Java 25 terdeteksi. Gradle 8.10 butuh JDK 17. Set org.gradle.java.home di android\gradle.properties ke path Android Studio\jbr"
    }
}

# Set ANDROID_HOME jika belum ada (Windows - SDK default)
if (-not $env:ANDROID_HOME) {
    $sdk = "$env:LOCALAPPDATA\Android\Sdk"
    if (Test-Path $sdk) {
        $env:ANDROID_HOME = $sdk
        $env:Path = "$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\emulator;$env:Path"
        Write-Host "ANDROID_HOME set to: $env:ANDROID_HOME"
    } else {
        Write-Host "ERROR: Android SDK tidak ditemukan di $sdk. Install Android Studio dan pastikan SDK terinstall."
        exit 1
    }
}

# Cek apakah emulator sudah jalan
$devices = & "$env:ANDROID_HOME\platform-tools\adb.exe" devices 2>$null
$running = ($devices | Select-String "emulator-\d+\s+device").Count -gt 0

if (-not $running) {
    Write-Host "Emulator belum berjalan. Menampilkan daftar AVD..."
    & "$env:ANDROID_HOME\emulator\emulator.exe" -list-avds
    Write-Host ""
    Write-Host "Jalankan emulator dari Android Studio (Device Manager -> Play) atau:"
    Write-Host '  & "$env:LOCALAPPDATA\Android\Sdk\emulator\emulator.exe" -avd <nama_avd>'
    Write-Host ""
    $start = Read-Host "Lanjutkan build anyway? (y/n)"
    if ($start -ne "y") { exit 0 }
}

npx react-native run-android
