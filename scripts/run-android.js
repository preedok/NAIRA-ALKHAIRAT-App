const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

const mobileDir = path.join(__dirname, '..', 'mobile');
const wrapperJar = path.join(mobileDir, 'android', 'gradle', 'wrapper', 'gradle-wrapper.jar');

// Cek gradle-wrapper.jar (tanpa ini build pasti gagal)
if (!fs.existsSync(wrapperJar)) {
  console.log('[android] gradle-wrapper.jar tidak ditemukan. Lewati build Android.');
  console.log('[android] Untuk perbaikan: buka folder mobile/android di Android Studio lalu Sync Project with Gradle Files.');
  process.exit(0);
}

// Cek ANDROID_HOME (di Git Bash sering kosong; di CMD/PowerShell harus diset)
const androidHome = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
const hasAndroidHome = androidHome && fs.existsSync(path.join(androidHome, 'platform-tools', 'adb' + (process.platform === 'win32' ? '.exe' : '')));
if (!hasAndroidHome) {
  console.log('[android] ANDROID_HOME tidak terdeteksi. Lewati build Android.');
  console.log('[android] Jalankan npm start dari CMD atau PowerShell (bukan Git Bash), dan pastikan ANDROID_HOME diset.');
  process.exit(0);
}

// Tunggu sebentar agar Metro sempat naik
setTimeout(() => {
  const result = spawnSync('npm', ['run', 'android'], { cwd: mobileDir, stdio: 'inherit', shell: true });
  process.exit(result.status !== 0 ? 0 : 0); // jangan gagalkan npm start
}, 8000);
