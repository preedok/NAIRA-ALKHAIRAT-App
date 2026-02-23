'use strict';

/**
 * Menambah kolom yang mungkin hilang jika DB dibuat dari bintang_global_db.sql
 * sehingga backend + seed tetap jalan.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const q = queryInterface.sequelize;
    const [tb] = await q.query(`
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'branches';
    `);
    if (!tb || tb.length === 0) return; // tabel belum ada (akan dibuat oleh sync)

    // branches: tambah city jika belum ada (SQL schema tidak punya city)
    const [bc] = await q.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'branches' AND column_name = 'city';
    `);
    if (!bc || bc.length === 0) {
      await queryInterface.addColumn('branches', 'city', {
        type: Sequelize.STRING(100),
        allowNull: true
      });
    }

    // owner_profiles: tambah status, assigned_branch_id, activated_at jika belum ada
    const [oc] = await q.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'owner_profiles'
      AND column_name IN ('status', 'assigned_branch_id', 'activated_at');
    `);
    const existing = (oc || []).map(r => r.column_name);

    if (!existing.includes('status')) {
      await queryInterface.addColumn('owner_profiles', 'status', {
        type: Sequelize.STRING(100),
        allowNull: true
      });
    }
    if (!existing.includes('assigned_branch_id')) {
      await queryInterface.addColumn('owner_profiles', 'assigned_branch_id', {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'branches', key: 'id' }
      });
    }
    if (!existing.includes('activated_at')) {
      await queryInterface.addColumn('owner_profiles', 'activated_at', {
        type: Sequelize.DATE,
        allowNull: true
      });
    }
  },

  async down(queryInterface) {
    const q = queryInterface.sequelize;
    const [bc] = await q.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'branches' AND column_name = 'city';
    `);
    if (bc && bc.length) await queryInterface.removeColumn('branches', 'city').catch(() => {});

    const cols = ['status', 'assigned_branch_id', 'activated_at'];
    for (const col of cols) {
      await queryInterface.removeColumn('owner_profiles', col).catch(() => {});
    }
  }
};
