# Arsitektur Sistem Accounting Terpusat
## Bintang Global Group - Travel Umroh B2B

### 1. Ringkasan Eksekutif

Sistem accounting terpusat dirancang setara standar software profesional (Accurate/SAP) yang disesuaikan dengan karakter bisnis travel umroh B2B. Seluruh proses keuangan dan kontrol akuntansi ditangani oleh **Role Accounting Pusat** dengan integrasi end-to-end dari transaksi operasional wilayah hingga laporan keuangan konsolidasi.

### 2. Struktur Organisasi & Scope

| Role | Scope | Akses Accounting |
|------|-------|------------------|
| Admin Pusat | Seluruh perusahaan | Full |
| Admin Koordinator Wilayah | Wilayah + turunan | Lihat wilayah |
| Admin Provinsi | Provinsi + cabang | Lihat provinsi |
| Admin Cabang | Cabang | Lihat cabang |
| Invoice Koordinator (Wilayah/Provinsi/Cabang) | Sesuai owner | Submit dokumen |
| Tiket Koordinator Wilayah | Wilayah | Submit dokumen |
| Visa Koordinator Wilayah | Wilayah | Submit dokumen |
| Hotel Saudi / Bus Saudi | Operasional Saudi | Submit tagihan vendor |
| **Accounting Pusat** | **Seluruh data** | **Full control** |

### 3. Workflow Dokumen

```
Draft → Submitted → Verified → Approved → Posted to GL → Closed
```

- **Draft**: Dokumen dibuat, belum dikirim
- **Submitted**: Dikirim ke Accounting untuk review
- **Verified**: Accounting memverifikasi kebenaran data
- **Approved**: Disetujui untuk posting
- **Posted to GL**: Sudah diposting ke General Ledger
- **Closed**: Periode ditutup, tidak dapat diubah

**Kontrol**: Tidak ada dokumen yang dapat diposting ke GL sebelum melewati approval Accounting.

### 4. Modul Master Data Terpusat

#### 4.1 Chart of Accounts (COA)
- Multi-level (Account Group → Sub Group → Account)
- Tipe: Asset, Liability, Equity, Revenue, Expense
- Mata uang: IDR, SAR
- Status: Active / Inactive

#### 4.2 Account Mapping
- Mapping otomatis per jenis transaksi:
  - Hotel → Akun Pendapatan Hotel, HPP Hotel
  - Visa → Akun Pendapatan Visa, HPP Visa
  - Tiket → Akun Pendapatan Tiket, HPP Tiket
  - Bus → Akun Pendapatan Bus, HPP Bus
  - Handling → Akun Pendapatan Handling

#### 4.3 Master Customer B2B
- Per wilayah (OwnerProfile extended)
- Term of payment, credit limit
- Aging schedule configuration

#### 4.4 Master Supplier
- Vendor Saudi (hotel, bus)
- Vendor lokal
- Term of payment

#### 4.5 Master Karyawan
- Data karyawan untuk payroll
- Assignment wilayah/divisi

#### 4.6 Master Komponen Gaji
- Gaji pokok, tunjangan, potongan
- Formula configurable

#### 4.7 Master Pajak
- PPh 21, PPN, dll
- Rate dan aturan

#### 4.8 Accounting Period & Fiscal Year
- Periode bulanan
- Lock period dengan audit trail
- Closing procedure

### 5. Modul Penjualan (Sales)

- Penjualan B2B per wilayah berdasarkan produk
- Invoice nomor unik per wilayah, terintegrasi pusat
- Multi-currency (IDR, SAR)
- Automatic exchange rate adjustment
- Piutang usaha, aging schedule
- Reminder otomatis
- Rekonsiliasi pembayaran parsial/penuh

### 6. Modul Pembelian (Purchase)

- Tagihan vendor Saudi (hotel, bus)
- Upload dokumen invoice vendor
- Hutang usaha
- Penjadwalan pembayaran
- Rekonsiliasi bank
- Accrual & prepaid expense

### 7. General Ledger

- Auto-journal dari seluruh modul
- Jurnal manual dengan approval layer
- Recurring journal
- Reversal journal
- Inter-branch clearing
- Trial balance real-time
- P&L per wilayah
- Consolidated P&L
- Neraca
- Cash flow (direct & indirect)
- Analisa margin per produk

### 8. Budgeting

- Budget per wilayah
- Realisasi vs budget analysis

### 9. Payroll

- **Payroll Otomatis**: Formula configurable (gaji pokok, tunjangan, potongan PPh 21, BPJS, dll)
- **Manual Entry Mode**: Input langsung dengan mapping jurnal otomatis
- Workflow: Draft → Calculated → Reviewed → Approved → Posted to GL → Payment Scheduled → Paid
- Slip gaji nomor unik, QR/hash verification
- Double entry: Beban Gaji, Hutang Gaji
- File transfer bank massal
- Laporan beban gaji per wilayah/divisi

### 10. Kas & Bank

- Multi rekening
- Bank reconciliation (import mutasi)
- Cash advance & settlement
- Petty cash management
- Cash position real-time

### 11. Kontrol Internal

- Role-based access control
- Approval matrix bertingkat
- Segregation of duties
- Full audit trail (siapa buat, ubah, setujui, post)

### 12. Dashboard Eksekutif

- Total revenue per wilayah
- Outstanding receivable
- Outstanding payable
- Gross margin per produk
- Beban operasional
- Payroll cost ratio
- Cash flow summary real-time

---

## Fase Implementasi

### Fase 1 (Foundation) - Current
- Chart of Accounts
- Fiscal Period & Year
- Account Mapping
- Document workflow constants

### Fase 2
- Sales module integration
- Purchase module
- GL posting engine

### Fase 3
- Payroll foundation
- Cash & Bank
- Reconciliation

### Fase 4
- Reports & Dashboard
- Budgeting
- Audit trail enhancement
