# Progress Workflow: Invoice Saudi & Handling

Dokumen ini merangkum status implementasi workflow **Invoice Saudi** (role_invoice_saudi, pembayaran KES) dan **Handling** (produk handling, order, dan dashboard handling).

---

## 1. Invoice Saudi (KES / Pembayaran Saudi)

### 1.1 Backend

| Fitur | Status | Lokasi |
|-------|--------|--------|
| Pembayaran oleh role_invoice_saudi dengan `payment_location: saudi` | ✅ | `paymentProofController.js` – create |
| Pilihan mata uang bayar: **SAR, USD, IDR** | ✅ | Body: `payment_currency`; konversi ke IDR untuk SAR/USD pakai kurs cabang |
| Upload bukti bayar **wajib** (tidak ada lagi “issued-saudi” tanpa file) | ✅ | Validasi `if (!fileUrl) return 400` |
| Auto-verifikasi: pembayaran Saudi langsung `verified` | ✅ | Set `verified_by`, `verified_at`, `verified_status: 'verified'` |
| Update invoice: `paid_amount`, `remaining_amount`, `status` (partial_paid / paid) | ✅ | Setelah create proof |
| Update order: `dp_payment_status`, `payment_progress_*` | ✅ | Setelah create proof |
| Response berisi invoice terbaru + remaining | ✅ | Untuk tampilan “Pembayaran ke-X”, sisa tagihan |
| Perhitungan paid/verified konsisten pakai `payment_location === 'saudi'` atau `verified_status === 'verified'` | ✅ | `invoiceController.js` (recalc, GET by id), `paymentProofController.js` (verifiedSum) |

### 1.2 Frontend

| Fitur | Status | Lokasi |
|-------|--------|--------|
| Role Invoice Saudi: akses halaman Invoice & daftar invoice | ✅ | `DashboardLayout`, `OrdersInvoicesPage`, `InvoiceDashboard` |
| Form bayar: pilihan mata uang **SAR / USD / IDR** | ✅ | `OrdersInvoicesPage` – `payCurrencySaudi` |
| Input jumlah + preview konversi IDR (untuk SAR/USD) | ✅ | Preview “≈ … IDR” |
| Validasi: upload bukti wajib | ✅ | `if (!payFile) showToast('Upload bukti bayar wajib.')` |
| Setelah submit: toast “Pembayaran ke-X … Sisa tagihan: …” + refresh data invoice | ✅ | `handleSubmitPayment`, `viewInvoice` dari response |
| Daftar bukti bayar: label “Pembayaran ke-1”, “Pembayaran ke-2”, … | ✅ | Tab detail invoice – payments |
| Badge KES: “Pembayaran KES — otomatis terverifikasi” | ✅ | Tampilan list payment proof |

### 1.3 Ringkasan Invoice Saudi

- **Alur:** Role Invoice Saudi pilih invoice → pilih mata uang (SAR/USD/IDR) → isi jumlah & tanggal → upload bukti → submit → sistem hitung paid/remaining, update status invoice & order, bukti otomatis verified.
- **Tersedia:** Buat pembayaran, tampil sisa tagihan, pembayaran ke-X, auto-verifikasi KES.

---

## 2. Handling

### 2.1 Produk Handling (Master)

| Fitur | Status | Lokasi |
|-------|--------|--------|
| CRUD produk handling (admin) | ✅ | `HandlingPage.tsx`, API products `type: handling` |
| Harga default per produk (IDR/SAR/USD) | ✅ | Form tambah/edit, `price_general_*`, kurs |
| Tabel “Daftar Handling” di halaman Produk → Handling | ✅ | `HandlingPage` – card + table |
| **Aksi order:** tombol “Tambah ke order” per baris (owner, invoice_koordinator, role_invoice_saudi) | ✅ | Kolom “Aksi order”, `addDraftItem({ type: 'handling', ... })` |
| Draft order: tipe `handling` di context + ProductDraftBar | ✅ | `OrderDraftContext.tsx`, `ProductDraftBar.tsx` |

### 2.2 Order & Invoice (Item Handling)

| Fitur | Status | Lokasi |
|-------|--------|--------|
| Tipe item “Handling” di form order (Buat invoice baru) | ✅ | `OrderFormPage` – ITEM_TYPES, pilihan produk handling |
| Simpan order item `type: handling` ke backend | ✅ | Order create/update – order_items |
| Filter invoice by `has_handling` (list API) | ✅ | `invoicesApi.list({ has_handling: true })`, backend `invoiceController` |
| Tampilan item handling di detail invoice (label, jumlah) | ✅ | `OrdersInvoicesPage` – Status Handling, list item |
| Overpaid handling (refund/transfer) – backend | ✅ | `PATCH /invoices/:id/overpaid` – body `handling`, `target_*` |

### 2.3 Dashboard & Progress Handling (Role Handling)

| Fitur | Status | Lokasi |
|-------|--------|--------|
| Role **role_handling**: dashboard khusus handling | ✅ | `DashboardRouter` → `HandlingDashboard` |
| API dashboard: total order/item, by_status (pending, in_progress, completed), pending_list | ✅ | `GET /handling/dashboard` – `handlingController.getDashboard` |
| Update status item: pending → in_progress → completed | ✅ | `PATCH /handling/order-items/:id/progress` – `handlingController.updateOrderItemProgress` |
| UI: stat cards + list “Perlu Tindakan” + tombol update status | ✅ | `HandlingDashboard.tsx` |
| Route backend `/handling/*` hanya untuk role_handling (+ super_admin) | ✅ | `handling.js` – `requireRole(ROLE_HANDLING, SUPER_ADMIN)` |

### 2.4 Yang Dihapus (sesuai permintaan sebelumnya)

| Item | Keterangan |
|------|------------|
| Menu **“Daftar Handling”** (sidebar) | Dihapus – link ke halaman list invoice dengan item handling |
| Halaman **HandlingWorkPage** (list invoice + tombol “Lihat”) | File dihapus, route & menu sudah tidak dipakai |
| Card “Daftar Handling” di Owner / Koordinator dashboard | Dihapus |

### 2.5 Ringkasan Handling

- **Produk:** Master handling di Produk → Handling, dengan aksi “Tambah ke order” untuk owner/invoice koordinator/invoice Saudi.
- **Order/Invoice:** Item handling bisa ditambah di form order, tersimpan sebagai `type: handling`, tampil di invoice; filter `has_handling` untuk list invoice.
- **Role handling:** Dashboard terpisah untuk role_handling: lihat item handling per status dan update status (pending → in_progress → completed) lewat API + UI.

---

## 3. Referensi File Penting

- **Invoice Saudi (backend):** `backend/src/controllers/paymentProofController.js`, `backend/src/controllers/invoiceController.js`
- **Invoice Saudi (frontend):** `frontend/src/pages/dashboard/components/OrdersInvoicesPage.tsx` (form bayar, list proof, badge KES)
- **Handling produk & aksi order:** `frontend/src/pages/dashboard/components/HandlingPage.tsx`
- **Handling di order:** `frontend/src/pages/dashboard/components/OrderFormPage.tsx`, `frontend/src/contexts/OrderDraftContext.tsx`
- **Handling dashboard (role_handling):** `frontend/src/pages/dashboard/roles/HandlingDashboard.tsx`, `backend/src/controllers/handlingController.js`, `backend/src/routes/v1/handling.js`

---

*Dokumen progress terakhir: Maret 2025*
