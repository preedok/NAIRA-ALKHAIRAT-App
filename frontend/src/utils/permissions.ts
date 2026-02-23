/**
 * Permission logic sesuai Master Business Process & RBAC
 * - Role Invoice: tidak bisa download dokumen visa/tiket/hotel
 * - Owner: hanya data miliknya
 * - Role operasional: hanya cabangnya (enforced di backend)
 */

import type { UserRole } from '../types';

/** Role Invoice tidak boleh download dokumen penerbitan visa, tiket, hotel */
export function canDownloadVisaTicketHotel(role: UserRole): boolean {
  return role !== 'invoice_koordinator' && role !== 'role_invoice_saudi';
}

/** Bisa buat order: Owner, Invoice, Admin Cabang, Admin Pusat, Super Admin */
export function canCreateOrder(role: UserRole): boolean {
  return ['owner', 'invoice_koordinator', 'role_invoice_saudi', 'admin_pusat', 'super_admin'].includes(role);
}

/** Bisa verifikasi pembayaran & aktifkan invoice overdue: Role Invoice + Admin */
export function canManageInvoicePayment(role: UserRole): boolean {
  return ['invoice_koordinator', 'role_invoice_saudi', 'admin_pusat', 'super_admin', 'role_accounting'].includes(role);
}

/** Owner hanya bisa akses penuh transaksi jika status ACTIVE */
export function ownerCanTransact(ownerStatus: string | undefined): boolean {
  return ownerStatus === 'active';
}

/** Bisa kelola harga general / produk: Super Admin, Admin Pusat */
export function canManageGeneralPricing(role: UserRole): boolean {
  return ['super_admin', 'admin_pusat'].includes(role);
}

/** Bisa set harga khusus owner / kurs cabang: Admin Cabang, (Hotel/Bus jika diizinkan) */
export function canManageSpecialPricing(role: UserRole): boolean {
  return ['admin_pusat', 'super_admin', 'role_hotel', 'role_bus'].includes(role);
}
