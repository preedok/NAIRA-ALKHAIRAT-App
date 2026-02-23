/**
 * Hapus folder dependencies-accessors sebelum build agar tidak kena
 * error "Could not move temporary workspace" di Windows (Gradle 8.6–8.11).
 * Jalankan sekali sebelum react-native run-android.
 */
const path = require('path');
const fs = require('fs');

const accessorsDir = path.join(__dirname, '..', 'android', '.gradle', '8.10.2', 'dependencies-accessors');
if (fs.existsSync(accessorsDir)) {
  try {
    fs.rmSync(accessorsDir, { recursive: true });
    console.log('[android] Cleared .gradle dependencies-accessors for clean build.');
  } catch (e) {
    // Ignore; build might still succeed
  }
}
