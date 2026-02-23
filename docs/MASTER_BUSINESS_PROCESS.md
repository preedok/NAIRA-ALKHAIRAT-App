# MASTER BUSINESS PROCESS – SISTEM TERINTEGRASI BINTANG GLOBAL GRUP

Dokumen ini adalah acuan pengembangan sistem ERP Bintang Global (frontend, backend, workflow engine, permission logic).

Sistem Bintang Global adalah sistem terpusat berbasis hierarki cabang dengan kontrol penuh di pusat. Sistem mengelola: onboarding Owner, pengaturan harga, transaksi, pembayaran, eksekusi layanan (hotel, visa, tiket, bus, handling), monitoring progres, notifikasi otomatis, refund, pelaporan lintas cabang.

Struktur: **Role Based Access Control (RBAC)** dengan pembatasan akses berbasis cabang dan fungsi operasional.

---

## I. STRUKTUR HIERARKI DAN OTORITAS

| Level | Role | Sifat |
|-------|------|--------|
| 1 | Super Admin | Monitoring & pengendali kebijakan |
| 2 | Admin Pusat | Monitoring & pengendali kebijakan |
| 3 | Admin Cabang | Pengendali operasional cabang |
| 4 | Role Operasional (Invoice, Hotel, Visa, Tiket, Bus, Handling) | Eksekutor pekerjaan |
| 5 | Owner | Mitra transaksi |

---

## II. PROSES A – REGISTRASI DAN AKTIVASI OWNER

1. Calon Owner registrasi akun. Sistem mencatat:
   - Data perusahaan, nama penanggung jawab, alamat lengkap, wilayah operasional
   - Email aktif, nomor WhatsApp aktif
   - NPWP / legalitas usaha (jika ada)

2. **Status akun:** `REGISTERED_PENDING_MOU`

3. Sistem mewajibkan download MoU. Owner: tanda tangan MoU → upload MoU yang sudah ditandatangani.

4. **Status:** `PENDING_MOU_APPROVAL`

5. Admin Pusat verifikasi MoU (kelengkapan, tanda tangan, legalitas).
   - Ditolak → kembali ke Owner + catatan revisi.
   - Disetujui → **Status:** `PENDING_DEPOSIT_PAYMENT`

6. Owner transfer deposit awal sesuai ketentuan pusat → upload bukti transfer.

7. **Status:** `PENDING_DEPOSIT_VERIFICATION`

8. Admin Pusat: cross check mutasi bank, verifikasi nominal & nama pengirim.
   - Valid → **Status:** `DEPOSIT_VERIFIED`

9. Admin Pusat menentukan cabang (berdasarkan alamat). Sistem assign `branch_id`. **Status:** `ASSIGNED_TO_BRANCH`

10. Admin Cabang final approval. Disetujui → **Status:** `ACTIVE`

**Selama status belum ACTIVE:** Owner tidak bisa buat order, tidak bisa lihat harga detail, tidak bisa akses modul transaksi.

---

## III. PENGATURAN PRODUK DAN HARGA

- **Super Admin & Admin Pusat** mengatur: produk hotel, visa, tiket, bus, handling, paket (mis. paket Ramadhan).
- Setiap produk: harga general, harga super promo (jika ada), mata uang (IDR/SAR), aturan DP, tenggat waktu, aturan penalti.
- **Admin Cabang** dapat: mengajukan harga khusus untuk Owner tertentu, mengatur kurs cabang, mengatur penalti bus & harga hotel musiman jika diizinkan.
- **Audit log** wajib: siapa ubah, tanggal, harga lama, harga baru, cabang.

---

## IV. PROSES PEMBUATAN ORDER

- Order dibuat oleh: **Owner**, **Role Invoice**, **Admin Cabang** (jika membantu).
- Satu invoice dapat berisi: Hotel, Visa, Tiket, Bus, Handling, Paket lengkap.

**Validasi otomatis:**
- Visa tidak bisa tanpa hotel.
- Jika pesan visa/tiket → wajib upload manifest jamaah.
- Bus minimal 35 pack; jika kurang → sistem hitung penalti otomatis.
- DP minimal: 30% normal, 50% super promo.
- Invoice tentative **batal otomatis** jika 1x24 jam belum ada DP.
- Tenggat DP maksimal 3 hari; lewat → status **OVERDUE**.

**Status Invoice:**  
`Draft` | `Tentative` | `Partial Paid` | `Paid` | `Processing` | `Completed` | `Overdue` | `Canceled` | `Refunded`

- Owner bisa: edit/hapus item order dan cancel **sebelum** diproses.
- Jika sudah **Processing**: tidak bisa edit tanpa approval.

---

## V. PROSES PEMBAYARAN

- Owner upload bukti transfer + input nominal.
- Sistem: hitung sisa tagihan, update status, lampirkan bukti di file invoice, kirim notifikasi WA & Email.
- Jika lunas: status → **PAID**, sistem generate invoice final.
- Role Invoice: verifikasi pembayaran, aktifkan ulang invoice overdue, update kurs, monitoring sisa tagihan.

---

## VI. PROSES OPERASIONAL PER ROLE

| Role | Tugas | Restriksi |
|------|--------|-----------|
| **Invoice** | Buat invoice, bantu Owner input order, aktifkan invoice overdue, verifikasi DP, monitoring pembayaran, rekap transaksi pribadi | **Tidak bisa** download dokumen visa/tiket/hotel |
| **Hotel** | Cek ketersediaan kamar, booking, update status kamar (Available → Booked → Occupied → Available), input nomor kamar jamaah, update progres (Waiting Confirmation → Confirmed → Room Assigned → Completed), update harga musiman jika diizinkan | - |
| **Visa** | Terima manifest, proses visa, update progres (Document Received → Submitted → In Process → Approved → Issued), upload file visa zip/rar, sistem kirim ke Owner | - |
| **Tiket** | Input manifest ke maskapai, cek seat, booking, update status (Seat Reserved → Ticket Issued), upload tiket zip/rar, sistem kirim ke Owner | - |
| **Bus** | Kelola armada & seat availability, update status keberangkatan, validasi min 35 pack, konfigurasi penalti jika diizinkan | - |
| **Handling** | (Digabung dengan Hotel atau terpisah sesuai implementasi) | - |

---

## VII. REFUND DAN PEMBATALAN

- Jika Owner cancel: sistem cek apakah hotel confirmed / visa issued / tiket issued.
- **Belum diproses** → refund bisa dilakukan.
- **Sudah diproses** → deposit non-refundable.
- **Status refund:** `Requested` | `Approved` | `Rejected` | `Refunded`
- Semua refund tercatat di audit log.

---

## VIII. NOTIFIKASI OTOMATIS

**Trigger:** Invoice dibuat, DP diterima, Overdue, Lunas, Hotel confirmed, Visa issued, Tiket issued, Cancel, Refund.  
**Channel:** In-app, Email, WhatsApp.

---

## IX. MONITORING DAN REPORTING

- **Owner:** transaksi pribadi, progres, histori pembayaran.
- **Role Operasional:** rekap pekerjaan pribadi.
- **Admin Cabang:** seluruh transaksi cabang, export Excel/PDF cabang, filter harian/mingguan/bulanan.
- **Admin Pusat:** seluruh cabang, filter per cabang/layanan, export global.
- **Super Admin:** akses semua data, audit log, monitoring perubahan harga.

---

## X. KONTROL SISTEM DAN KEAMANAN

- Semua perubahan harga, status, aktivasi ulang invoice, refund → **wajib audit log**.
- Role berbasis **branch restriction**.
- Owner hanya lihat data miliknya; role operasional hanya cabangnya.
