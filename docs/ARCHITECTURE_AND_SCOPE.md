# Arsitektur & Scope Per Role

Dokumen ini menjelaskan workflow per role dan integrasi backend–frontend–database setelah restrukturisasi.

## 1. Role & Scope Data


| Role                    | Scope          | Deskripsi                                                                    |
| ----------------------- | -------------- | ---------------------------------------------------------------------------- |
| **Super Admin**         | Sistem         | Monitoring, logs, maintenance. Tidak akses order/invoice operasional.        |
| **Admin Pusat**         | Seluruh        | Handle semua cabang, wilayah, order, invoice, laporan.                       |
| **Admin Koordinator**   | Wilayah        | Handle semua cabang di wilayahnya (wilayah_id).                              |
| **Invoice Koordinator** | Wilayah        | Order & invoice wilayah; boleh tambah/edit/hapus order untuk membantu owner. |
| **Tiket Koordinator**   | Wilayah        | Pekerjaan tiket sesuai wilayah.                                              |
| **Visa Koordinator**    | Wilayah        | Pekerjaan visa sesuai wilayah.                                               |
| **Hotel**               | Tugas lapangan | Check-in/check-out, ketersediaan kamar, makan, handling di hotel (Saudi).    |
| **Bus**                 | Saudi          | Handle bus ketika jamaah wilayah sudah tiba di Saudi.                        |
| **Owner**               | Order sendiri  | Customer; hanya order miliknya; boleh tambah/edit/hapus order sendiri.       |
| **Accounting**          | Sesuai filter  | Laporan keuangan, aging, payroll; filter branch/wilayah.                     |

*(Role `role_visa` dan `role_ticket` telah dihapus; pekerjaan visa/tiket ditangani oleh visa_koordinator dan tiket_koordinator.)*


## 2. Sumber Data Terpadu (Backend)

### Orders

- **Satu API:** `GET/POST/PATCH/DELETE /api/v1/orders` dan `POST /api/v1/orders/:id/send-result`.
- Scope diterapkan di controller: owner → `owner_id`, koordinator → `branch_id IN wilayah`, admin_pusat → semua.
- Tambah/Edit/Hapus order: hanya **owner** dan **invoice_koordinator** (requireRole + cek di controller).
- Kirim hasil order (send-result): **admin_koordinator**, **invoice_koordinator**, **tiket_koordinator**, **visa_koordinator** (scope: order harus dalam wilayah mereka).

### Dashboard scope (wilayah/cabang)

- **Layanan bersama:** `backend/src/services/dashboardScopeService.js`.
  - `getDashboardData(branchIds)`: rekapitulasi order, owners, invoice, hotel, visa, tiket, bus untuk satu atau banyak cabang.
- **Koordinator:** `GET /api/v1/koordinator/dashboard` → branchIds dari `wilayah_id` user.

### Invoice

- **Satu API:** `/api/v1/invoices` (list, summary, getById, verify-payment, dll.). Scope di controller sesuai role.

## 3. Frontend – Satu Pintu Masuk

- **Order & Invoice:** Satu menu **Order & Invoice** (`/dashboard/orders-invoices`) untuk semua role. Data difilter sesuai hak akses.
- **Tambah/Edit/Hapus order:** Tombol dan aksi hanya untuk **owner** dan **invoice_koordinator**. Role lain diarahkan ke Order & Invoice bila akses form.
- **Form order:** `/dashboard/orders/new` dan `/dashboard/orders/:id/edit` → hanya owner & invoice_koordinator (redirect jika bukan).

## 4. Relasi Database (Ringkas)

- **Wilayah** → Provinsi → **Branch** (cabang).
- **User** (role, branch_id, wilayah_id) → Branch, Wilayah.
- **OwnerProfile** → User, assigned_branch_id → Branch.
- **Order** → User (owner_id), Branch (branch_id); **OrderItem** → Order; progress: HotelProgress, VisaProgress, TicketProgress, BusProgress → OrderItem.
- **Invoice** → Order, User, Branch; **PaymentProof** → Invoice.
- Satu sumber order: tabel **orders**; invoice terhubung ke order; tidak duplikasi tabel order per role.

## 5. Fitur Non-Core yang Dihapus

- **Flyer / template design** — tidak dipakai di workflow inti; tabel `flyer_templates` dan API flyer dihapus.
- **UI template switching** — layout template (Super Admin) tidak inti bisnis; tabel `ui_templates` dan endpoint templates/deploy dihapus.
- **Combined recap & export recap** (Admin Pusat) — halaman dan endpoint dihapus; dashboard Admin Pusat tetap pakai `getDashboard`.
- **Order statistics** (Super Admin) — endpoint dihapus; monitoring tetap pakai `getMonitoring` dan export Excel/PDF.
- **Reconciliation list** (Accounting) — endpoint GET list rekonsiliasi dihapus; aksi `POST /payments/:id/reconcile` tetap untuk tandai bukti bayar.

## 6. Best Practice yang Diterapkan

- Satu API orders + scope per role (tidak ada `/koordinator/orders` atau `/admin-cabang/orders` terpisah untuk list).
- Satu endpoint send-result: `POST /orders/:id/send-result` dengan requireRole dan cek scope.
- Dashboard koordinator memakai **satu layanan** `dashboardScopeService.getDashboardData(branchIds)`.
- Menu dan halaman FE: satu halaman Order & Invoice; form order diproteksi oleh role.
- Relasi DB: Order → Branch → Wilayah/Provinsi; tidak ada tabel redundan untuk “order per role”.

