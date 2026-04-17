import React, { useMemo, useState } from 'react';
import { CalendarDays, Eye, Image, MapPin, Pencil, Plus, Search, Trash2, Users } from 'lucide-react';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import Input from '../../../components/common/Input';
import CurrencyInput from '../../../components/common/CurrencyInput';
import Badge from '../../../components/common/Badge';
import Table from '../../../components/common/Table';
import Autocomplete from '../../../components/common/Autocomplete';
import ActionMenu from '../../../components/common/ActionMenu';
import StatCard from '../../../components/common/StatCard';
import Modal, { ModalBody, ModalBox, ModalFooter, ModalHeader } from '../../../components/common/Modal';
import { SelectOption, TableColumn } from '../../../types';
import { useAuth } from '../../../contexts/AuthContext';
import { formatRupiah } from '../../../utils/currency';

type PackageStatus = 'draft' | 'active' | 'full';
type PackageCategory = 'reguler' | 'plus' | 'vip';

type UmrohPackage = {
  id: string;
  name: string;
  category: PackageCategory;
  status: PackageStatus;
  city: string;
  durationDays: number;
  departureDate: string;
  seats: number;
  bookedSeats: number;
  price: number;
  hotel: string;
  airline: string;
  highlights: string[];
  flyerTitle?: string;
  flyerUrl?: string;
};

const STATUS_BADGE: Record<PackageStatus, { label: string; variant: 'success' | 'warning' | 'default' }> = {
  draft: { label: 'Draft', variant: 'default' },
  active: { label: 'Aktif', variant: 'success' },
  full: { label: 'Penuh', variant: 'warning' }
};

const CATEGORY_LABEL: Record<PackageCategory, string> = {
  reguler: 'Reguler',
  plus: 'Plus',
  vip: 'VIP'
};

const initialPackages: UmrohPackage[] = [
  {
    id: 'PKG-001',
    name: 'Umroh Ramadhan Premium',
    category: 'vip',
    status: 'active',
    city: 'Makkah - Madinah',
    durationDays: 12,
    departureDate: '2026-08-24',
    seats: 40,
    bookedSeats: 31,
    price: 42500000,
    hotel: 'Swissotel Makkah',
    airline: 'Saudi Airlines',
    highlights: ['Hotel dekat Masjidil Haram', 'City tour Thaif', 'Muthawwif bersertifikat'],
    flyerTitle: 'Flyer Ramadhan Premium 2026',
    flyerUrl: 'https://example.com/flyer/ramadhan-premium'
  },
  {
    id: 'PKG-002',
    name: 'Umroh Plus Turki',
    category: 'plus',
    status: 'active',
    city: 'Makkah - Madinah - Istanbul',
    durationDays: 14,
    departureDate: '2026-09-10',
    seats: 35,
    bookedSeats: 22,
    price: 38900000,
    hotel: 'Hilton Convention',
    airline: 'Turkish Airlines',
    highlights: ['Transit wisata Istanbul', 'Makan 3x sehari', 'Pendamping dokter'],
    flyerTitle: 'Flyer Umroh Plus Turki',
    flyerUrl: 'https://example.com/flyer/plus-turki'
  },
  {
    id: 'PKG-003',
    name: 'Umroh Awal Musim',
    category: 'reguler',
    status: 'draft',
    city: 'Makkah - Madinah',
    durationDays: 10,
    departureDate: '2026-10-05',
    seats: 45,
    bookedSeats: 0,
    price: 29900000,
    hotel: 'Pullman Zamzam',
    airline: 'Garuda Indonesia',
    highlights: ['Harga ekonomis', 'Program manasik 3x', 'Handling bandara']
  },
  {
    id: 'PKG-004',
    name: 'Umroh Liburan Keluarga',
    category: 'plus',
    status: 'full',
    city: 'Makkah - Madinah - Jeddah',
    durationDays: 11,
    departureDate: '2026-12-18',
    seats: 50,
    bookedSeats: 50,
    price: 34500000,
    hotel: 'Anjum Hotel',
    airline: 'Qatar Airways',
    highlights: ['Khusus musim liburan', 'Bus private', 'Pendamping keluarga'],
    flyerTitle: 'Flyer Liburan Keluarga',
    flyerUrl: 'https://example.com/flyer/liburan-keluarga'
  }
];

const emptyForm: Omit<UmrohPackage, 'id' | 'bookedSeats'> = {
  name: '',
  category: 'reguler',
  status: 'draft',
  city: '',
  durationDays: 10,
  departureDate: '',
  seats: 40,
  price: 0,
  hotel: '',
  airline: '',
  highlights: [],
  flyerTitle: '',
  flyerUrl: ''
};

const columns: TableColumn[] = [
  { id: 'name', label: 'Nama Paket' },
  { id: 'category', label: 'Kategori' },
  { id: 'departure', label: 'Keberangkatan' },
  { id: 'seat', label: 'Kuota', align: 'center' },
  { id: 'price', label: 'Harga', align: 'right' },
  { id: 'flyer', label: 'Flyer', align: 'center' },
  { id: 'status', label: 'Status', align: 'center' },
  { id: 'actions', label: 'Aksi', align: 'right' }
];

const PackagesPage: React.FC = () => {
  const { user } = useAuth();
  const isReadOnly = user?.role === 'jamaah';
  const [packages, setPackages] = useState<UmrohPackage[]>(initialPackages);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | PackageStatus>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | PackageCategory>('all');
  const [detailItem, setDetailItem] = useState<UmrohPackage | null>(null);
  const [deleteItem, setDeleteItem] = useState<UmrohPackage | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<UmrohPackage | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [highlightInput, setHighlightInput] = useState('');
  const statusOptions: SelectOption[] = [
    { value: 'active', label: 'Aktif' },
    { value: 'draft', label: 'Draft' },
    { value: 'full', label: 'Penuh' }
  ];
  const categoryOptions: SelectOption[] = [
    { value: 'reguler', label: 'Reguler' },
    { value: 'plus', label: 'Plus' },
    { value: 'vip', label: 'VIP' }
  ];

  const filtered = useMemo(() => {
    return packages.filter((item) => {
      const q = query.trim().toLowerCase();
      const matchQuery =
        q.length === 0 ||
        item.name.toLowerCase().includes(q) ||
        item.city.toLowerCase().includes(q) ||
        item.airline.toLowerCase().includes(q) ||
        item.flyerTitle?.toLowerCase().includes(q);
      const matchStatus = statusFilter === 'all' || item.status === statusFilter;
      const matchCategory = categoryFilter === 'all' || item.category === categoryFilter;
      return matchQuery && matchStatus && matchCategory;
    });
  }, [packages, query, statusFilter, categoryFilter]);

  const stats = useMemo(() => {
    const activeCount = packages.filter((item) => item.status === 'active').length;
    const totalSeats = packages.reduce((sum, item) => sum + item.seats, 0);
    const bookedSeats = packages.reduce((sum, item) => sum + item.bookedSeats, 0);
    return {
      total: packages.length,
      activeCount,
      occupancy: totalSeats ? Math.round((bookedSeats / totalSeats) * 100) : 0,
      averagePrice: packages.length ? Math.round(packages.reduce((sum, item) => sum + item.price, 0) / packages.length) : 0
    };
  }, [packages]);

  const resetForm = () => {
    setEditingItem(null);
    setFormData(emptyForm);
    setHighlightInput('');
  };

  const openCreateModal = () => {
    resetForm();
    setFormOpen(true);
  };

  const openEditModal = (item: UmrohPackage) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      category: item.category,
      status: item.status,
      city: item.city,
      durationDays: item.durationDays,
      departureDate: item.departureDate,
      seats: item.seats,
      price: item.price,
      hotel: item.hotel,
      airline: item.airline,
      highlights: item.highlights,
      flyerTitle: item.flyerTitle || '',
      flyerUrl: item.flyerUrl || ''
    });
    setFormOpen(true);
  };

  const savePackage = () => {
    if (!formData.name || !formData.departureDate || !formData.city || !formData.hotel || !formData.airline) return;
    if (editingItem) {
      setPackages((prev) =>
        prev.map((item) =>
          item.id === editingItem.id
            ? {
                ...item,
                ...formData,
                bookedSeats: Math.min(item.bookedSeats, formData.seats)
              }
            : item
        )
      );
    } else {
      const newItem: UmrohPackage = {
        id: `PKG-${String(packages.length + 1).padStart(3, '0')}`,
        ...formData,
        bookedSeats: 0
      };
      setPackages((prev) => [newItem, ...prev]);
    }
    setFormOpen(false);
    resetForm();
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Paket" value={stats.total} />
        <StatCard label="Paket Aktif" value={stats.activeCount} accentClassName="text-emerald-600" />
        <StatCard label="Rata-rata Harga" value={formatRupiah(stats.averagePrice)} />
        <StatCard label="Occupancy" value={`${stats.occupancy}%`} />
      </div>

      <Card>
        <div className={`grid grid-cols-1 gap-3 ${isReadOnly ? 'lg:grid-cols-3' : 'lg:grid-cols-4'}`}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:col-span-3">
            <Input
              ariaLabel="Cari paket"
              placeholder="Cari nama paket, kota, maskapai..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              icon={<Search className="w-4 h-4" />}
            />
            <Autocomplete
              value={statusFilter === 'all' ? '' : statusFilter}
              onChange={(value) => setStatusFilter((value || 'all') as 'all' | PackageStatus)}
              options={statusOptions}
              emptyLabel="Semua status"
            />
            <Autocomplete
              value={categoryFilter === 'all' ? '' : categoryFilter}
              onChange={(value) => setCategoryFilter((value || 'all') as 'all' | PackageCategory)}
              options={categoryOptions}
              emptyLabel="Semua kategori"
            />
          </div>
          {!isReadOnly && (
            <Button icon={<Plus className="w-4 h-4" />} onClick={openCreateModal} className="w-full lg:w-auto lg:justify-self-end">
              Tambah Paket
            </Button>
          )}
        </div>
      </Card>

      <Card padding="none">
        <Table
          columns={columns}
          data={filtered}
          stickyActionsColumn
          emptyMessage="Paket tidak ditemukan"
          emptyDescription="Coba ubah kata kunci atau filter."
          renderRow={(item) => (
            <tr key={item.id} className="hover:bg-slate-50">
              <td className="px-4 py-3">
                <p className="font-semibold text-slate-800">{item.name}</p>
                <p className="text-xs text-slate-500">{item.id}</p>
              </td>
              <td className="px-4 py-3"><Badge variant="info" size="sm">{CATEGORY_LABEL[item.category]}</Badge></td>
              <td className="px-4 py-3">
                <div className="text-sm text-slate-700 flex items-center gap-1"><CalendarDays className="w-4 h-4 text-slate-400" /> {new Date(item.departureDate).toLocaleDateString('id-ID')}</div>
                <div className="text-xs text-slate-500 mt-1 flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {item.city}</div>
              </td>
              <td className="px-4 py-3 text-center">
                <div className="text-sm font-semibold text-slate-700">{item.bookedSeats}/{item.seats}</div>
                <div className="text-xs text-slate-500">{Math.round((item.bookedSeats / item.seats) * 100)}%</div>
              </td>
              <td className="px-4 py-3 text-right font-semibold text-slate-800">{formatRupiah(item.price)}</td>
              <td className="px-4 py-3 text-center">
                {item.flyerUrl ? (
                  <a
                    href={item.flyerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-primary-700 hover:underline"
                  >
                    <Image className="w-3.5 h-3.5" />
                    Ada flyer
                  </a>
                ) : (
                  <span className="text-xs text-slate-400">Belum ada</span>
                )}
              </td>
              <td className="px-4 py-3 text-center">
                <Badge variant={STATUS_BADGE[item.status].variant} size="sm">{STATUS_BADGE[item.status].label}</Badge>
              </td>
              <td className="px-4 py-3">
                <div className="relative flex items-center justify-end">
                  <ActionMenu
                    menuWidthClass="w-[180px]"
                    items={[
                      {
                        id: 'detail',
                        label: 'Lihat detail',
                        icon: <Eye className="w-4 h-4" />,
                        onClick: () => setDetailItem(item)
                      },
                      ...(!isReadOnly
                        ? [{
                            id: 'edit',
                            label: 'Edit paket',
                            icon: <Pencil className="w-4 h-4" />,
                            tone: 'warning' as const,
                            onClick: () => openEditModal(item)
                          },
                          {
                            id: 'delete',
                            label: 'Hapus paket',
                            icon: <Trash2 className="w-4 h-4" />,
                            tone: 'danger' as const,
                            onClick: () => setDeleteItem(item)
                          }]
                        : [])
                    ]}
                  />
                </div>
              </td>
            </tr>
          )}
        />
      </Card>

      <Modal open={!!detailItem} onClose={() => setDetailItem(null)}>
        <ModalBox className="max-w-3xl min-h-[70vh]">
          <ModalHeader
            title={detailItem?.name ?? 'Detail Paket'}
            subtitle="Informasi lengkap paket umroh"
            onClose={() => setDetailItem(null)}
            icon={<Users className="w-5 h-5" />}
          />
          <ModalBody>
            {detailItem && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div><p className="text-slate-500">Kategori</p><p className="font-semibold">{CATEGORY_LABEL[detailItem.category]}</p></div>
                  <div><p className="text-slate-500">Status</p><Badge variant={STATUS_BADGE[detailItem.status].variant} size="sm">{STATUS_BADGE[detailItem.status].label}</Badge></div>
                  <div><p className="text-slate-500">Keberangkatan</p><p className="font-semibold">{new Date(detailItem.departureDate).toLocaleDateString('id-ID')}</p></div>
                  <div><p className="text-slate-500">Durasi</p><p className="font-semibold">{detailItem.durationDays} hari</p></div>
                  <div><p className="text-slate-500">Hotel</p><p className="font-semibold">{detailItem.hotel}</p></div>
                  <div><p className="text-slate-500">Maskapai</p><p className="font-semibold">{detailItem.airline}</p></div>
                </div>
                <Card className="bg-slate-50 border-slate-100">
                  <p className="text-sm text-slate-500">Highlight Program</p>
                  <ul className="mt-2 space-y-2">
                    {detailItem.highlights.map((highlight) => (
                      <li key={highlight} className="text-sm text-slate-700 list-disc ml-4">{highlight}</li>
                    ))}
                  </ul>
                </Card>
                <Card className="bg-sky-50 border-sky-100">
                  <p className="text-sm text-sky-700">Flyer Paket</p>
                  {detailItem.flyerUrl ? (
                    <a
                      href={detailItem.flyerUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex items-center gap-2 text-sky-800 font-semibold hover:underline"
                    >
                      <Image className="w-4 h-4" />
                      {detailItem.flyerTitle || 'Lihat flyer'}
                    </a>
                  ) : (
                    <p className="text-sm text-slate-500 mt-1">Flyer belum ditambahkan.</p>
                  )}
                </Card>
                <Card className="bg-amber-50 border-amber-100">
                  <p className="text-sm text-amber-700">Harga Paket</p>
                  <p className="text-2xl font-bold text-amber-800 mt-1">{formatRupiah(detailItem.price)}</p>
                </Card>
              </div>
            )}
          </ModalBody>
        </ModalBox>
      </Modal>

      <Modal open={formOpen} onClose={() => setFormOpen(false)}>
        <ModalBox>
          <ModalHeader
            title={editingItem ? 'Edit Paket' : 'Tambah Paket Baru'}
            subtitle="Lengkapi data paket umroh"
            onClose={() => setFormOpen(false)}
          />
          <ModalBody>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input label="Nama paket" value={formData.name} onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))} />
              <Input label="Kota tujuan" value={formData.city} onChange={(e) => setFormData((p) => ({ ...p, city: e.target.value }))} />
              <Input label="Tanggal berangkat" type="date" value={formData.departureDate} onChange={(e) => setFormData((p) => ({ ...p, departureDate: e.target.value }))} />
              <Input label="Durasi (hari)" type="number" value={String(formData.durationDays)} onChange={(e) => setFormData((p) => ({ ...p, durationDays: Number(e.target.value) || 0 }))} />
              <Input label="Kuota kursi" type="number" value={String(formData.seats)} onChange={(e) => setFormData((p) => ({ ...p, seats: Number(e.target.value) || 0 }))} />
              <CurrencyInput label="Harga paket" value={formData.price} onChange={(value) => setFormData((p) => ({ ...p, price: value }))} />
              <Input label="Hotel" value={formData.hotel} onChange={(e) => setFormData((p) => ({ ...p, hotel: e.target.value }))} />
              <Input label="Maskapai" value={formData.airline} onChange={(e) => setFormData((p) => ({ ...p, airline: e.target.value }))} />
              <Input label="Judul flyer" value={formData.flyerTitle || ''} onChange={(e) => setFormData((p) => ({ ...p, flyerTitle: e.target.value }))} />
              <Input label="Link flyer (URL)" value={formData.flyerUrl || ''} onChange={(e) => setFormData((p) => ({ ...p, flyerUrl: e.target.value }))} placeholder="https://..." />
              <Autocomplete
                label="Kategori"
                value={formData.category}
                onChange={(value) => setFormData((p) => ({ ...p, category: value as PackageCategory }))}
                options={categoryOptions}
              />
              <Autocomplete
                label="Status"
                value={formData.status}
                onChange={(value) => setFormData((p) => ({ ...p, status: value as PackageStatus }))}
                options={statusOptions}
              />
            </div>

            <div className="mt-5">
              <label className="block text-sm font-semibold text-slate-700 mb-2">Highlight paket</label>
              <div className="flex gap-2">
                <Input ariaLabel="Tambah highlight" value={highlightInput} onChange={(e) => setHighlightInput(e.target.value)} placeholder="Contoh: Makan 3x sehari" />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const next = highlightInput.trim();
                    if (!next) return;
                    setFormData((p) => ({ ...p, highlights: [...p.highlights, next] }));
                    setHighlightInput('');
                  }}
                >
                  Tambah
                </Button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {formData.highlights.map((highlight) => (
                  <button
                    type="button"
                    key={highlight}
                    onClick={() => setFormData((p) => ({ ...p, highlights: p.highlights.filter((h) => h !== highlight) }))}
                    className="rounded-full bg-slate-100 text-slate-700 text-xs px-3 py-1 hover:bg-slate-200"
                  >
                    {highlight} x
                  </button>
                ))}
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={() => setFormOpen(false)}>Batal</Button>
            <Button onClick={savePackage}>{editingItem ? 'Update Paket' : 'Simpan Paket'}</Button>
          </ModalFooter>
        </ModalBox>
      </Modal>

      <Modal open={!!deleteItem} onClose={() => setDeleteItem(null)}>
        <ModalBox className="max-w-xl min-h-0">
          <ModalHeader title="Hapus Paket" subtitle="Tindakan ini tidak dapat dibatalkan" onClose={() => setDeleteItem(null)} />
          <ModalBody>
            <p className="text-sm text-slate-700">
              Yakin ingin menghapus paket <span className="font-semibold">{deleteItem?.name}</span>?
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={() => setDeleteItem(null)}>Batal</Button>
            <Button
              variant="danger"
              onClick={() => {
                if (!deleteItem) return;
                setPackages((prev) => prev.filter((item) => item.id !== deleteItem.id));
                setDeleteItem(null);
              }}
            >
              Hapus Paket
            </Button>
          </ModalFooter>
        </ModalBox>
      </Modal>
    </div>
  );
};

export default PackagesPage;
