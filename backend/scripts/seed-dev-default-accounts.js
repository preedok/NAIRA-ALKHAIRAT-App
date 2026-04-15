/**
 * Akun default untuk development / lokal. Idempotent (aman dijalankan ulang).
 * Password di-hash dengan bcrypt; pengguna yang sudah ada akan diselaraskan role/cabang/password.
 *
 * Usage (dari folder backend):
 *   npm run seed:dev-accounts
 *
 * Password default: Password123 (atau set DEV_SEED_PASSWORD di .env)
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const { User, Branch, sequelize } = require('../src/models');
const { ROLES } = require('../src/constants');

const DEV_PASSWORD = process.env.DEV_SEED_PASSWORD || 'Password123';
const BRANCH_NAME = 'Cabang Demo (Dev Seed)';

const ACCOUNTS = [
  { email: 'admin.pusat@local.dev', name: 'Admin Pusat (Dev)', role: ROLES.ADMIN_PUSAT, needsBranch: false },
  { email: 'admin.cabang@local.dev', name: 'Admin Cabang (Dev)', role: ROLES.ADMIN_CABANG, needsBranch: true },
  { email: 'jamaah.demo@local.dev', name: 'Jamaah Demo (Dev)', role: ROLES.JAMAAH, needsBranch: true }
];

async function run() {
  await sequelize.authenticate();
  let branch = await Branch.findOne({ where: { name: BRANCH_NAME } });
  if (!branch) {
    branch = await Branch.create({ name: BRANCH_NAME });
  }
  const passwordHash = await bcrypt.hash(String(DEV_PASSWORD), 10);
  for (const a of ACCOUNTS) {
    const branchId = a.needsBranch ? branch.id : null;
    const [user, created] = await User.findOrCreate({
      where: { email: a.email },
      defaults: {
        name: a.name,
        email: a.email,
        password_hash: passwordHash,
        role: a.role,
        branch_id: branchId,
        is_active: true
      }
    });
    if (!created) {
      await user.update({
        name: a.name,
        password_hash: passwordHash,
        role: a.role,
        branch_id: branchId,
        is_active: true
      });
    }
  }
  // eslint-disable-next-line no-console
  console.log('seed:dev-accounts selesai. Detail: backend/SEED_ACCOUNTS.md');
  process.exit(0);
}

run().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
