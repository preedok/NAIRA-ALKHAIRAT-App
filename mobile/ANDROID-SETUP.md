# Perbaikan: adb / gradlew / emulator tidak ditemukan

## 0. Error "Could not move temporary workspace" (Gradle di Windows)

Jika build gagal dengan:
`Error resolving plugin [id: 'com.facebook.react.settings'] > Could not move temporary workspace ... to immutable location`

Penyebab umum: **Windows Defender** (atau antivirus lain) mengunci file di folder `.gradle` saat Gradle menulis cache.

**Solusi:** Tambahkan **pengecualian (exclusion)** untuk folder project:

1. Buka **Windows Security** → **Virus & threat protection** → **Manage settings** (di "Virus & threat protection settings")
2. Scroll ke **Exclusions** → **Add or remove exclusions** → **Add an exclusion** → **Folder**
3. Pilih folder project, misalnya: `C:\dev\bintang-global-group`

Atau lewat PowerShell (Admin):
```powershell
Add-MpPreference -ExclusionPath "C:\dev\bintang-global-group"
```

**Alternatif: Pakai Gradle 8.5 dari file lokal (tidak kena bug "Could not move"):** Project ini sudah dikonfigurasi untuk pakai Gradle 8.5 dari zip lokal. Unduh sekali lalu build seperti biasa:
```powershell
cd mobile\android\gradle\wrapper
powershell -ExecutionPolicy Bypass -File download-gradle-8.5.ps1
cd ..\..\..
npm run android
```
Zip (~110 MB) akan ada di `android/gradle/wrapper/gradle-8.5-all.zip`. **Hapus dulu cache lama** lalu jalankan android:
```powershell
cd mobile
Remove-Item -Recurse -Force android\.gradle -ErrorAction SilentlyContinue
npm run android
```
Setelah itu setiap `npm run android` memakai Gradle 8.5 dari file itu (tanpa unduh lagi).

**Alternatif lain (subst):** Jalankan build lewat drive virtual supaya path `.gradle` berubah:
```powershell
cd c:\dev\bintang-global-group\mobile
npm run android:subst
```
Script ini memetakan `G:` ke folder project lalu menjalankan build dari `G:\mobile`.

Setelah itu, jalankan build lagi. Setiap `npm run android` sekarang otomatis menghapus folder `dependencies-accessors` dulu (script `mobile/scripts/clean-gradle-accessors.js`). Jika error tetap muncul, hapus seluruh cache lalu coba lagi:
```powershell
cd mobile\android
Remove-Item -Recurse -Force .gradle -ErrorAction SilentlyContinue
cd ..
npm run android
```

---

## 1. Pakai CMD atau PowerShell (bukan Git Bash)

Di **Git Bash (MINGW64)** variabel environment Windows (ANDROID_HOME, Path) kadang tidak terbaca. Jadi `adb` dan `emulator` tidak dikenali.

**Solusi:** Jalankan `npm run android` dari **CMD** atau **PowerShell** (bukan Git Bash). Tutup Git Bash, buka Command Prompt atau PowerShell, lalu:

```
cd path\to\bintang-global-group\mobile
npm run android
```

Di CMD/PowerShell, `adb` dan `emulator` akan dikenali setelah ANDROID_HOME dan Path diset.

---

## 2. File gradle-wrapper.jar belum ada

Pesan `gradlew.bat is not recognized` atau error saat build bisa karena **gradle-wrapper.jar** di `android\gradle\wrapper\` belum ada.

**Solusi:** Buka folder **android** di Android Studio:

1. File → Open → pilih folder `mobile\android`
2. Tunggu "Sync Project with Gradle Files" selesai (Android Studio bisa meminta download Gradle/wrapper)
3. Setelah sync berhasil, coba lagi di CMD/PowerShell: `npm run android`

---

## 3. Buat AVD (emulator) jika belum ada

**No emulators found** = belum ada Android Virtual Device.

1. Android Studio → Device Manager (ikon ponsel) → Create Device
2. Pilih device (mis. Pixel 5) → Next → pilih System Image (mis. API 34) → Next → Finish
3. Klik **Play** pada AVD, tunggu layar home Android
4. Di CMD/PowerShell: `cd mobile` lalu `npm run android` (Metro sudah jalan di terminal lain)

---

## Ringkasan

1. Pakai **CMD atau PowerShell**, bukan Git Bash
2. Buka **android** di Android Studio sekali → Sync Project (agar gradle-wrapper ada)
3. Buat AVD dan jalankan emulator (Play)
4. `cd mobile` → `npm run android`
