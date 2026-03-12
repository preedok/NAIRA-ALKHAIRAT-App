const PORT = process.env.PORT || 5000;

/** Fallback server jika require/app gagal — agar Nginx dapat response (bukan 502) dan error terlihat di log */
function startFallbackServer(err) {
  const http = require('http');
  const msg = (err && (err.message || err.stack)) ? String(err.message || err.stack) : 'Unknown startup error';
  console.error('[FALLBACK] Startup failed:', msg);
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/health' || req.url === '/api/v1/health') {
      res.writeHead(200);
      res.end(JSON.stringify({ status: 'degraded', error: msg, hint: 'Cek log backend / .env / koneksi DB' }));
    } else {
      res.writeHead(503);
      res.end(JSON.stringify({ success: false, message: 'Backend startup failed', error: msg }));
    }
  });
  server.listen(PORT, () => console.error(`[FALLBACK] Listening on ${PORT} — perbaiki error lalu pm2 restart bgg-backend`));
}

let app, sequelize, logger;
try {
  require('dotenv').config();
  app = require('./app');
  sequelize = require('./config/sequelize');
  logger = require('./config/logger');
  require('./models');
} catch (e) {
  startFallbackServer(e);
  process.exitCode = 1;
  return;
}

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

/** Ensure users table has last_login_at and last_activity_at (untuk login & fitur online) */
async function ensureUsersLastLoginColumns(db) {
  try {
    const [rows] = await db.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users'
      AND column_name IN ('last_login_at', 'last_activity_at');
    `);
    const have = (rows || []).map(r => r.column_name);
    if (!have.includes('last_login_at')) {
      await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE NULL');
      logger.info('users: added column last_login_at');
    }
    if (!have.includes('last_activity_at')) {
      await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP WITH TIME ZONE NULL');
      logger.info('users: added column last_activity_at');
    }
  } catch (e) {
    logger.warn('ensureUsersLastLoginColumns:', e.message);
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

/** Ensure orders has waive_bus_penalty column (tanpa penalti bus = pakai 1 Hiace) */
async function ensureOrdersWaiveBusPenaltyColumn(db) {
  try {
    const [rows] = await db.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'waive_bus_penalty'
      LIMIT 1
    `);
    if (rows && rows.length > 0) return;
    await db.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS waive_bus_penalty BOOLEAN NOT NULL DEFAULT false');
    logger.info('orders: added column waive_bus_penalty');
  } catch (e) {
    logger.warn('ensureOrdersWaiveBusPenaltyColumn:', e.message);
  }
}

/** Ensure orders has bus_include_* columns (progress bus untuk order tanpa item bus) */
async function ensureOrderBusIncludeColumns(db) {
  try {
    await db.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS bus_include_ticket_status VARCHAR(50) DEFAULT \'pending\'');
    await db.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS bus_include_ticket_info VARCHAR(500)');
    await db.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS bus_include_arrival_status VARCHAR(50) DEFAULT \'pending\'');
    await db.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS bus_include_departure_status VARCHAR(50) DEFAULT \'pending\'');
    await db.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS bus_include_return_status VARCHAR(50) DEFAULT \'pending\'');
    await db.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS bus_include_notes TEXT');
    await db.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS bus_include_ticket_file_url VARCHAR(500)');
  } catch (e) {
    logger.warn('ensureOrderBusIncludeColumns:', e.message);
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

// Start HTTP server first so Nginx gets a response (avoid 502 while DB initializes)
const apiVersion = process.env.API_VERSION || 'v1';
const apiUrl = (process.env.NODE_ENV === 'production' && process.env.CORS_ORIGIN)
  ? `${process.env.CORS_ORIGIN}/api/${apiVersion}`
  : `http://localhost:${PORT}/api/${apiVersion}`;

app.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT}`);
  logger.info(`📊 Environment: ${process.env.NODE_ENV}`);
  logger.info(`🗄️  Database: PostgreSQL`);
  logger.info(`🌐 API: ${apiUrl}`);
});

// Then sync DB and run ensure* (non-blocking; failures logged but server stays up)
const alter = process.env.SYNC_ALTER === 'true';
sequelize.sync({ alter })
  .then(() => ensureUsersPasswordHashColumn(sequelize))
  .then(() => ensureUsersLastLoginColumns(sequelize))
  .then(() => ensureMaintenanceBlockAppColumn(sequelize))
  .then(() => ensureInvoicesCurrencyRatesSnapshotColumn(sequelize))
  .then(() => ensureOrdersWaiveBusPenaltyColumn(sequelize))
  .then(() => ensureOrderBusIncludeColumns(sequelize))
  .then(() => ensureOwnerProfilesIsMouOwnerColumn(sequelize))
  .then(() => ensureOwnerRolesEnum(sequelize))
  .then(async () => {
    logger.info('Database synchronized');
    const { SystemLog } = require('./models');
    await SystemLog.create({ source: 'backend', level: 'info', message: 'Database ready', meta: {} }).catch((err) => {
      console.error('SystemLog create failed (pastikan tabel system_logs ada):', err.message);
    });
    await SystemLog.create({ source: 'backend', level: 'info', message: 'Server started', meta: { port: PORT } }).catch((err) => {
      console.error('SystemLog (Server started) failed:', err.message);
    });
  })
  .catch(err => {
    logger.error('Failed to sync database:', err);
    // Jangan exit(1) agar server tetap jalan; /health dan retry request tetap bisa
  });

process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Rejection:', err);
  if (process.env.NODE_ENV !== 'production') process.exit(1);
});
