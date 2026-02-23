'use strict';

const bcrypt = require('bcryptjs');
const { ROLES, OWNER_STATUS } = require('../constants');

const DEFAULT_PASSWORD = 'Password123';
const BRANCH_JKT = 'a0000000-0000-0000-0000-000000000001';
const BRANCH_SBY = 'a0000000-0000-0000-0000-000000000002';
const BRANCH_BDG = 'a0000000-0000-0000-0000-000000000003';

const logErr = (label, err) => { console.warn(`[seed demo-data] ${label}:`, err.message); };

module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();
    const hash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

    // 3 cabang: Jakarta, Surabaya, Bandung (Bintang Global Group - nama cabang, wilayah, manager, kontak, koordinator)
    await queryInterface.bulkInsert('branches', [
      { id: BRANCH_JKT, code: 'JKT', name: 'Bintang Global Group Cabang Jakarta', city: 'Jakarta', region: 'DKI Jakarta', manager_name: 'Ahmad Rizki', phone: '+62 21 8094 5678', email: 'pusat@bintangglobal.com', address: 'Jl. Sudirman No. 1', koordinator_provinsi: 'Budi Santoso', koordinator_provinsi_phone: '+62 812 3456 7890', koordinator_provinsi_email: 'budi.santoso@bintangglobal.com', koordinator_wilayah: 'Dewi Kartika', koordinator_wilayah_phone: '+62 813 9876 5432', koordinator_wilayah_email: 'dewi.kartika@bintangglobal.com', is_active: true, created_at: now, updated_at: now },
      { id: BRANCH_SBY, code: 'SBY', name: 'Bintang Global Group Cabang Surabaya', city: 'Surabaya', region: 'Jawa Timur', manager_name: 'Siti Rahayu', phone: '+62 31 5687 4321', email: 'surabaya@bintangglobal.com', address: 'Jl. HR Muhammad No. 10', koordinator_provinsi: 'Hendra Wijaya', koordinator_provinsi_phone: '+62 821 1111 2222', koordinator_provinsi_email: 'hendra.wijaya@bintangglobal.com', koordinator_wilayah: 'Rina Melati', koordinator_wilayah_phone: '+62 822 3333 4444', koordinator_wilayah_email: 'rina.melati@bintangglobal.com', is_active: true, created_at: now, updated_at: now },
      { id: BRANCH_BDG, code: 'BDG', name: 'Bintang Global Group Cabang Bandung', city: 'Bandung', region: 'Jawa Barat', manager_name: 'Fajar Nugroho', phone: '+62 22 1234 5678', email: 'bandung@bintangglobal.com', address: 'Jl. Dago No. 5', koordinator_provinsi: 'Ani Lestari', koordinator_provinsi_phone: '+62 823 5555 6666', koordinator_provinsi_email: 'ani.lestari@bintangglobal.com', koordinator_wilayah: 'Bambang Prasetyo', koordinator_wilayah_phone: '+62 824 7777 8888', koordinator_wilayah_email: 'bambang.prasetyo@bintangglobal.com', is_active: true, created_at: now, updated_at: now }
    ]).catch(e => logErr('branches', e));

    // Semua role + 3 owner (minimal 3 contoh untuk testing)
    const users = [
      { id: 'b0000000-0000-0000-0000-000000000001', email: 'superadmin@bintangglobal.com', name: 'Super Admin', role: ROLES.SUPER_ADMIN, branch_id: BRANCH_JKT },
      { id: 'b0000000-0000-0000-0000-000000000002', email: 'adminpusat@bintangglobal.com', name: 'Admin Pusat', role: ROLES.ADMIN_PUSAT, branch_id: null },
      { id: 'b0000000-0000-0000-0000-000000000003', email: 'admincabang.jkt@bintangglobal.com', name: 'Admin Cabang Jakarta', role: ROLES.ADMIN_CABANG, branch_id: BRANCH_JKT },
      { id: 'b0000000-0000-0000-0000-000000000004', email: 'admincabang.sby@bintangglobal.com', name: 'Admin Cabang Surabaya', role: ROLES.ADMIN_CABANG, branch_id: BRANCH_SBY },
      { id: 'b0000000-0000-0000-0000-000000000014', email: 'admincabang.bdg@bintangglobal.com', name: 'Admin Cabang Bandung', role: ROLES.ADMIN_CABANG, branch_id: BRANCH_BDG },
      { id: 'b0000000-0000-0000-0000-000000000005', email: 'invoice@bintangglobal.com', name: 'Staff Invoice', role: ROLES.ROLE_INVOICE, branch_id: BRANCH_JKT },
      { id: 'b0000000-0000-0000-0000-000000000006', email: 'hotel@bintangglobal.com', name: 'Staff Hotel', role: ROLES.ROLE_HOTEL, branch_id: BRANCH_JKT },
      { id: 'b0000000-0000-0000-0000-000000000007', email: 'visa@bintangglobal.com', name: 'Koordinator Visa', role: ROLES.VISA_KOORDINATOR, branch_id: null, wilayah_id: null },
      { id: 'b0000000-0000-0000-0000-000000000008', email: 'ticket@bintangglobal.com', name: 'Koordinator Tiket', role: ROLES.TIKET_KOORDINATOR, branch_id: null, wilayah_id: null },
      { id: 'b0000000-0000-0000-0000-000000000009', email: 'bus@bintangglobal.com', name: 'Staff Bus', role: ROLES.ROLE_BUS, branch_id: BRANCH_JKT },
      { id: 'b0000000-0000-0000-0000-000000000010', email: 'accounting@bintangglobal.com', name: 'Staff Accounting', role: ROLES.ROLE_ACCOUNTING, branch_id: null },
      { id: 'b0000000-0000-0000-0000-000000000011', email: 'owner1@bintangglobal.com', name: 'Owner Travel Satu', role: ROLES.OWNER, branch_id: null, company_name: 'Travel Satu Jaya' },
      { id: 'b0000000-0000-0000-0000-000000000012', email: 'owner2@bintangglobal.com', name: 'Owner Travel Dua', role: ROLES.OWNER, branch_id: null, company_name: 'CV Travel Dua' },
      { id: 'b0000000-0000-0000-0000-000000000013', email: 'owner3@bintangglobal.com', name: 'Owner Travel Tiga', role: ROLES.OWNER, branch_id: null, company_name: 'PT Travel Tiga Utama' }
    ];

    const userRows = users.map(u => ({
      id: u.id,
      email: u.email,
      password_hash: hash,
      name: u.name,
      role: u.role,
      branch_id: u.branch_id || null,
      company_name: u.company_name || null,
      is_active: true,
      created_at: now,
      updated_at: now
    }));

    await queryInterface.bulkInsert('users', userRows).catch(e => logErr('users', e));

    // 3 owner profiles (aktif, masing-masing punya cabang)
    const ownerProfiles = [
      { user_id: 'b0000000-0000-0000-0000-000000000011', status: OWNER_STATUS.ACTIVE, assigned_branch_id: BRANCH_JKT, activated_at: now },
      { user_id: 'b0000000-0000-0000-0000-000000000012', status: OWNER_STATUS.ACTIVE, assigned_branch_id: BRANCH_JKT, activated_at: now },
      { user_id: 'b0000000-0000-0000-0000-000000000013', status: OWNER_STATUS.ACTIVE, assigned_branch_id: BRANCH_SBY, activated_at: now }
    ];

    for (const op of ownerProfiles) {
      await queryInterface.bulkInsert('owner_profiles', [{
        id: require('uuid').v4 ? require('uuid').v4() : op.user_id.replace('b000', 'c000'),
        user_id: op.user_id,
        status: op.status,
        assigned_branch_id: op.assigned_branch_id,
        activated_at: op.activated_at,
        created_at: now,
        updated_at: now
      }]).catch(e => logErr('owner_profiles', e));
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('owner_profiles', null, {});
    await queryInterface.bulkDelete('users', null, {});
    await queryInterface.bulkDelete('branches', null, {});
  }
};

// Export IDs for other seeders
module.exports.BRANCH_JKT = BRANCH_JKT;
module.exports.BRANCH_SBY = BRANCH_SBY;
module.exports.BRANCH_BDG = BRANCH_BDG;
