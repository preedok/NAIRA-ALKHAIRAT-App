require('dotenv').config();
const app = require('./app');
const sequelize = require('./config/sequelize');
const logger = require('./config/logger');

// Load models (register with sequelize)
require('./models');

const PORT = process.env.PORT || 5000;

/** Ensure users table has password_hash column (fix login error if column was missing or named differently) */
async function ensureUsersPasswordHashColumn(db) {
  try {
    const [rows] = await db.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users'
      AND column_name IN ('password_hash', 'passwordhash', 'password');
    `);
    const columns = (rows || []).map(r => r.column_name);
    if (columns.includes('password_hash')) return;
    if (columns.includes('passwordhash')) {
      await db.query('ALTER TABLE users RENAME COLUMN passwordhash TO password_hash');
      logger.info('users: renamed column passwordhash -> password_hash');
      return;
    }
    if (columns.includes('password')) {
      await db.query('ALTER TABLE users RENAME COLUMN password TO password_hash');
      logger.info('users: renamed column password -> password_hash');
      return;
    }
    await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)');
    logger.info('users: added column password_hash');
  } catch (e) {
    logger.warn('ensureUsersPasswordHashColumn:', e.message);
  }
}

/** Ensure maintenance_notices has block_app column (untuk blokir akses aplikasi) */
async function ensureMaintenanceBlockAppColumn(db) {
  try {
    const [rows] = await db.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'maintenance_notices' AND column_name = 'block_app';
    `);
    if (rows && rows.length > 0) return;
    await db.query('ALTER TABLE maintenance_notices ADD COLUMN IF NOT EXISTS block_app BOOLEAN DEFAULT false');
    logger.info('maintenance_notices: added column block_app');
  } catch (e) {
    logger.warn('ensureMaintenanceBlockAppColumn:', e.message);
  }
}

/** Ensure invoices has currency_rates_snapshot column (kurs snapshot saat invoice dibuat) */
async function ensureInvoicesCurrencyRatesSnapshotColumn(db) {
  try {
    const [rows] = await db.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'invoices' AND column_name = 'currency_rates_snapshot';
    `);
    if (rows && rows.length > 0) return;
    await db.query('ALTER TABLE invoices ADD COLUMN IF NOT EXISTS currency_rates_snapshot JSONB NULL');
    logger.info('invoices: added column currency_rates_snapshot');
  } catch (e) {
    logger.warn('ensureInvoicesCurrencyRatesSnapshotColumn:', e.message);
  }
}

/** Ensure owner_profiles has is_mou_owner column (MOU vs non-MOU owner) */
async function ensureOwnerProfilesIsMouOwnerColumn(db) {
  try {
    const [rows] = await db.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'owner_profiles' AND column_name = 'is_mou_owner'
      LIMIT 1
    `);
    if (rows && rows.length > 0) return;
    await db.query('ALTER TABLE owner_profiles ADD COLUMN IF NOT EXISTS is_mou_owner BOOLEAN NOT NULL DEFAULT false');
    await db.query('UPDATE owner_profiles SET is_mou_owner = true');
    logger.info('owner_profiles: added column is_mou_owner');
  } catch (e) {
    logger.warn('ensureOwnerProfilesIsMouOwnerColumn:', e.message);
  }
}

/** Ensure users has last_activity_at (untuk deteksi online realtime) */
async function ensureUsersLastActivityAtColumn(db) {
  try {
    const [rows] = await db.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'last_activity_at'
      LIMIT 1
    `);
    if (rows && rows.length > 0) return;
    await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP WITH TIME ZONE NULL');
    logger.info('users: added column last_activity_at');
  } catch (e) {
    logger.warn('ensureUsersLastActivityAtColumn:', e.message);
  }
}

/** Ensure enum_users_role has owner_mou, owner_non_mou; migrate existing owner -> owner_mou */
async function ensureOwnerRolesEnum(db) {
  try {
    for (const val of ['owner_mou', 'owner_non_mou']) {
      try {
        await db.query(`ALTER TYPE "enum_users_role" ADD VALUE '${val}'`);
      } catch (e) {
        if (!String(e.message || '').includes('already exists')) logger.warn('ensureOwnerRolesEnum:', e.message);
      }
    }
    await db.query(`UPDATE users SET role = 'owner_mou', updated_at = NOW() WHERE role = 'owner'`);
  } catch (e) {
    logger.warn('ensureOwnerRolesEnum:', e.message);
  }
}

// alter: false by default — avoid ALTER when DB has views (e.g. v_orders_summary) that depend on tables.
// Set SYNC_ALTER=true only when you need schema changes and have dropped dependent views.
sequelize.sync({ alter: process.env.SYNC_ALTER === 'true' })
  .then(() => ensureUsersPasswordHashColumn(sequelize))
  .then(() => ensureMaintenanceBlockAppColumn(sequelize))
  .then(() => ensureInvoicesCurrencyRatesSnapshotColumn(sequelize))
  .then(() => ensureOwnerProfilesIsMouOwnerColumn(sequelize))
  .then(() => ensureUsersLastActivityAtColumn(sequelize))
  .then(() => ensureOwnerRolesEnum(sequelize))
  .then(async () => {
    logger.info('Database synchronized');
    const { SystemLog } = require('./models');
    await SystemLog.create({ source: 'backend', level: 'info', message: 'Database ready', meta: {} }).catch((err) => {
      console.error('SystemLog create failed (pastikan tabel system_logs ada):', err.message);
    });
    app.listen(PORT, async () => {
      const apiVersion = process.env.API_VERSION || 'v1';
      const apiUrl = (process.env.NODE_ENV === 'production' && process.env.CORS_ORIGIN)
        ? `${process.env.CORS_ORIGIN}/api/${apiVersion}`
        : `http://localhost:${PORT}/api/${apiVersion}`;
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`📊 Environment: ${process.env.NODE_ENV}`);
      logger.info(`🗄️  Database: PostgreSQL`);
      logger.info(`🌐 API: ${apiUrl}`);
      await SystemLog.create({ source: 'backend', level: 'info', message: 'Server started', meta: { port: PORT } }).catch((err) => {
        console.error('SystemLog (Server started) failed:', err.message);
      });
    });
  })
  .catch(err => {
    logger.error('Failed to sync database:', err);
    process.exit(1);
  });

process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Rejection:', err);
  process.exit(1);
});
