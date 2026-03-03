# Email Notifikasi Transaksi

## Langkah memastikan notifikasi terkirim ke email

1. **Isi SMTP di `backend/.env`**
   - **SMTP_USER** = alamat email pengirim (contoh: `yourcompany@gmail.com`).
   - **SMTP_PASSWORD** = password email. Untuk **Gmail** wajib pakai **Sandi Aplikasi** (bukan password login biasa):
     - Buka [Akun Google](https://myaccount.google.com) → Keamanan → Verifikasi 2 langkah (harus aktif) → Sandi Aplikasi → buat sandi untuk "Mail".
   - Opsional: **EMAIL_FROM** (kalau ingin alamat "dari" beda dari SMTP_USER), **EMAIL_FROM_NAME** (nama yang tampil).

2. **Restart backend** setelah mengubah `.env` (hentikan server lalu jalankan lagi, mis. `npm run dev`).

3. **Uji kirim**: lakukan aksi yang memicu notifikasi email, misalnya:
   - Buat order lalu terbitkan invoice → owner harus dapat email "Invoice baru" + lampiran PDF.
   - Upload bukti bayar lalu verifikasi → owner harus dapat email "DP diterima" / "Invoice lunas" + lampiran.
   - Atau upload bukti refund (role accounting) → owner dapat email bukti refund.

4. **Cek log backend**: jika SMTP gagal, di log akan ada pesan seperti `Gagal kirim email notifikasi ke ...` atau `Email tidak dikonfigurasi`. Jika sukses: `Email notifikasi terkirim ke ...`.

5. **Cek spam/junk** di inbox penerima jika email tidak muncul di kotak masuk utama.

---

## Email pengirim yang dipakai

Alamat dan nama pengirim email diambil dari konfigurasi (`.env`):

| Variabel | Keterangan | Fallback |
|----------|------------|----------|
| **EMAIL_FROM** | Alamat email pengirim (mis. `noreply@bintangglobal.com`) | `SMTP_USER` |
| **EMAIL_FROM_NAME** | Nama yang tampil di inbox (mis. `Bintang Global - Admin Pusat`) | `Bintang Global - Admin Pusat` |

Contoh tampilan di inbox: **"Bintang Global - Admin Pusat" &lt;noreply@bintangglobal.com&gt;**

Jika `EMAIL_FROM` tidak diisi, sistem memakai `SMTP_USER` sebagai alamat pengirim.

---

## Catatan konfigurasi & perilaku

- **SMTP harus dikonfigurasi di `.env`** (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`, dan opsional `EMAIL_FROM`, `EMAIL_FROM_NAME`, `SMTP_PORT`, `SMTP_SECURE`) agar email benar-benar terkirim. Tanpa SMTP, notifikasi hanya masuk ke sistem (in-app), email tidak dikirim.

- **Pengiriman email dijalankan di background** (`setImmediate` / promise) agar response API tetap cepat. Request selesai dulu, lalu email dikirim asinkron.

- **`email_sent_at` di notifikasi** di-update setelah email berhasil terkirim. Pengecualian: untuk **refund**, email dikirim sebelum notifikasi dibuat, sehingga jika email terkirim maka notifikasi langsung dibuat dengan `email_sent_at` terisi.
