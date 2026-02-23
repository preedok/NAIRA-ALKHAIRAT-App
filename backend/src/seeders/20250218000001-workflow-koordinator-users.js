'use strict';

/**
 * Workflow Koordinator per Wilayah: Hapus data user lama, buat akun baru.
 *
 * - Admin Pusat, Saudi (Hotel, Bus, Invoice Saudi).
 * - Koordinator: 3 wilayah kerja (Bali-Nusa Tenggara, Jawa, Kalimantan). Masing-masing wilayah punya:
 *   Admin Koordinator, Invoice Koordinator, Tiket Koordinator, Visa Koordinator (12 akun).
 * - Owner: 9 akun (3 per wilayah). Owner dari daerah tertentu otomatis masuk ke koordinator wilayah tersebut.
 *   Contoh: Owner Kabupaten Sarolangun (Jambi) → Wilayah Sumatra; Owner Kabupaten Pati (Jateng) → Wilayah Jawa.
 *   Koordinator Sumatra tidak bisa memproses owner dari Pati, dan sebaliknya.
 */
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { ROLES, OWNER_STATUS } = require('../constants');

const DEFAULT_PASSWORD = 'Password123';
const uuid = () => crypto.randomUUID();
const slug = (name) => name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

// 3 wilayah kerja: Bali-Nusa Tenggara, Jawa, Kalimantan (sesuai master wilayah)
const WILAYAH_KERJA_NAMA = ['Bali-Nusa Tenggara', 'Jawa', 'Kalimantan'];

module.exports = {
  async up(queryInterface, Sequelize) {
    const q = queryInterface.sequelize;
    const now = new Date();
    const hash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

    // 1) Hapus data lama
    await q.query(`DELETE FROM owner_profiles`).catch(() => {});
    await q.query(`DELETE FROM users`).catch(() => {});

    const usersToInsert = [];

    // 2) Super Admin
    usersToInsert.push({
      id: uuid(),
      email: 'superadmin@bintangglobal.com',
      password_hash: hash,
      name: 'Super Admin',
      role: ROLES.SUPER_ADMIN,
      branch_id: null,
      wilayah_id: null,
      is_active: true,
      created_at: now,
      updated_at: now
    });

    // 3) Admin Pusat
    usersToInsert.push({
      id: uuid(),
      email: 'adminpusat@bintangglobal.com',
      password_hash: hash,
      name: 'Admin Pusat',
      role: ROLES.ADMIN_PUSAT,
      branch_id: null,
      wilayah_id: null,
      is_active: true,
      created_at: now,
      updated_at: now
    });

    // 4) Accounting Pusat
    usersToInsert.push({
      id: uuid(),
      email: 'accounting@bintangglobal.com',
      password_hash: hash,
      name: 'Accounting Pusat',
      role: ROLES.ROLE_ACCOUNTING,
      branch_id: null,
      wilayah_id: null,
      is_active: true,
      created_at: now,
      updated_at: now
    });

    // 5) Saudi: Hotel, Bus, Invoice Saudi
    usersToInsert.push(
      { id: uuid(), email: 'hotel.saudi@bintangglobal.com', password_hash: hash, name: 'Hotel Saudi Arabia', role: ROLES.ROLE_HOTEL, branch_id: null, wilayah_id: null, is_active: true, created_at: now, updated_at: now },
      { id: uuid(), email: 'bus.saudi@bintangglobal.com', password_hash: hash, name: 'Bus Saudi Arabia', role: ROLES.ROLE_BUS, branch_id: null, wilayah_id: null, is_active: true, created_at: now, updated_at: now },
      { id: uuid(), email: 'invoice.saudi@bintangglobal.com', password_hash: hash, name: 'Invoice Saudi Arabia', role: ROLES.ROLE_INVOICE_SAUDI, branch_id: null, wilayah_id: null, is_active: true, created_at: now, updated_at: now }
    );

    // 6) Koordinator: 3 wilayah (Bali-Nusa Tenggara, Jawa, Kalimantan), masing-masing 4 akun
    const [allWilayah] = await q.query(`SELECT id, name FROM wilayah ORDER BY name`);
    const wilayahByName = {};
    for (const row of allWilayah || []) wilayahByName[row.name] = row;
    const wilayahList = WILAYAH_KERJA_NAMA.map(n => wilayahByName[n]).filter(Boolean);
    if (wilayahList.length === 0) {
      (allWilayah || []).slice(0, 3).forEach(r => wilayahList.push(r));
    }

    for (const w of wilayahList) {
      const wid = w.id;
      const wName = w.name || '';
      const pre = slug(wName).slice(0, 20) || 'wilayah';
      usersToInsert.push(
        { id: uuid(), email: `admin-koord.${pre}@bintangglobal.com`, password_hash: hash, name: `Admin Koordinator ${wName}`, role: ROLES.ADMIN_KOORDINATOR, branch_id: null, wilayah_id: wid, is_active: true, created_at: now, updated_at: now },
        { id: uuid(), email: `invoice-koord.${pre}@bintangglobal.com`, password_hash: hash, name: `Invoice Koordinator ${wName}`, role: ROLES.INVOICE_KOORDINATOR, branch_id: null, wilayah_id: wid, is_active: true, created_at: now, updated_at: now },
        { id: uuid(), email: `tiket-koord.${pre}@bintangglobal.com`, password_hash: hash, name: `Tiket Koordinator ${wName}`, role: ROLES.TIKET_KOORDINATOR, branch_id: null, wilayah_id: wid, is_active: true, created_at: now, updated_at: now },
        { id: uuid(), email: `visa-koord.${pre}@bintangglobal.com`, password_hash: hash, name: `Visa Koordinator ${wName}`, role: ROLES.VISA_KOORDINATOR, branch_id: null, wilayah_id: wid, is_active: true, created_at: now, updated_at: now }
      );
    }

    // 7) Satu cabang per wilayah (untuk assign owner)
    const ownerBranches = [];
    for (const w of wilayahList) {
      const [rows] = await q.query(`
        SELECT b.id FROM branches b
        INNER JOIN provinsi p ON b.provinsi_id = p.id
        WHERE p.wilayah_id = '${w.id}'
        LIMIT 1
      `);
      if (rows && rows[0]) ownerBranches.push(rows[0].id);
    }
    if (ownerBranches.length === 0) {
      const [anyBranches] = await q.query(`SELECT id FROM branches ORDER BY created_at LIMIT 3`);
      (anyBranches || []).forEach(r => ownerBranches.push(r.id));
    }

    // 8) Owner: 9 akun (3 per wilayah). Daerah menentukan koordinator wilayah yang mengurus.
    // Index 0 = Bali-Nusa Tenggara, 1 = Jawa, 2 = Kalimantan.
    const ownerSpecsByWilayah = [
      [
        { email: 'owner.denpasar@bintangglobal.com', name: 'Owner Travel Denpasar', company_name: 'Travel Bali Nusantara', wilayahIndex: 0 },
        { email: 'owner.lombok@bintangglobal.com', name: 'Owner Travel Lombok', company_name: 'CV Lombok Travel', wilayahIndex: 0 },
        { email: 'owner.kupang@bintangglobal.com', name: 'Owner Travel Kupang', company_name: 'PT Travel Kupang', wilayahIndex: 0 }
      ],
      [
        { email: 'owner.pati@bintangglobal.com', name: 'Owner Travel Pati', company_name: 'Travel Pati Jaya', wilayahIndex: 1 },
        { email: 'owner.bandung@bintangglobal.com', name: 'Owner Travel Bandung', company_name: 'CV Travel Bandung', wilayahIndex: 1 },
        { email: 'owner.surabaya@bintangglobal.com', name: 'Owner Travel Surabaya', company_name: 'PT Travel Surabaya', wilayahIndex: 1 }
      ],
      [
        { email: 'owner.samarinda@bintangglobal.com', name: 'Owner Travel Samarinda', company_name: 'PT Travel Samarinda Utama', wilayahIndex: 2 },
        { email: 'owner.pontianak@bintangglobal.com', name: 'Owner Travel Pontianak', company_name: 'CV Travel Pontianak', wilayahIndex: 2 },
        { email: 'owner.balikpapan@bintangglobal.com', name: 'Owner Travel Balikpapan', company_name: 'Travel Balikpapan', wilayahIndex: 2 }
      ]
    ];
    const flatOwners = ownerSpecsByWilayah.flat();

    for (const o of flatOwners) {
      usersToInsert.push({
        id: uuid(),
        email: o.email,
        password_hash: hash,
        name: o.name,
        role: ROLES.OWNER,
        branch_id: null,
        wilayah_id: null,
        company_name: o.company_name,
        is_active: true,
        created_at: now,
        updated_at: now
      });
    }

    await queryInterface.bulkInsert('users', usersToInsert).catch(e => console.warn('[seed workflow-koordinator-users] users', e.message));

    // 9) Owner profiles: assign ke cabang sesuai wilayah (orderan diurus koordinator wilayah masing-masing)
    const ownerEmails = flatOwners.map(o => o.email);
    const [ownerRows] = await q.query(
      `SELECT id, email FROM users WHERE email IN (${ownerEmails.map(e => `'${e.replace(/'/g, "''")}'`).join(',')})`
    );
    const emailToId = {};
    for (const row of ownerRows || []) emailToId[row.email] = row.id;

    for (const o of flatOwners) {
      const userId = emailToId[o.email];
      const branchId = ownerBranches[o.wilayahIndex];
      if (!userId || !branchId) continue;
      await queryInterface.bulkInsert('owner_profiles', [{
        id: uuid(),
        user_id: userId,
        status: OWNER_STATUS.ACTIVE,
        assigned_branch_id: branchId,
        activated_at: now,
        created_at: now,
        updated_at: now
      }]).catch(e => console.warn('[seed workflow-koordinator-users] owner_profiles', e.message));
    }
  },

  async down(queryInterface, Sequelize) {
    const q = queryInterface.sequelize;
    await q.query(`DELETE FROM owner_profiles`).catch(() => {});
    await q.query(`DELETE FROM users`).catch(() => {});
  }
};
