/**
 * Hapus data user lama dan buat akun workflow koordinator (pakai Model agar data benar-benar masuk DB).
 * Jalankan dari folder backend: node scripts/seed-workflow-koordinator-users.js
 */
require('dotenv').config();
const path = require('path');

const sequelize = require(path.join(__dirname, '../src/config/sequelize'));
const {
  User,
  OwnerProfile,
  Wilayah,
  Branch,
  Provinsi,
  OrderItem,
  PaymentProof,
  Invoice,
  Order,
  HotelProgress,
  VisaProgress,
  TicketProgress,
  BusProgress
} = require(path.join(__dirname, '../src/models'));
const { ROLES, OWNER_STATUS } = require(path.join(__dirname, '../src/constants'));
const bcrypt = require('bcryptjs');

const DEFAULT_PASSWORD = 'Password123';
const slug = (name) => name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
const WILAYAH_KERJA_NAMA = ['Bali-Nusa Tenggara', 'Jawa', 'Kalimantan'];

async function main() {
  console.log('Menghapus data lama (order items, payment proofs, invoices, orders, owner_profiles, users)...');
  await HotelProgress.destroy({ where: {} }).catch(() => {});
  await VisaProgress.destroy({ where: {} }).catch(() => {});
  await TicketProgress.destroy({ where: {} }).catch(() => {});
  await BusProgress.destroy({ where: {} }).catch(() => {});
  await OrderItem.destroy({ where: {} }).catch(() => {});
  await PaymentProof.destroy({ where: {} }).catch(() => {});
  await Invoice.destroy({ where: {} }).catch(() => {});
  await Order.destroy({ where: {} }).catch(() => {});
  await OwnerProfile.destroy({ where: {} });
  // Kosongkan referensi ke users di tabel lain agar user bisa dihapus
  await sequelize.query('UPDATE products SET created_by = NULL WHERE created_by IS NOT NULL').catch(() => {});
  await sequelize.query('UPDATE product_prices SET created_by = NULL, owner_id = NULL WHERE created_by IS NOT NULL OR owner_id IS NOT NULL').catch(() => {});
  await sequelize.query('UPDATE business_rule_configs SET updated_by = NULL WHERE updated_by IS NOT NULL').catch(() => {});
  await sequelize.query('DELETE FROM notifications').catch(() => {});
  await sequelize.query('DELETE FROM audit_logs').catch(() => {});
  await sequelize.query('UPDATE invoices SET unblocked_by = NULL WHERE unblocked_by IS NOT NULL').catch(() => {});
  await sequelize.query('UPDATE payroll_runs SET created_by = NULL WHERE created_by IS NOT NULL').catch(() => {});
  await sequelize.query('DELETE FROM payroll_items').catch(() => {});
  await sequelize.query('DELETE FROM employee_salaries').catch(() => {});
  await sequelize.query('UPDATE refunds SET requested_by = NULL, approved_by = NULL WHERE requested_by IS NOT NULL OR approved_by IS NOT NULL').catch(() => {});
  await sequelize.query('UPDATE invoice_files SET generated_by = NULL WHERE generated_by IS NOT NULL').catch(() => {});
  await sequelize.query('UPDATE maintenance_notices SET created_by = NULL WHERE created_by IS NOT NULL').catch(() => {});
  await sequelize.query('UPDATE product_availability SET updated_by = NULL WHERE updated_by IS NOT NULL').catch(() => {});
  // Semua kolom yang referensi users (pastikan nama tabel/kolom sesuai DB)
  const userFkTables = [
    ['journal_entry_lines', 'created_by'],
    ['journal_entries', 'created_by'],
    ['journal_entries', 'approved_by'],
    ['journal_entries', 'posted_by'],
    ['system_logs', 'user_id'],
    ['payroll_runs', 'approved_by']
  ];
  for (const [table, col] of userFkTables) {
    await sequelize.query(`UPDATE ${table} SET ${col} = NULL WHERE ${col} IS NOT NULL`).catch(() => {});
  }
  await User.destroy({ where: {} });
  console.log('Data lama terhapus.');

  const hash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  // 1) Super Admin, Admin Pusat, Accounting
  await User.create({
    email: 'superadmin@bintangglobal.com',
    password_hash: hash,
    name: 'Super Admin',
    role: ROLES.SUPER_ADMIN,
    is_active: true
  });
  await User.create({
    email: 'adminpusat@bintangglobal.com',
    password_hash: hash,
    name: 'Admin Pusat',
    role: ROLES.ADMIN_PUSAT,
    is_active: true
  });
  await User.create({
    email: 'accounting@bintangglobal.com',
    password_hash: hash,
    name: 'Accounting Pusat',
    role: ROLES.ROLE_ACCOUNTING,
    is_active: true
  });

  // 2) Saudi
  await User.create({ email: 'hotel.saudi@bintangglobal.com', password_hash: hash, name: 'Hotel Saudi Arabia', role: ROLES.ROLE_HOTEL, is_active: true });
  await User.create({ email: 'bus.saudi@bintangglobal.com', password_hash: hash, name: 'Bus Saudi Arabia', role: ROLES.ROLE_BUS, is_active: true });
  await User.create({ email: 'invoice.saudi@bintangglobal.com', password_hash: hash, name: 'Invoice Saudi Arabia', role: ROLES.ROLE_INVOICE_SAUDI, is_active: true });

  // 3) Wilayah untuk koordinator
  const allWilayah = await Wilayah.findAll({ attributes: ['id', 'name'], order: [['name', 'ASC']] });
  const wilayahByName = {};
  (allWilayah || []).forEach((r) => { wilayahByName[r.name] = r; });
  const wilayahList = WILAYAH_KERJA_NAMA.map((n) => wilayahByName[n]).filter(Boolean);
  if (wilayahList.length === 0 && allWilayah.length >= 3) {
    wilayahList.push(allWilayah[0], allWilayah[1], allWilayah[2]);
  }

  // 4) Koordinator per wilayah (12 akun)
  for (const w of wilayahList) {
    const wName = w.name || '';
    const pre = slug(wName).slice(0, 20) || 'wilayah';
    await User.create({
      email: `admin-koord.${pre}@bintangglobal.com`,
      password_hash: hash,
      name: `Admin Koordinator ${wName}`,
      role: ROLES.ADMIN_KOORDINATOR,
      wilayah_id: w.id,
      is_active: true
    });
    await User.create({
      email: `invoice-koord.${pre}@bintangglobal.com`,
      password_hash: hash,
      name: `Invoice Koordinator ${wName}`,
      role: ROLES.INVOICE_KOORDINATOR,
      wilayah_id: w.id,
      is_active: true
    });
    await User.create({
      email: `tiket-koord.${pre}@bintangglobal.com`,
      password_hash: hash,
      name: `Tiket Koordinator ${wName}`,
      role: ROLES.TIKET_KOORDINATOR,
      wilayah_id: w.id,
      is_active: true
    });
    await User.create({
      email: `visa-koord.${pre}@bintangglobal.com`,
      password_hash: hash,
      name: `Visa Koordinator ${wName}`,
      role: ROLES.VISA_KOORDINATOR,
      wilayah_id: w.id,
      is_active: true
    });
  }

  // 5) Cabang per wilayah (untuk assign owner)
  const ownerBranches = [];
  for (const w of wilayahList) {
    const branch = await Branch.findOne({
      attributes: ['id'],
      include: [{ model: Provinsi, as: 'Provinsi', where: { wilayah_id: w.id }, required: true }]
    });
    if (branch) ownerBranches.push(branch.id);
  }
  if (ownerBranches.length === 0) {
    const branches = await Branch.findAll({ attributes: ['id'], limit: 3, order: [['createdAt', 'ASC']] });
    branches.forEach((b) => ownerBranches.push(b.id));
  }

  // 6) Owner: 9 akun (3 per wilayah)
  const ownerSpecs = [
    { email: 'owner.denpasar@bintangglobal.com', name: 'Owner Travel Denpasar', company_name: 'Travel Bali Nusantara', wilayahIndex: 0 },
    { email: 'owner.lombok@bintangglobal.com', name: 'Owner Travel Lombok', company_name: 'CV Lombok Travel', wilayahIndex: 0 },
    { email: 'owner.kupang@bintangglobal.com', name: 'Owner Travel Kupang', company_name: 'PT Travel Kupang', wilayahIndex: 0 },
    { email: 'owner.pati@bintangglobal.com', name: 'Owner Travel Pati', company_name: 'Travel Pati Jaya', wilayahIndex: 1 },
    { email: 'owner.bandung@bintangglobal.com', name: 'Owner Travel Bandung', company_name: 'CV Travel Bandung', wilayahIndex: 1 },
    { email: 'owner.surabaya@bintangglobal.com', name: 'Owner Travel Surabaya', company_name: 'PT Travel Surabaya', wilayahIndex: 1 },
    { email: 'owner.samarinda@bintangglobal.com', name: 'Owner Travel Samarinda', company_name: 'PT Travel Samarinda Utama', wilayahIndex: 2 },
    { email: 'owner.pontianak@bintangglobal.com', name: 'Owner Travel Pontianak', company_name: 'CV Travel Pontianak', wilayahIndex: 2 },
    { email: 'owner.balikpapan@bintangglobal.com', name: 'Owner Travel Balikpapan', company_name: 'Travel Balikpapan', wilayahIndex: 2 }
  ];

  const now = new Date();
  for (const o of ownerSpecs) {
    const user = await User.create({
      email: o.email,
      password_hash: hash,
      name: o.name,
      role: ROLES.OWNER,
      company_name: o.company_name,
      is_active: true
    });
    const branchId = ownerBranches[o.wilayahIndex] || ownerBranches[0];
    await OwnerProfile.create({
      user_id: user.id,
      status: OWNER_STATUS.ACTIVE,
      assigned_branch_id: branchId,
      activated_at: now
    });
  }

  const totalUsers = await User.count();
  console.log('Selesai. Total user di database:', totalUsers);
  console.log('Password semua akun: ' + DEFAULT_PASSWORD);
  process.exit(0);
}

main().catch((err) => {
  console.error('Error:', err.message || err);
  process.exit(1);
});
