# Troubleshooting Emulator Android

## "The emulator process for AVD ... has terminated"

Emulator gagal jalan sama sekali (proses berhenti sebelum home screen). Sering terjadi pada **API 35/36** (Android 15/16).

**Langkah perbaikan:**

1. **Buat AVD baru dengan API 33 atau 34** (paling disarankan)
   - Device Manager → **+** (Create Device) → pilih device (mis. Pixel 6) → Next.
   - Di **System Image** pilih **API 33** (Android 13) atau **API 34** (Android 14). Download jika belum ada.
   - Next → Finish. Jalankan AVD baru ini untuk development.

2. **Naikkan RAM** (untuk AVD yang sudah ada)
   - Edit AVD → **Show Advanced Settings** → **RAM** = **4096 MB** (minimal 2048 MB).

3. **Cold Boot**
   - ⋮ di samping AVD → **Cold Boot Now** (bukan Run biasa).

4. **Cek virtualisasi**
   - Windows: pastikan **Hyper-V** atau **Windows Hypervisor Platform** aktif (Windows Features).
   - BIOS: virtualisation (Intel VT-x / AMD-V) enabled.

---

## "System UI isn't responding"

Error ini dari **Android System UI** (status bar, navigasi) di emulator, bukan dari app React Native.

## Solusi (coba berurutan)

### 1. Cold boot + Wipe data
1. Buka **Android Studio** → **Device Manager** (ikon ponsel di kanan).
2. Klik **⋮** di samping AVD → **Cold Boot Now**.
3. Atau **Wipe Data** (hapus data emulator, seperti reset pabrik).

### 2. Tingkatkan resource emulator
1. Device Manager → **Edit** (ikon pensil) AVD Anda.
2. **Show Advanced Settings**.
3. **RAM**: minimal **2048 MB**, ideal **4096 MB**.
4. **VM heap**: **512 MB** atau lebih.
5. Simpan dan jalankan ulang emulator.

### 3. Pakai system image yang lebih ringan
- Buat AVD baru dengan **API 33** (bukan 34+) atau **API 31**.
- Pilih image **x86** (bukan x86_64) jika PC Anda mendukung.
- Hindari image "Google Play" jika tidak wajib (biasanya lebih berat).

### 4. Jalankan emulator dulu, baru app
```bash
# 1. Buka emulator dari Android Studio (Device Manager → Run)
# 2. Tunggu sampai home screen tampil
# 3. Baru jalankan:
cd mobile
npm run android
```

### 5. Restart System UI di emulator (tanpa wipe)
- Di emulator: **Settings** → **Apps** → **System UI** → **Force Stop** lalu **Open**.
- Atau matikan emulator (Power off) lalu jalankan lagi dengan **Cold Boot Now**.

### 6. Pakai device fisik
- Aktifkan **Developer options** → **USB debugging**.
- Sambungkan via USB, lalu: `npm run android` (akan pakai device yang terdeteksi).

---

## Jika app tidak tampil (tapi emulator normal)

1. Pastikan Metro bundler jalan: `npm start` (di folder `mobile`).
2. Di terminal lain: `npm run android`.
3. Cek bahwa backend API bisa diakses dari emulator (mis. `10.0.2.2:5000` untuk localhost).
