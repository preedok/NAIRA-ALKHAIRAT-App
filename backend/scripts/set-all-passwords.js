/**
 * Set password semua user di database menjadi Yakusa123@
 * Jalankan dari folder backend: node scripts/set-all-passwords.js
 * Berguna untuk update password user yang sudah ada tanpa re-seed (tanpa hapus data).
 */
require('dotenv').config();
const path = require('path');
const bcrypt = require('bcryptjs');

const sequelize = require(path.join(__dirname, '../src/config/sequelize'));
const { User } = require(path.join(__dirname, '../src/models'));

const NEW_PASSWORD = 'Yakusa123@';

async function main() {
  const hash = await bcrypt.hash(NEW_PASSWORD, 10);
  const [updated] = await User.update(
    { password_hash: hash },
    { where: {} }
  );
  console.log(`Password ${updated} user diubah menjadi: ${NEW_PASSWORD}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
