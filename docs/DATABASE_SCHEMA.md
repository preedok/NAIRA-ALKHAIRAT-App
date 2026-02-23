# Skema Database – Best Practice

Dokumen ini mendeskripsikan struktur database terkini dan relasi setelah restrukturisasi.

## Hierarki Lokasi

```
Wilayah (master wilayah: Sumatra, Jawa, dll.)
  └── Provinsi (provinsi di Indonesia)
        └── Branch (cabang/kantor)
```

- **wilayah** → **provinsi** (wilayah_id)
- **provinsi** → **branches** (provinsi_id)

## Tabel Inti

### users
- `id` (UUID, PK), `email`, `password_hash`, `name`, `phone`, `role`, `branch_id`, `wilayah_id`, `region`, `company_name`, `is_active`, `created_at`, `updated_at`, `last_login`
- **role**: ENUM — gunakan hanya: super_admin, admin_pusat, admin_koordinator, invoice_koordinator, tiket_koordinator, visa_koordinator, role_hotel, role_bus, role_invoice_saudi, role_accounting, owner. (admin_cabang, role_visa, role_ticket deprecated.)
- **branch_id**: untuk user yang terikat satu cabang (contoh: role_hotel, role_bus).
- **wilayah_id**: untuk koordinator (scope wilayah).

### owner_profiles
- `user_id` (FK → users), `status`, `assigned_branch_id`, `preferred_branch_id`, `activated_at`, dll.
- Satu user owner punya satu owner_profile; `assigned_branch_id` = cabang tempat owner dilayani.

### orders
- `id`, `order_number`, `owner_id` (FK → users), `branch_id` (FK → branches), `created_by`, `subtotal`, `penalty_amount`, `total_amount`, `total_jamaah`, `status`, `notes`, `created_at`, `updated_at`, `unblocked_by`
- Satu sumber kebenaran untuk order; filter di aplikasi menurut role (owner_id / branch_id / wilayah).

### order_items
- `order_id` (FK → orders), `type` (hotel, visa, ticket, bus, dll.), `product_ref_id`, `quantity`, `unit_price`, `subtotal`, `meta`, dll.

### invoices
- `order_id` (FK → orders), `owner_id`, `branch_id`, `invoice_number`, `status`, `total_amount`, `paid_amount`, dll.
- Satu order → satu invoice (1:1).

### payment_proofs
- `invoice_id` (FK → invoices), `uploaded_by`, `verified_by`, `amount`, `payment_date`, dll.

### Progress per tipe item
- **hotel_progress**, **visa_progress**, **ticket_progress**, **bus_progress**: masing-masing `order_item_id` (FK → order_items), dipakai untuk tracking pekerjaan hotel/visa/tiket/bus.

### Produk & harga
- **products** → **product_prices** (per product, per branch/owner).
- **business_rule_config**: aturan per cabang (currency_rates, require_hotel_with_visa, dll.).

### Accounting
- **accounting_fiscal_years** → **accounting_periods**
- **chart_of_accounts**, **account_mappings**, **journal_entries**, **journal_entry_lines**
- **payroll_settings**, **employee_salaries**, **payroll_runs**, **payroll_items**

## Relasi Penting

| Dari       | Ke           | Relasi |
|-----------|--------------|--------|
| Order     | User (owner) | N:1    |
| Order     | Branch       | N:1    |
| Order     | OrderItem    | 1:N    |
| Order     | Invoice      | 1:1    |
| Invoice   | PaymentProof | 1:N    |
| OrderItem | HotelProgress, VisaProgress, TicketProgress, BusProgress | 1:1 masing-masing |
| User      | Branch       | N:1 (optional) |
| User      | Wilayah      | N:1 (optional, koordinator) |
| OwnerProfile | User, Branch (assigned) | N:1 |

## Index & performa

- Index pada: `orders(owner_id, branch_id, status, created_at)`, `invoices(branch_id, status)`, `order_items(order_id, type)`.
- Migrasi indeks ada di: `20250217000012`, `20250217000013`.

## Migrasi

- **Role deprecated:** `20250219000002-migrate-deprecated-roles.js` — ubah user dengan role `admin_cabang`, `role_visa`, `role_ticket` ke role pengganti.
- **Tabel non-core dihapus:** `20250219000003-drop-non-core-tables.js` — drop `flyer_templates` dan `ui_templates` (fitur di luar core workflow bisnis).
