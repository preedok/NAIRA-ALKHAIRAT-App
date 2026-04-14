/**
 * Permission logic sesuai Master Business Process & RBAC
 * - Role Invoice: tidak bisa download dokumen visa/tiket/hotel
 * - Owner: hanya data miliknya
 * - Role operasional: hanya kotanya (enforced di backend)
 */

import type { UserRole } from '../types';
import { normalizeUserRole } from '../types';

/** Role Invoice tidak boleh download dokumen penerbitan visa, tiket, hotel */
export function canDownloadVisaTicketHotel(role: UserRole): boolean {
  const r = normalizeUserRole(role);
  return r === 'admin_pusat' || r === 'admin_cabang';
}

/** Bisa buat order: Owner, Invoice, Admin per kota, Admin Pusat, Super Admin */
export function canCreateOrder(role: UserRole): boolean {
  const r = normalizeUserRole(role);
  return r === 'jamaah' || r === 'admin_pusat' || r === 'admin_cabang';
}

/** Bisa verifikasi pembayaran & aktifkan invoice overdue: Role Invoice + Admin */
export function canManageInvoicePayment(role: UserRole): boolean {
  const r = normalizeUserRole(role);
  return r === 'admin_pusat' || r === 'admin_cabang';
}

/** Owner hanya bisa akses penuh transaksi jika status ACTIVE */
export function ownerCanTransact(ownerStatus: string | undefined): boolean {
  return ownerStatus === 'active' || ownerStatus === undefined;
}

/** Bisa kelola harga general / produk: Super Admin, Admin Pusat */
export function canManageGeneralPricing(role: UserRole): boolean {
  return normalizeUserRole(role) === 'admin_pusat';
}

/** Bisa set harga khusus owner / kurs per kota: Admin pusat/koordinator, (Hotel/Bus jika diizinkan) */
export function canManageSpecialPricing(role: UserRole): boolean {
  const r = normalizeUserRole(role);
  return r === 'admin_pusat' || r === 'admin_cabang';
}
