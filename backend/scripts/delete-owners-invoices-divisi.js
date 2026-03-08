/**
 * Hapus data: semua invoice, order, owner, dan user divisi.
 * Sisakan hanya: super_admin, admin_pusat, role_hotel, role_bus, role_accounting, invoice_saudi.
 *
 * Jalankan dari folder backend: node scripts/delete-owners-invoices-divisi.js
 * PENTING: Script ini menghapus data secara permanen. Backup DB dulu jika perlu.
 */
require('dotenv').config();
const path = require('path');

const { Op } = require('sequelize');
const sequelize = require(path.join(__dirname, '../src/config/sequelize'));
const {
  User,
  OwnerProfile,
  Order,
  OrderItem,
  Invoice,
  InvoiceFile,
  PaymentProof,
  Refund,
  OwnerBalanceTransaction,
  PaymentReallocation,
  InvoiceStatusHistory,
  OrderRevision,
  HotelProgress,
  TicketProgress,
  VisaProgress,
  BusProgress,
  Notification,
  ProductPrice,
  AuditLog
} = require(path.join(__dirname, '../src/models'));

const ROLES_TO_KEEP = [
  'super_admin',
  'admin_pusat',
  'role_hotel',
  'role_bus',
  'role_accounting',
  'invoice_saudi'
];

async function main() {
  const t = await sequelize.transaction();
  try {
    const usersToDelete = await User.findAll({
      where: { role: { [Op.notIn]: ROLES_TO_KEEP } },
      attributes: ['id', 'role'],
      raw: true
    });
    const userIdsToDelete = usersToDelete.map((u) => u.id);
    const ownerUserIds = usersToDelete
      .filter((u) => ['owner_mou', 'owner_non_mou', 'owner'].includes(u.role))
      .map((u) => u.id);

    console.log('Menghapus data invoice & order terkait...');

    await PaymentReallocation.destroy({ where: {}, transaction: t });
    await Refund.destroy({ where: {}, transaction: t });
    await PaymentProof.destroy({ where: {}, transaction: t });
    await InvoiceFile.destroy({ where: {}, transaction: t });
    await InvoiceStatusHistory.destroy({ where: {}, transaction: t });
    await OrderRevision.destroy({ where: {}, transaction: t });

    await HotelProgress.destroy({ where: {}, transaction: t });
    await TicketProgress.destroy({ where: {}, transaction: t });
    await VisaProgress.destroy({ where: {}, transaction: t });
    await BusProgress.destroy({ where: {}, transaction: t });

    await OrderItem.destroy({ where: {}, transaction: t });
    await Invoice.destroy({ where: {}, transaction: t });
    await Order.destroy({ where: {}, transaction: t });

    if (ownerUserIds.length > 0) {
      await OwnerBalanceTransaction.destroy({
        where: { owner_id: { [Op.in]: ownerUserIds } },
        transaction: t
      });
      await ProductPrice.update(
        { owner_id: null },
        { where: { owner_id: { [Op.in]: ownerUserIds } }, transaction: t }
      );
    }

    await OwnerProfile.destroy({ where: {}, transaction: t });

    if (userIdsToDelete.length > 0) {
      await Notification.destroy({
        where: { user_id: { [Op.in]: userIdsToDelete } },
        transaction: t
      });
      await AuditLog.destroy({
        where: { user_id: { [Op.in]: userIdsToDelete } },
        transaction: t
      });
      await User.destroy({
        where: { id: { [Op.in]: userIdsToDelete } },
        transaction: t
      });
    }

    await t.commit();
    console.log('Selesai.');
    console.log(`- Invoice, order, refund, payment proof, dll. telah dihapus.`);
    console.log(`- Owner profiles dan balance transactions dihapus.`);
    console.log(`- ${userIdsToDelete.length} user (owner + divisi selain yang dipertahankan) dihapus.`);
    console.log(`- User yang tersisa: ${ROLES_TO_KEEP.join(', ')}`);
  } catch (err) {
    await t.rollback();
    throw err;
  } finally {
    await sequelize.close();
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
