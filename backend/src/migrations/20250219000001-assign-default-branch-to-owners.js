'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Ambil cabang pertama yang aktif sebagai default
    const [branches] = await queryInterface.sequelize.query(
      `SELECT id FROM branches WHERE is_active = true ORDER BY created_at ASC LIMIT 1`
    );
    
    if (branches && branches.length > 0) {
      const defaultBranchId = branches[0].id;
      
      // Update owner_profiles yang belum punya assigned_branch_id
      // Hanya untuk owner yang statusnya sudah aktif/assigned (bukan pending)
      // Nilai enum di DB: lowercase (assigned_to_branch, active, deposit_verified)
      await queryInterface.sequelize.query(`
        UPDATE owner_profiles 
        SET assigned_branch_id = :defaultBranchId
        WHERE assigned_branch_id IS NULL 
        AND status IN ('assigned_to_branch', 'active', 'deposit_verified')
      `, {
        replacements: { defaultBranchId }
      });
      
      console.log(`Assigned default branch ${defaultBranchId} to owners without assigned_branch_id`);
    } else {
      console.warn('No active branch found - skipping default branch assignment');
    }
  },

  async down(queryInterface, Sequelize) {
    // Tidak ada rollback - ini adalah data fix, bukan schema change
  }
};
