'use strict';

/**
 * Update cabang demo (JKT, SBY, BDG) dengan data Koordinator Provinsi dan Koordinator Wilayah.
 * Juga update nama menjadi format "Bintang Global Group Cabang [Wilayah]".
 * Jalankan setelah migration add-branch-coordinators.
 */
const BRANCH_JKT = 'a0000000-0000-0000-0000-000000000001';
const BRANCH_SBY = 'a0000000-0000-0000-0000-000000000002';
const BRANCH_BDG = 'a0000000-0000-0000-0000-000000000003';

const UPDATES = [
  { id: BRANCH_JKT, name: 'Bintang Global Group Cabang Jakarta', koordinator_provinsi: 'Budi Santoso', koordinator_provinsi_phone: '+62 812 3456 7890', koordinator_provinsi_email: 'budi.santoso@bintangglobal.com', koordinator_wilayah: 'Dewi Kartika', koordinator_wilayah_phone: '+62 813 9876 5432', koordinator_wilayah_email: 'dewi.kartika@bintangglobal.com', manager_name: 'Ahmad Rizki' },
  { id: BRANCH_SBY, name: 'Bintang Global Group Cabang Surabaya', koordinator_provinsi: 'Hendra Wijaya', koordinator_provinsi_phone: '+62 821 1111 2222', koordinator_provinsi_email: 'hendra.wijaya@bintangglobal.com', koordinator_wilayah: 'Rina Melati', koordinator_wilayah_phone: '+62 822 3333 4444', koordinator_wilayah_email: 'rina.melati@bintangglobal.com', manager_name: 'Siti Rahayu' },
  { id: BRANCH_BDG, name: 'Bintang Global Group Cabang Bandung', koordinator_provinsi: 'Ani Lestari', koordinator_provinsi_phone: '+62 823 5555 6666', koordinator_provinsi_email: 'ani.lestari@bintangglobal.com', koordinator_wilayah: 'Bambang Prasetyo', koordinator_wilayah_phone: '+62 824 7777 8888', koordinator_wilayah_email: 'bambang.prasetyo@bintangglobal.com', manager_name: 'Fajar Nugroho' }
];

module.exports = {
  async up(queryInterface, Sequelize) {
    const q = queryInterface.sequelize;
    for (const u of UPDATES) {
      await q.query(
        `UPDATE branches SET
          name = '${String(u.name).replace(/'/g, "''")}',
          manager_name = '${String(u.manager_name || '').replace(/'/g, "''")}',
          koordinator_provinsi = '${String(u.koordinator_provinsi || '').replace(/'/g, "''")}',
          koordinator_provinsi_phone = '${String(u.koordinator_provinsi_phone || '').replace(/'/g, "''")}',
          koordinator_provinsi_email = '${String(u.koordinator_provinsi_email || '').replace(/'/g, "''")}',
          koordinator_wilayah = '${String(u.koordinator_wilayah || '').replace(/'/g, "''")}',
          koordinator_wilayah_phone = '${String(u.koordinator_wilayah_phone || '').replace(/'/g, "''")}',
          koordinator_wilayah_email = '${String(u.koordinator_wilayah_email || '').replace(/'/g, "''")}',
          updated_at = NOW()
        WHERE id = '${u.id}'`
      ).catch(() => {});
    }
    console.log('[seed branch-coordinators] Data koordinator provinsi & wilayah telah diupdate.');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `UPDATE branches SET
        koordinator_provinsi = NULL,
        koordinator_provinsi_phone = NULL,
        koordinator_provinsi_email = NULL,
        koordinator_wilayah = NULL,
        koordinator_wilayah_phone = NULL,
        koordinator_wilayah_email = NULL,
        updated_at = NOW()
      WHERE id IN ('${BRANCH_JKT}', '${BRANCH_SBY}', '${BRANCH_BDG}')`
    ).catch(() => {});
  }
};
