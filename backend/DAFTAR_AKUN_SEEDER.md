# Daftar Akun (Seeder Workflow Koordinator per Wilayah)

**Password semua akun:** `Password123`

Sistem mengatur otomatis: **setiap owner sesuai daerah masuk ke koordinator wilayah masing-masing**.  
Koordinator Sumatra tidak bisa memproses owner dari Pati (Jawa), dan sebaliknya.  
Contoh: Owner dari **Kabupaten Sarolangun (Jambi)** → **Koordinator Wilayah Sumatra**; Owner dari **Kabupaten Pati (Jateng)** → **Koordinator Wilayah Jawa**.

---

## Admin Pusat & Saudi

| Role | Email | Nama |
|------|--------|------|
| Super Admin | superadmin@bintangglobal.com | Super Admin |
| Admin Pusat | adminpusat@bintangglobal.com | Admin Pusat |
| Accounting | accounting@bintangglobal.com | Accounting Pusat |
| Hotel (Saudi) | hotel.saudi@bintangglobal.com | Hotel Saudi Arabia |
| Bus (Saudi) | bus.saudi@bintangglobal.com | Bus Saudi Arabia |
| Invoice Saudi | invoice.saudi@bintangglobal.com | Invoice Saudi Arabia |

---

## Koordinator (3 wilayah kerja)

Wilayah: **Bali-Nusa Tenggara**, **Jawa**, **Kalimantan**. Masing-masing wilayah punya **4 akun** (total 12):

| Role | Format email (slug = nama wilayah) |
|------|------------------------------------|
| Admin Koordinator | admin-koord.&lt;slug&gt;@bintangglobal.com |
| Invoice Koordinator | invoice-koord.&lt;slug&gt;@bintangglobal.com |
| Tiket Koordinator | tiket-koord.&lt;slug&gt;@bintangglobal.com |
| Visa Koordinator | visa-koord.&lt;slug&gt;@bintangglobal.com |

**Contoh akun (slug dari nama wilayah):**

**Wilayah Bali-Nusa Tenggara**
- admin-koord.bali-nusa-tenggara@bintangglobal.com
- invoice-koord.bali-nusa-tenggara@bintangglobal.com
- tiket-koord.bali-nusa-tenggara@bintangglobal.com
- visa-koord.bali-nusa-tenggara@bintangglobal.com

**Wilayah Jawa** — orderan dari owner daerah Jawa (mis. Pati, Bandung, Surabaya)
- admin-koord.jawa@bintangglobal.com
- invoice-koord.jawa@bintangglobal.com
- tiket-koord.jawa@bintangglobal.com
- visa-koord.jawa@bintangglobal.com

**Wilayah Kalimantan** — orderan dari owner daerah Kalimantan (mis. Samarinda, Pontianak, Balikpapan)
- admin-koord.kalimantan@bintangglobal.com
- invoice-koord.kalimantan@bintangglobal.com
- tiket-koord.kalimantan@bintangglobal.com
- visa-koord.kalimantan@bintangglobal.com

---

## Owner (9 akun — 3 per wilayah)

| Email | Nama | Perusahaan | Wilayah |
|--------|------|------------|---------|
| owner.denpasar@bintangglobal.com | Owner Travel Denpasar | Travel Bali Nusantara | **Bali-Nusa Tenggara** |
| owner.lombok@bintangglobal.com | Owner Travel Lombok | CV Lombok Travel | **Bali-Nusa Tenggara** |
| owner.kupang@bintangglobal.com | Owner Travel Kupang | PT Travel Kupang | **Bali-Nusa Tenggara** |
| owner.pati@bintangglobal.com | Owner Travel Pati | Travel Pati Jaya | **Jawa** |
| owner.bandung@bintangglobal.com | Owner Travel Bandung | CV Travel Bandung | **Jawa** |
| owner.surabaya@bintangglobal.com | Owner Travel Surabaya | PT Travel Surabaya | **Jawa** |
| owner.samarinda@bintangglobal.com | Owner Travel Samarinda | PT Travel Samarinda Utama | **Kalimantan** |
| owner.pontianak@bintangglobal.com | Owner Travel Pontianak | CV Travel Pontianak | **Kalimantan** |
| owner.balikpapan@bintangglobal.com | Owner Travel Balikpapan | Travel Balikpapan | **Kalimantan** |

Masing-masing owner di-assign ke **satu cabang** di wilayah tersebut. Order mereka hanya bisa diproses oleh **Koordinator Wilayah** yang sama.

---

*Seeder: `20250218000001-workflow-koordinator-users.js`*
