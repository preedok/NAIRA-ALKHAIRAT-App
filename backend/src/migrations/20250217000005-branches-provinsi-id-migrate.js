'use strict';

/**
 * Migrate branches.region -> branches.provinsi_id
 * Match region string to provinsi.name (case-insensitive)
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const [provinsiRows] = await queryInterface.sequelize.query(
      `SELECT id, UPPER(TRIM(name)) as name_key, name FROM provinsi`
    );
    const provinsiByKey = {};
    for (const p of provinsiRows || []) {
      provinsiByKey[p.name_key] = p.id;
      provinsiByKey[p.name_key.replace(/\s+/g, ' ')] = p.id;
    }

    const aliases = {
      'NANGROE ACEH DARUSSALAM': 'ACEH',
      'KEP. BANGKA BELITUNG': 'KEPULAUAN BANGKA BELITUNG',
      'BANGKA BELITUNG': 'KEPULAUAN BANGKA BELITUNG',
      'KEP. RIAU': 'KEPULAUAN RIAU',
      'DI YOGYAKARTA': 'DAERAH ISTIMEWA YOGYAKARTA',
      'YOGYAKARTA': 'DAERAH ISTIMEWA YOGYAKARTA',
      'NTB': 'NUSA TENGGARA BARAT',
      'NTT': 'NUSA TENGGARA TIMUR'
    };

    const [branches] = await queryInterface.sequelize.query(
      `SELECT id, region FROM branches WHERE region IS NOT NULL AND TRIM(region) != ''`
    );

    for (const b of branches || []) {
      let key = (b.region || '').trim().toUpperCase().replace(/\s+/g, ' ');
      const aliasKey = aliases[key];
      if (aliasKey) key = aliasKey;
      const provinsiId = provinsiByKey[key];
      if (provinsiId) {
        await queryInterface.sequelize.query(
          `UPDATE branches SET provinsi_id = :pid, updated_at = NOW() WHERE id = :bid`,
          { replacements: { pid: provinsiId, bid: b.id } }
        );
      }
    }
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `UPDATE branches SET provinsi_id = NULL, updated_at = NOW()`
    );
  }
};
