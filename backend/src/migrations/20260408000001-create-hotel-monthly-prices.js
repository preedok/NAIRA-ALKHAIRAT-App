'use strict';

/**
 * Hotel monthly prices:
 * - Harga per bulan per room_type (+ with_meal) dengan layer pusat/cabang/owner
 * - Backfill 12 bulan ke depan dari harga hotel existing di product_prices (general/branch/owner)
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('hotel_monthly_prices', {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.literal('gen_random_uuid()')
      },
      product_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'products', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      branch_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'branches', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      owner_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      year_month: {
        type: Sequelize.STRING(7),
        allowNull: false
      },
      currency: {
        type: Sequelize.STRING(3),
        allowNull: false,
        defaultValue: 'IDR'
      },
      room_type: {
        type: Sequelize.STRING(20),
        allowNull: false
      },
      with_meal: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      amount: {
        type: Sequelize.DECIMAL(18, 2),
        allowNull: false
      },
      created_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      approved_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('NOW')
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('NOW')
      }
    });

    await queryInterface.addIndex('hotel_monthly_prices', ['product_id', 'year_month'], {
      name: 'idx_hmp_product_month'
    });
    await queryInterface.addIndex('hotel_monthly_prices', ['branch_id', 'owner_id'], {
      name: 'idx_hmp_branch_owner'
    });
    await queryInterface.addIndex('hotel_monthly_prices', ['year_month'], {
      name: 'idx_hmp_year_month'
    });

    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX uq_hmp_layer_month_variant
      ON hotel_monthly_prices (
        product_id,
        COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'::uuid),
        COALESCE(owner_id, '00000000-0000-0000-0000-000000000000'::uuid),
        year_month,
        currency,
        room_type,
        with_meal
      )
    `);

    // Backfill 12 bulan ke depan dari harga existing hotel pada product_prices
    await queryInterface.sequelize.query(`
      WITH months AS (
        SELECT to_char((date_trunc('month', now()) + (gs.n || ' month')::interval), 'YYYY-MM') AS year_month
        FROM generate_series(0, 11) AS gs(n)
      ),
      candidates AS (
        SELECT
          pp.product_id,
          pp.branch_id,
          pp.owner_id,
          m.year_month,
          COALESCE(pp.currency, 'IDR') AS currency,
          COALESCE(NULLIF(pp.meta->>'room_type',''), 'single') AS room_type,
          COALESCE((pp.meta->>'with_meal')::boolean, false) AS with_meal,
          pp.amount,
          pp.created_by
        FROM product_prices pp
        JOIN products p ON p.id = pp.product_id
        CROSS JOIN months m
        WHERE p.type = 'hotel'
          AND COALESCE(p.is_active, true) = true
          AND pp.amount IS NOT NULL
      )
      INSERT INTO hotel_monthly_prices (
        id, product_id, branch_id, owner_id, year_month, currency, room_type, with_meal, amount, created_by, approved_by, created_at, updated_at
      )
      SELECT
        gen_random_uuid(), c.product_id, c.branch_id, c.owner_id, c.year_month, c.currency, c.room_type, c.with_meal, c.amount, c.created_by, NULL, NOW(), NOW()
      FROM candidates c
      ON CONFLICT DO NOTHING
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS uq_hmp_layer_month_variant');
    await queryInterface.dropTable('hotel_monthly_prices');
  }
};

