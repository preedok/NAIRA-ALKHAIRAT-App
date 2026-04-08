/**
 * Hapus semua master data product hotel + relasi turunannya.
 *
 * Usage:
 *   CONFIRM=YES node scripts/clear-hotel-products.js
 */
const sequelize = require('../src/config/sequelize');
const {
  Product,
  ProductAvailability,
  ProductPrice,
  HotelMonthlyPrice,
  HotelSeason,
  HotelRoomInventory,
  OrderItem
} = require('../src/models');

async function main() {
  if (process.env.CONFIRM !== 'YES') {
    console.error('Set CONFIRM=YES untuk menjalankan penghapusan.');
    process.exit(1);
  }

  await sequelize.authenticate();
  console.log('PostgreSQL connected. Menghapus semua product hotel...');

  const t = await sequelize.transaction();
  try {
    const hotelProducts = await Product.findAll({
      where: { type: 'hotel' },
      attributes: ['id'],
      transaction: t
    });
    const hotelIds = hotelProducts.map((p) => p.id);
    if (!hotelIds.length) {
      console.log('Tidak ada product hotel. Selesai.');
      await t.commit();
      return;
    }

    // Putus relasi order item lama bila ada (hindari FK block).
    const [updatedOrderItems] = await OrderItem.update(
      { product_ref_id: null },
      { where: { type: 'hotel', product_ref_id: hotelIds }, transaction: t }
    );
    console.log(`OrderItem unlinked: ${updatedOrderItems}`);

    const deletedRoomInventory = await HotelRoomInventory.destroy({ where: { product_id: hotelIds }, transaction: t });
    const deletedSeasons = await HotelSeason.destroy({ where: { product_id: hotelIds }, transaction: t });
    const deletedMonthly = await HotelMonthlyPrice.destroy({ where: { product_id: hotelIds }, transaction: t });
    const deletedPrices = await ProductPrice.destroy({ where: { product_id: hotelIds }, transaction: t });
    const deletedAvailability = await ProductAvailability.destroy({ where: { product_id: hotelIds }, transaction: t });
    const deletedProducts = await Product.destroy({ where: { id: hotelIds }, transaction: t });

    await t.commit();
    console.log(`Hotel product IDs: ${hotelIds.length}`);
    console.log(`Deleted hotel_room_inventory: ${deletedRoomInventory}`);
    console.log(`Deleted hotel_seasons: ${deletedSeasons}`);
    console.log(`Deleted hotel_monthly_prices: ${deletedMonthly}`);
    console.log(`Deleted product_prices: ${deletedPrices}`);
    console.log(`Deleted product_availability: ${deletedAvailability}`);
    console.log(`Deleted products (type=hotel): ${deletedProducts}`);
    console.log('CLEAR_HOTEL_PRODUCTS_DONE');
  } catch (err) {
    await t.rollback();
    throw err;
  } finally {
    await sequelize.close();
  }
}

main().catch((err) => {
  console.error('Gagal clear hotel products:', err.message || String(err));
  process.exit(1);
});

