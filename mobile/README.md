# Bintang Global - Owner Mobile App (React Native + Android)

Aplikasi React Native (CLI) untuk **role Owner**, dijalankan di **Android Studio emulator** atau device fisik.

## Persyaratan

- Node.js 18+
- **Android Studio** (dengan Android SDK & emulator)
- JDK 17 (untuk build Android). **Jika sistem pakai Java 25:** Gradle 8.10 belum mendukung Java 25. Gunakan **mobile\\run-android.ps1** (akan pakai JBR Android Studio), atau set `org.gradle.java.home` di **android/gradle.properties** ke path `Android Studio\jbr`.
- Variabel environment: `ANDROID_HOME` mengarah ke SDK Android

## Setup

### 1. Install dependency

Dari **root** project:

```bash
npm run install:all
```

Atau hanya mobile:

```bash
cd mobile
npm install
```

**Penting:** Jika IDE/TypeScript menampilkan error "Cannot find module 'react'" atau "Cannot find module 'react-native'", pastikan dependency sudah terinstall (`npm install` di folder `mobile` atau `npm run install:all` dari root). Lalu reload window IDE (Ctrl+Shift+P → "Developer: Reload Window").

### 2. Jalankan Metro (bundler)

Dari **root** (backend + frontend web + Metro):

```bash
npm start
```

Atau hanya Metro:

```bash
cd mobile
npm start
```

### 3. Set ANDROID_HOME (penting agar emulator terdeteksi)

**Windows:** Tanpa ini, `npm run android` tidak menemukan SDK dan emulator tidak muncul.

- Buka **Pengaturan Windows** → **Sistem** → **Tentang** → **Pengaturan sistem lanjutan** → **Variabel lingkungan**.
- Di "Variabel sistem", pilih **Baru** → Nama: `ANDROID_HOME`, Nilai: `C:\Users\<USERNAME>\AppData\Local\Android\Sdk` (sesuaikan jika SDK Anda di folder lain).
- Tambahkan ke **Path**: `%ANDROID_HOME%\platform-tools` dan `%ANDROID_HOME%\emulator`.
- **Tutup dan buka lagi** terminal/IDE agar variabel terbaca.

Atau untuk **satu sesi** di PowerShell (sebelum `npm run android`):

```powershell
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:Path = "$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\emulator;$env:Path"
```

### 4. Jalankan emulator, lalu aplikasi

Dari **root** project, `npm start` sudah menjalankan backend, frontend, Metro, **dan** build/install Android. Agar langkah Android berhasil: jalankan `npm start` dari **CMD** atau **PowerShell** (bukan Git Bash), pastikan **ANDROID_HOME** diset, dan **gradle-wrapper.jar** ada (buka folder android di Android Studio → Sync jika belum). Emulator harus **sudah berjalan** sebelum/saat build.

Kalau hanya mau Metro (tanpa build Android), cukup jalankan Metro saja; build Android bisa dijalankan manual di terminal lain.

1. **Jalankan emulator dulu** (pilih salah satu):
   - **Android Studio** → **Device Manager** (ikon ponsel di toolbar) → pilih AVD → klik **Play**.
   - Atau dari terminal (setelah ANDROID_HOME benar):
     ```powershell
     # Lihat daftar AVD
     & "$env:LOCALAPPDATA\Android\Sdk\emulator\emulator.exe" -list-avds
     # Jalankan AVD (ganti Pixel_5_API_34 dengan nama AVD Anda)
     & "$env:LOCALAPPDATA\Android\Sdk\emulator\emulator.exe" -avd Pixel_5_API_34
     ```
2. **Tunggu emulator sampai layar home Android terbuka.**
3. Di **terminal lain** (dengan Metro sudah jalan lewat `npm start`):
   ```bash
   cd mobile
   npm run android
   ```
   Atau di **PowerShell** (script ini otomatis set ANDROID_HOME untuk sesi ini):
   ```powershell
   cd mobile
   .\run-android.ps1
   ```

Aplikasi akan ter-build dan terbuka di emulator.

**Belum punya AVD?** Di Android Studio: **Tools** → **Device Manager** → **Create Device** → pilih device (mis. Pixel 5) → pilih system image (mis. API 34) → Finish.

---

## Error: "Could not move temporary workspace" (project di OneDrive)

Jika project ada di **OneDrive** (Documents di sync), Gradle sering gagal saat menulis cache (OneDrive mengunci file). Solusi:

1. **Bersihkan cache Gradle lalu coba lagi** (dari folder mobile):
   ```powershell
   Remove-Item -Recurse -Force android\.gradle -ErrorAction SilentlyContinue
   npm run android
   ```
2. **Jika masih gagal:** Pindahkan/clone project ke folder **di luar OneDrive**, misalnya `C:\dev\bintang-global-group`, lalu build dari sana. Build Android sangat tidak disarankan di folder yang di-sync OneDrive.

## Windows / Emulator OOM (Out of Memory)

Jika Windows atau emulator tertutup dengan error **oom** (out of memory):

1. **Batasi RAM emulator:** Android Studio → Device Manager → Edit (ikon pensil) pada AVD → **Show Advanced Settings** → turunkan **RAM** ke 2048 MB atau 1536 MB.
2. **Tutup aplikasi lain** saat build (browser, IDE lain, dll.) agar memori cukup.
3. **Naikkan virtual memory Windows:** Pengaturan → Sistem → Tentang → Pengaturan sistem lanjutan → Performa (Settings) → Advanced → Virtual memory → Change → uncheck "Automatically manage" → set Custom size (Initial dan Maximum) lebih besar, mis. 4096–8192 MB → OK.
4. Batasan Gradle sudah diset di `android/gradle.properties` (mis. `-Xmx1536m`). Jika PC punya RAM besar (8 GB+), bisa naikkan lagi; jika RAM terbatas, biarkan 1536m.

## Script

| Script | Deskripsi |
|--------|-----------|
| `npm start` | Jalankan Metro bundler |
| `npm run android` | Build & run di emulator/device Android |
| `npm run clean:android` | Bersihkan build Android |

## API URL

- **Emulator:** gunakan `http://10.0.2.2:5000/api/v1` (10.0.2.2 = localhost dari emulator).
- **Device fisik:** gunakan IP komputer Anda, misal `http://192.168.1.100:5000/api/v1`.

Atur di `mobile/src/config.ts` atau lewat env (sesuaikan jika pakai env).

## Fitur Owner

- Login (email & password)
- Dashboard
- Daftar Produk
- Daftar Order & Invoice
- Profil & Logout

Token disimpan di AsyncStorage.

---

## Pakai CMD atau PowerShell (bukan Git Bash)

Kalau pakai Git Bash (MINGW64), error "adb is not recognized" atau "gradlew.bat is not recognized" sering muncul karena ANDROID_HOME dan Path tidak terbaca. Jalankan npm run android dari Command Prompt atau PowerShell saja.

---

## Emulator tidak muncul? / adb atau gradlew.bat not recognized?

**Penting:** Jalankan npm run android dari **CMD** atau **PowerShell**, bukan dari Git Bash. Di Git Bash, ANDROID_HOME dan Path Windows sering tidak terbaca sehingga adb dan gradlew.bat tidak dikenali. Buka Command Prompt atau PowerShell, cd ke folder mobile, lalu jalankan npm run android.

Jika build gagal karena gradle-wrapper: buka folder android di Android Studio (File > Open), tunggu Sync Project with Gradle Files selesai, lalu coba lagi.

1. **ANDROID_HOME belum diset** → Ikuti langkah **3. Set ANDROID_HOME** di atas, lalu tutup dan buka lagi terminal.
2. **Belum jalankan emulator** → Metro (`npm start`) tidak membuka emulator. Buka **Device Manager** di Android Studio dan klik Play pada AVD, atau jalankan `emulator -avd <nama_avd>`.
3. **Belum punya AVD** → Buat di Android Studio: **Tools** → **Device Manager** → **Create Device**.
4. Setelah emulator hidup, di terminal lain: cd mobile lalu npm run android.

**Pakai CMD atau PowerShell, bukan Git Bash.** Di Git Bash, ANDROID_HOME/Path sering tidak terbaca sehingga adb dan gradlew.bat tidak dikenali. Buka CMD atau PowerShell baru, cd ke folder mobile, lalu npm run android.

**Jika gradlew.bat / gradle error:** Buka folder android di Android Studio (File > Open > mobile/android), tunggu Sync Project with Gradle Files selesai, lalu coba lagi npm run android dari CMD/PowerShell.

---

## Pakai CMD atau PowerShell (bukan Git Bash)

Jika muncul error **'adb' is not recognized** atau **'gradlew.bat' is not recognized** saat pakai **Git Bash (MINGW64)**, itu karena variabel environment Windows (ANDROID_HOME, Path) sering tidak terbaca di Git Bash.

**Solusi:** Jalankan `npm run android` dari **Command Prompt (CMD)** atau **PowerShell**, bukan Git Bash. Tutup Git Bash, buka CMD/PowerShell baru, lalu:

```bat
cd C:\Users\preed\OneDrive\Documents\bintang-global-group\mobile
npm run android
```

---

## gradlew.bat / gradle-wrapper.jar

Jika build gagal dengan **gradlew.bat is not recognized** atau error tentang gradle-wrapper:

1. Buka **Android Studio** → **File** → **Open** → pilih folder **mobile\android**.
2. Tunggu **Sync Project with Gradle Files** selesai (Android Studio akan download wrapper jika perlu).
3. Setelah sync berhasil, coba lagi `npm run android` dari **CMD** atau **PowerShell**.
