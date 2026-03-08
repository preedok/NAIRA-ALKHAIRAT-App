/**
 * Helper untuk daftar produk: harga mengikuti tipe owner (MOU dapat diskon dari Settings).
 * Gunakan owner_id saat fetch products agar backend mengembalikan price_general_idr/sar/usd
 * yang sudah didiskon untuk owner_mou (persen diskon dari Settings → Diskon MOU).
 */

interface UserLike {
  id?: string;
  role?: string;
}

/** Return user.id jika user adalah owner (MOU atau Non-MOU), agar API produk mengembalikan harga yang sesuai. */
export function getProductListOwnerId(user: UserLike | null | undefined): string | undefined {
  if (!user?.id) return undefined;
  if (user.role === 'owner_mou' || user.role === 'owner_non_mou') return user.id;
  return undefined;
}

/** Apakah role saat ini adalah owner (untuk pengecekan tampilan harga / badge). */
export function isOwnerRole(role: string | undefined): boolean {
  return role === 'owner_mou' || role === 'owner_non_mou';
}
