# WORKFLOW PROSES BISNIS – SISTEM BINTANG GLOBAL GROUP

**Dokumen Presentasi untuk Klien**  
*Semua alur proses bisnis aplikasi dalam satu dokumen*

---

## Daftar Isi

1. [Ringkasan Sistem](#1-ringkasan-sistem)
2. [Struktur Hierarki & Role](#2-struktur-hierarki--role)
3. [Workflow A: Registrasi & Aktivasi Owner](#3-workflow-a-registrasi--aktivasi-owner)
4. [Workflow B: Pengaturan Produk & Harga](#4-workflow-b-pengaturan-produk--harga)
5. [Workflow C: Order & Invoice](#5-workflow-c-order--invoice)
6. [Workflow D: Pembayaran](#6-workflow-d-pembayaran)
7. [Workflow E: Operasional Hotel](#7-workflow-e-operasional-hotel)
8. [Workflow F: Operasional Visa](#8-workflow-f-operasional-visa)
9. [Workflow G: Operasional Tiket](#9-workflow-g-operasional-tiket)
10. [Workflow H: Operasional Bus](#10-workflow-h-operasional-bus)
11. [Workflow I: Refund & Pembatalan](#11-workflow-i-refund--pembatalan)
12. [Workflow J: Accounting & Keuangan](#12-workflow-j-accounting--keuangan)
13. [Workflow K: Payroll (Penggajian)](#13-workflow-k-payroll-penggajian)
14. [Workflow L: Notifikasi](#14-workflow-l-notifikasi)
15. [Workflow M: Monitoring & Laporan](#15-workflow-m-monitoring--laporan)
16. [Peta Menu & Akses per Role](#16-peta-menu--akses-per-role)

---

## 1. Ringkasan Sistem

Sistem Bintang Global adalah **ERP terintegrasi** untuk bisnis travel umroh B2B dengan karakter:

- **Terpusat**: Kontrol penuh dari pusat; cabang dan wilayah mengikuti aturan pusat.
- **Multi-role**: Super Admin, Admin Pusat, Koordinator (Wilayah/Invoice/Tiket/Visa), Role Operasional (Hotel, Bus, Invoice Saudi), Accounting, dan Owner (mitra/customer).
- **Layanan**: Hotel, Visa, Tiket, Bus, Handling, dan Paket.
- **Multi-mata-uang**: IDR dan SAR (Saudi).
- **Satu pintu Order & Invoice**: Satu halaman untuk semua role; data difilter sesuai hak akses.

---

## 2. Struktur Hierarki & Role

| Level | Role | Scope | Deskripsi |
|-------|------|--------|-----------|
| 1 | **Super Admin** | Sistem | Monitoring, logs, maintenance, pengendali kebijakan. Tidak akses order/invoice operasional. |
| 2 | **Admin Pusat** | Seluruh perusahaan | Semua cabang, wilayah, order, invoice, laporan, aktivasi owner, pengaturan harga. |
| 3 | **Admin Koordinator** | Wilayah | Semua cabang di wilayahnya (wilayah_id). |
| 4 | **Invoice Koordinator** | Wilayah | Order & invoice wilayah; boleh tambah/edit/hapus order untuk bantu owner. |
| 4 | **Tiket Koordinator** | Wilayah | Pekerjaan tiket sesuai wilayah. |
| 4 | **Visa Koordinator** | Wilayah | Pekerjaan visa sesuai wilayah. |
| 5 | **Role Hotel** | Tugas lapangan (Saudi) | Cek ketersediaan kamar, booking, nomor kamar, progres hotel. |
| 5 | **Role Bus** | Saudi | Armada, seat, status keberangkatan, penalti bus. |
| 5 | **Role Invoice Saudi** | Saudi | Input pembayaran SAR/USD (Saudi), update invoice. |
| 5 | **Accounting** | Sesuai filter | Laporan keuangan, aging, payroll, rekonsiliasi; filter branch/wilayah. |
| 6 | **Owner** | Order sendiri | Mitra/customer; hanya order miliknya; tambah/edit/hapus order sendiri. |

**Struktur data:** Wilayah → Provinsi → Cabang (Branch). User terhubung ke Branch dan/atau Wilayah sesuai role.

---

## 3. Workflow A: Registrasi & Aktivasi Owner

**Tujuan:** Calon mitra (Owner) mendaftar, bayar biaya pendaftaran, diverifikasi, lalu diaktivasi ke satu cabang sehingga bisa membuat order.

| Langkah | Pihak | Aksi | Status Akun |
|---------|--------|------|-------------|
| 1 | Calon Owner | Daftar: data perusahaan, penanggung jawab, alamat, email, WhatsApp, NPWP/legalitas. Pilih cabang + upload bukti bayar biaya MoU. | `pending_registration_payment` |
| 2 | Calon Owner | Upload bukti transfer biaya pendaftaran (sesuai ketentuan pusat). | `pending_registration_verification` |
| 3 | Admin Pusat | Verifikasi bukti transfer (mutasi bank, nominal, nama pengirim). | `deposit_verified` |
| 4 | Admin Pusat | Assign cabang (berdasarkan alamat). | `assigned_to_branch` |
| 5 | Admin Pusat / proses | Final approval & aktivasi (generate password, MOU). | `active` |

**Penolakan:** Jika bukti ditolak → status bisa kembali/reject; Owner diberi catatan revisi.

**Sebelum ACTIVE:** Owner tidak bisa buat order, tidak bisa lihat harga detail, tidak bisa akses modul transaksi.

---

## 4. Workflow B: Pengaturan Produk & Harga

**Tujuan:** Master produk dan harga dikelola terpusat; cabang/wilayah mengikuti aturan pusat.

| Pihak | Aksi |
|-------|------|
| **Super Admin / Admin Pusat** | Atur produk: Hotel, Visa, Tiket, Bus, Handling, Paket. Harga general, harga super promo, mata uang (IDR/SAR), aturan DP, tenggat waktu, penalti. |
| **Business Rules (pusat/cabang)** | Konfigurasi: DP minimal (30% normal, 50% super promo), tenggat DP (3 hari), grace 24 jam untuk tentative, minimal pack bus (35), penalti bus, kurs, rekening bank, notifikasi. |
| **Audit** | Setiap perubahan harga/deposit dicatat: siapa, tanggal, nilai lama, nilai baru, cabang. |

**Produk:** Satu order dapat berisi item Hotel, Visa, Tiket, Bus, Handling, dan Paket.

---

## 5. Workflow C: Order & Invoice

**Tujuan:** Owner atau Invoice Koordinator membuat order; sistem generate tagihan (invoice) dengan aturan DP, tenggat, dan status.

| Langkah | Pihak | Aksi |
|---------|--------|------|
| 1 | Owner / Invoice Koordinator | Buat order baru: pilih cabang (jika multi), tambah item (hotel, visa, tiket, bus, handling, paket). |
| 2 | Sistem | Validasi: Visa wajib dengan hotel; jika visa/tiket → wajib upload manifest jamaah; bus minimal 35 pack (jika kurang → penalti); DP minimal 30% (50% super promo). |
| 3 | Sistem | Generate invoice: status awal **Draft** atau **Tentative**. Invoice **Tentative** batal otomatis jika 1×24 jam belum ada DP. Tenggat DP maksimal 3 hari; lewat → status **Overdue**. |
| 4 | Owner / Koordinator | Edit/hapus item atau batalkan order **sebelum** diproses. Jika status sudah **Processing**, edit perlu approval. |

**Status Invoice:**  
Draft → Tentative → Partial Paid (DP masuk) → Paid (lunas) → Processing → Completed | Overdue | Canceled | Refunded | Order Updated | Overpaid (dan turunannya).

**Status Order:**  
Draft | Tentative | Confirmed | Processing | Completed | Cancelled | Blocked.

---

## 6. Workflow D: Pembayaran

**Tujuan:** Owner membayar DP/lunas; bukti transfer diupload dan diverifikasi; status invoice dan sisa tagihan terupdate otomatis.

| Langkah | Pihak | Aksi |
|---------|--------|------|
| 1 | Owner | Upload bukti transfer + input nominal & mata uang (IDR/SAR/USD). |
| 2 | Sistem | Hitung sisa tagihan, update status invoice (Partial Paid / Paid), lampirkan bukti di invoice, kirim notifikasi (WA & Email). |
| 3 | Role Invoice / Admin | Verifikasi pembayaran (terima/tolak). Bisa aktifkan ulang invoice overdue, update kurs. |
| 4 | Role Invoice Saudi | Input pembayaran SAR/USD (Saudi); sistem update invoice otomatis. |
| 5 | Jika lunas | Status → **Paid**; sistem bisa generate invoice final/PDF. |

**Fitur tambahan:** Rekonsiliasi bukti bayar (Accounting), pemindahan dana antar invoice (reallocate), alokasi kelebihan bayar (overpaid).

---

## 7. Workflow E: Operasional Hotel

**Tujuan:** Role Hotel mengelola ketersediaan kamar, booking, dan progres sampai selesai (nomor kamar, check-in/out).

| Langkah | Aksi |
|---------|------|
| 1 | Cek ketersediaan kamar (kalender/ketersediaan per produk). |
| 2 | Booking kamar; update status kamar: Available → Booked → Occupied → Available. |
| 3 | Update progres order item hotel: **Waiting Confirmation** → **Confirmed** → **Room Assigned** → **Completed**. |
| 4 | Input nomor kamar jamaah; update harga musiman jika diizinkan (aturan cabang). |

**Tipe kamar:** Single, Double, Triple, Quad, Quint (kapasitas jamaah per kamar).

---

## 8. Workflow F: Operasional Visa

**Tujuan:** Role Visa Koordinator menerima manifest, proses visa, update progres sampai visa issued dan file dikirim ke Owner.

| Langkah | Aksi |
|---------|------|
| 1 | Terima manifest jamaah (upload/tautan). |
| 2 | Proses visa; update progres: **Document Received** → **Submitted** → **In Process** → **Approved** → **Issued**. |
| 3 | Upload file visa (ZIP/RAR); sistem kirim ke Owner (notifikasi + akses unduh). |

---

## 9. Workflow G: Operasional Tiket

**Tujuan:** Tiket Koordinator input manifest ke maskapai, cek seat, booking, sampai tiket issued dan file dikirim ke Owner.

| Langkah | Aksi |
|---------|------|
| 1 | Input manifest; cek ketersediaan seat. |
| 2 | Booking; update progres: **Pending** → **Data Received** → **Seat Reserved** → **Booking** → **Payment Airline** → **Ticket Issued**. |
| 3 | Upload tiket (ZIP/RAR); sistem kirim ke Owner. |

---

## 10. Workflow H: Operasional Bus

**Tujuan:** Role Bus mengelola armada, ketersediaan seat, status tiket bus dan perjalanan (keberangkatan/kedatangan/kepulangan).

| Langkah | Aksi |
|---------|------|
| 1 | Kelola armada & ketersediaan seat. |
| 2 | Validasi minimal 35 pack; jika kurang → sistem hitung penalti (konfigurasi business rule). |
| 3 | Update status tiket bus: **Pending** → **Issued**. |
| 4 | Update status perjalanan: **Pending** → **Scheduled** → **Completed**. |

---

## 11. Workflow I: Refund & Pembatalan

**Tujuan:** Jika order/invoice dibatalkan atau owner tarik saldo, refund mengikuti aturan (belum/sudah diproses).

| Kondisi | Aturan |
|---------|--------|
| **Belum diproses** (hotel belum confirmed, visa/tiket belum issued) | Refund bisa dilakukan. |
| **Sudah diproses** | Deposit non-refundable. |
| **Sumber refund** | Cancel (saat batalkan order) atau Balance (tarik saldo). |

**Status Refund:** Requested → Approved | Rejected → Refunded. Semua refund tercatat di audit log.

---

## 12. Workflow J: Accounting & Keuangan

**Tujuan:** Role Accounting (pusat) mengelola laporan keuangan, piutang aging, rekonsiliasi pembayaran, dan integrasi ke modul accounting (COA, periode fiskal, mapping akun).

| Fitur | Deskripsi |
|-------|-----------|
| **Dashboard & KPI** | Rekapitulasi piutang, terbayar, per status, per cabang/wilayah/provinsi. Filter: branch, provinsi, wilayah, tanggal. |
| **Chart of Accounts (COA)** | Akun multi-level; tipe: Asset, Liability, Equity, Revenue, Expense. Mata uang IDR/SAR. |
| **Tahun & Periode Fiskal** | Lock/unlock periode; closing tahun. |
| **Account Mapping** | Mapping otomatis per jenis: penjualan (hotel, visa, tiket, bus, handling), payroll, kas/bank, dll. |
| **Laporan Keuangan** | Laporan keuangan per periode/tahun; filter branch/wilayah/owner/status/produk. Export Excel/PDF. |
| **Aging Piutang** | Laporan aging piutang; filter; export Excel/PDF. |
| **Daftar Invoice** | List invoice lengkap; filter; **Export Excel** (semua data invoice untuk accounting). |
| **Pembayaran & Rekonsiliasi** | Daftar pembayaran; verifikasi; rekonsiliasi bukti bayar. |

**Workflow dokumen accounting (blueprint):** Draft → Submitted → Verified → Approved → Posted to GL → Closed.

---

## 13. Workflow K: Payroll (Penggajian)

**Tujuan:** Accounting mengelola penggajian karyawan (bukan owner): master gaji, run payroll, generate slip, finalize.

| Langkah | Aksi |
|---------|------|
| 1 | **Master:** Gaji per karyawan (eligible employees), komponen gaji. |
| 2 | **Run:** Buat payroll run (draft); isi item dari template atau manual. |
| 3 | **Finalize:** Generate slip gaji (PDF), simpan file, notifikasi ke karyawan. |
| 4 | Karyawan | Akses "Slip Gaji Saya" (semua role kecuali owner). |

**Status Run:** Draft → Processed → Finalized.

---

## 14. Workflow L: Notifikasi

**Tujuan:** Pemberitahuan otomatis ke user terkait invoice, pembayaran, progres, dan event penting.

| Trigger | Channel |
|---------|---------|
| Invoice dibuat, DP diterima, Overdue, Lunas | In-app, Email, WhatsApp |
| Hotel confirmed, Visa issued, Tiket issued | In-app, Email, WhatsApp |
| Order completed, Cancel, Refund | In-app, Email, WhatsApp |
| Slip gaji issued (payroll) | In-app / Email |

---

## 15. Workflow M: Monitoring & Laporan

| Pihak | Scope | Fitur |
|-------|--------|-------|
| **Owner** | Transaksi sendiri | Transaksi pribadi, progres, histori pembayaran. |
| **Role Operasional** | Pekerjaan sendiri | Rekap pekerjaan pribadi (hotel/visa/tiket/bus). |
| **Koordinator** | Wilayah | Dashboard wilayah, rekap order/invoice wilayah. |
| **Admin Pusat** | Seluruh | Semua cabang; filter per cabang/layanan; export global. |
| **Super Admin** | Sistem | Monitoring, audit log, maintenance, logs. |
| **Accounting** | Keuangan | Laporan keuangan, aging, export Excel (invoice lengkap, financial, aging). |

**Laporan:** Reports (analytics, export Excel/PDF), Accounting (financial report, aging, export), Super Admin (monitoring export, logs).

---

## 16. Peta Menu & Akses per Role

| Menu / Halaman | Super Admin | Admin Pusat | Koordinator | Hotel/Bus/Inv Saudi | Accounting | Owner |
|----------------|-------------|-------------|-------------|---------------------|------------|-------|
| Dashboard | ✓ (monitoring) | ✓ (full) | ✓ (wilayah) | ✓ (pekerjaan) | ✓ (KPI/dashboard) | ✓ (sendiri) |
| Order & Invoice | - | ✓ | ✓ | ✓ | ✓ (list/export) | ✓ (sendiri) |
| Tambah/Edit Order | - | ✓* | Invoice Koord ✓ | - | - | ✓ |
| Produk (Hotel/Visa/Tiket/Bus/Paket) | ✓ | ✓ | ✓ | ✓ (relevan) | ✓ | ✓ (lihat) |
| Pekerjaan Visa/Tiket | - | ✓ | Visa/Tiket Koord ✓ | - | - | - |
| Hotels (kamar, kalender) | - | ✓ | ✓ | ✓ | ✓ | ✓ |
| Refunds | - | ✓ | ✓ | ✓ | ✓ | ✓ (sendiri) |
| Users / Branches | - | ✓ | ✓ (scope) | - | - | - |
| Reports | - | ✓ | ✓ | ✓ | - | - |
| Accounting (COA, Aging, Financial, Export Invoice) | - | ✓ | - | - | ✓ | - |
| Payroll | - | - | - | - | ✓ | - (slip saya saja) |
| Super Admin (logs, maintenance) | ✓ | - | - | - | - | - |
| Profile / Settings | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

\* Admin Pusat dapat akses penuh; Invoice Koordinator tambah/edit order untuk bantu owner.

---

*Dokumen ini menggabungkan Master Business Process, Arsitektur & Scope, dan Accounting System Architecture untuk keperluan presentasi ke klien. Semua workflow dalam satu referensi.*

**Bintang Global Group – Sistem Terintegrasi Travel Umroh B2B**
