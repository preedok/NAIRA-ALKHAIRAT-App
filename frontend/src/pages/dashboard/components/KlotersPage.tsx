import React, { useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, Eye, MapPin, MoreVertical, Pencil, PlaneTakeoff, Search, Users } from 'lucide-react';
import Card from '../../../components/common/Card';
import Table from '../../../components/common/Table';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Input from '../../../components/common/Input';
import Autocomplete from '../../../components/common/Autocomplete';
import Modal, { ModalBody, ModalBox, ModalFooter, ModalHeader } from '../../../components/common/Modal';
import { SelectOption, TableColumn } from '../../../types';
import { useAuth } from '../../../contexts/AuthContext';

type KloterStatus = 'open' | 'boarding' | 'closed';

type KloterItem = {
  id: string;
  code: string;
  packageName: string;
  departureDate: string;
  returnDate: string;
  meetingPoint: string;
  airline: string;
  quota: number;
  booked: number;
  leaderName: string;
  status: KloterStatus;
  notes?: string;
};

type DepartureStatus = 'scheduled' | 'checkin' | 'departed';

type DepartureManifestItem = {
  id: string;
  kloterId: string;
  orderNo: string;
  jamaahName: string;
  originCity: string;
  originAirport: string;
  status: DepartureStatus;
};

const STATUS_MAP: Record<KloterStatus, { label: string; variant: 'success' | 'warning' | 'default' }> = {
  open: { label: 'Open', variant: 'success' },
  boarding: { label: 'Boarding', variant: 'warning' },
  closed: { label: 'Closed', variant: 'default' }
};

const initialKloters: KloterItem[] = [
  {
    id: 'KLT-001',
    code: 'KLT-JKT-0826-A',
    packageName: 'Umroh Ramadhan Premium',
    departureDate: '2026-08-24',
    returnDate: '2026-09-05',
    meetingPoint: 'Soekarno-Hatta T3',
    airline: 'Saudi Airlines',
    quota: 45,
    booked: 33,
    leaderName: 'Ust. Fadli Rahman',
    status: 'open',
    notes: 'Manasik final H-7'
  },
  {
    id: 'KLT-002',
    code: 'KLT-SBY-0910-B',
    packageName: 'Umroh Plus Turki',
    departureDate: '2026-09-10',
    returnDate: '2026-09-24',
    meetingPoint: 'Juanda Terminal 2',
    airline: 'Turkish Airlines',
    quota: 40,
    booked: 39,
    leaderName: 'Ust. Anwar Saidi',
    status: 'boarding'
  },
  {
    id: 'KLT-003',
    code: 'KLT-MKS-1218-C',
    packageName: 'Umroh Liburan Keluarga',
    departureDate: '2026-12-18',
    returnDate: '2026-12-29',
    meetingPoint: 'Sultan Hasanuddin',
    airline: 'Qatar Airways',
    quota: 50,
    booked: 50,
    leaderName: 'Ust. Ridwan Karim',
    status: 'closed',
    notes: 'Kuota penuh'
  }
];

const DEPARTURE_STATUS_MAP: Record<DepartureStatus, { label: string; variant: 'default' | 'warning' | 'success' }> = {
  scheduled: { label: 'Terjadwal', variant: 'default' },
  checkin: { label: 'Check-in', variant: 'warning' },
  departed: { label: 'Berangkat', variant: 'success' }
};

const kloterStatusOptions: SelectOption[] = [
  { value: 'open', label: 'Open' },
  { value: 'boarding', label: 'Boarding' },
  { value: 'closed', label: 'Closed' }
];

const initialManifest: DepartureManifestItem[] = [
  {
    id: 'MNF-001',
    kloterId: 'KLT-001',
    orderNo: 'ORD-2026-011',
    jamaahName: 'Ahmad Fauzi',
    originCity: 'Jakarta',
    originAirport: 'CGK - Soekarno Hatta',
    status: 'scheduled'
  },
  {
    id: 'MNF-002',
    kloterId: 'KLT-001',
    orderNo: 'ORD-2026-012',
    jamaahName: 'Lina Marlina',
    originCity: 'Bandung',
    originAirport: 'BDO - Husein Sastranegara',
    status: 'checkin'
  },
  {
    id: 'MNF-003',
    kloterId: 'KLT-002',
    orderNo: 'ORD-2026-018',
    jamaahName: 'Siti Rahma',
    originCity: 'Surabaya',
    originAirport: 'SUB - Juanda',
    status: 'checkin'
  },
  {
    id: 'MNF-004',
    kloterId: 'KLT-002',
    orderNo: 'ORD-2026-019',
    jamaahName: 'Rina Wulandari',
    originCity: 'Balikpapan',
    originAirport: 'BPN - Sultan Aji Muhammad',
    status: 'scheduled'
  },
  {
    id: 'MNF-005',
    kloterId: 'KLT-003',
    orderNo: 'ORD-2026-025',
    jamaahName: 'Budi Santoso',
    originCity: 'Makassar',
    originAirport: 'UPG - Sultan Hasanuddin',
    status: 'departed'
  }
];

const emptyForm: Omit<KloterItem, 'id' | 'booked'> = {
  code: '',
  packageName: '',
  departureDate: '',
  returnDate: '',
  meetingPoint: '',
  airline: '',
  quota: 40,
  leaderName: '',
  status: 'open',
  notes: ''
};

const columns: TableColumn[] = [
  { id: 'code', label: 'Kode Kloter' },
  { id: 'package', label: 'Paket' },
  { id: 'schedule', label: 'Jadwal' },
  { id: 'quota', label: 'Kuota', align: 'center' },
  { id: 'status', label: 'Status', align: 'center' },
  { id: 'actions', label: 'Aksi', align: 'right' }
];

const KlotersPage: React.FC = () => {
  const { user } = useAuth();
  const isReadOnly = user?.role === 'jamaah';
  const [kloters, setKloters] = useState<KloterItem[]>(initialKloters);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | KloterStatus>('all');
  const [detailItem, setDetailItem] = useState<KloterItem | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<KloterItem | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [manifestRows, setManifestRows] = useState<DepartureManifestItem[]>(initialManifest);
  const [airportFilter, setAirportFilter] = useState<'all' | string>('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return kloters.filter((item) => {
      const manifests = manifestRows.filter((row) => row.kloterId === item.id);
      const queryMatch =
        q.length === 0 ||
        item.code.toLowerCase().includes(q) ||
        item.packageName.toLowerCase().includes(q) ||
        item.meetingPoint.toLowerCase().includes(q) ||
        item.leaderName.toLowerCase().includes(q) ||
        manifests.some(
          (row) =>
            row.jamaahName.toLowerCase().includes(q) ||
            row.orderNo.toLowerCase().includes(q) ||
            row.originAirport.toLowerCase().includes(q)
        );
      const statusMatch = statusFilter === 'all' || item.status === statusFilter;
      const airportMatch =
        airportFilter === 'all' || manifests.some((row) => row.originAirport === airportFilter);
      return queryMatch && statusMatch && airportMatch;
    });
  }, [kloters, query, statusFilter, manifestRows, airportFilter]);

  const airportOptions = useMemo(
    () => Array.from(new Set(manifestRows.map((item) => item.originAirport))).sort((a, b) => a.localeCompare(b)),
    [manifestRows]
  );

  const stats = useMemo(() => {
    const total = kloters.length;
    const open = kloters.filter((x) => x.status === 'open').length;
    const totalQuota = kloters.reduce((sum, x) => sum + x.quota, 0);
    const totalBooked = kloters.reduce((sum, x) => sum + x.booked, 0);
    const occupancy = totalQuota ? Math.round((totalBooked / totalQuota) * 100) : 0;
    const totalDepartures = manifestRows.length;
    const activeAirports = new Set(manifestRows.map((x) => x.originAirport)).size;
    return { total, open, totalQuota, occupancy, totalDepartures, activeAirports };
  }, [kloters, manifestRows]);

  const markManifestDeparted = (id: string) => {
    setManifestRows((prev) => prev.map((row) => (row.id === id ? { ...row, status: 'departed' } : row)));
  };

  const openCreate = () => {
    setEditingItem(null);
    setFormData(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (item: KloterItem) => {
    setEditingItem(item);
    setFormData({
      code: item.code,
      packageName: item.packageName,
      departureDate: item.departureDate,
      returnDate: item.returnDate,
      meetingPoint: item.meetingPoint,
      airline: item.airline,
      quota: item.quota,
      leaderName: item.leaderName,
      status: item.status,
      notes: item.notes || ''
    });
    setFormOpen(true);
  };

  const saveKloter = () => {
    if (!formData.code || !formData.packageName || !formData.departureDate || !formData.returnDate) return;
    if (editingItem) {
      setKloters((prev) =>
        prev.map((item) =>
          item.id === editingItem.id ? { ...item, ...formData, booked: Math.min(item.booked, formData.quota) } : item
        )
      );
    } else {
      setKloters((prev) => [
        {
          id: `KLT-${String(prev.length + 1).padStart(3, '0')}`,
          ...formData,
          booked: 0
        },
        ...prev
      ]);
    }
    setFormOpen(false);
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card><p className="text-sm text-stone-500">Total Kloter</p><p className="text-2xl font-bold mt-1">{stats.total}</p></Card>
        <Card><p className="text-sm text-stone-500">Kloter Open</p><p className="text-2xl font-bold mt-1 text-emerald-600">{stats.open}</p></Card>
        <Card><p className="text-sm text-stone-500">Total Kuota</p><p className="text-2xl font-bold mt-1">{stats.totalQuota}</p></Card>
        <Card><p className="text-sm text-stone-500">Occupancy</p><p className="text-2xl font-bold mt-1">{stats.occupancy}%</p></Card>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card><p className="text-sm text-stone-500">Total Jamaah Keberangkatan</p><p className="text-2xl font-bold mt-1 text-primary-700">{stats.totalDepartures}</p></Card>
        <Card><p className="text-sm text-stone-500">Bandara Asal Aktif</p><p className="text-2xl font-bold mt-1">{stats.activeAirports}</p></Card>
      </div>

      <Card>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full lg:max-w-2xl">
            <Input
              ariaLabel="Cari kloter"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              icon={<Search className="w-4 h-4" />}
              placeholder="Cari kode kloter, paket, titik kumpul, ketua"
            />
            <Autocomplete
              value={statusFilter === 'all' ? '' : statusFilter}
              onChange={(value) => setStatusFilter((value || 'all') as 'all' | KloterStatus)}
              options={kloterStatusOptions}
              emptyLabel="Semua status"
            />
            <Autocomplete
              value={airportFilter === 'all' ? '' : airportFilter}
              onChange={(value) => setAirportFilter(value || 'all')}
              options={airportOptions.map((airport) => ({ value: airport, label: airport }))}
              emptyLabel="Semua bandara asal jamaah"
              className="sm:col-span-2"
            />
          </div>
          {!isReadOnly && (
            <Button onClick={openCreate}>Tambah Kloter</Button>
          )}
        </div>
      </Card>

      <Card padding="none">
        <Table
          columns={columns}
          data={filtered}
          emptyMessage="Belum ada data kloter"
          emptyDescription="Tambahkan kloter untuk mengelompokkan jamaah keberangkatan."
          stickyActionsColumn
          renderRow={(item, index) => (
            <tr key={item.id} className="hover:bg-slate-50">
              <td className="px-4 py-3">
                <p className="font-semibold text-slate-800">{item.code}</p>
                <p className="text-xs text-slate-500">{item.leaderName}</p>
              </td>
              <td className="px-4 py-3 text-slate-700">{item.packageName}</td>
              <td className="px-4 py-3">
                <div className="text-sm text-slate-700 inline-flex items-center gap-1">
                  <PlaneTakeoff className="w-4 h-4 text-slate-400" />
                  {new Date(item.departureDate).toLocaleDateString('id-ID')}
                </div>
                <div className="text-xs text-slate-500 mt-1 inline-flex items-center gap-1">
                  <CalendarDays className="w-3.5 h-3.5" />
                  Pulang {new Date(item.returnDate).toLocaleDateString('id-ID')}
                </div>
              </td>
              <td className="px-4 py-3 text-center">
                <p className="text-sm font-semibold text-slate-800">{item.booked}/{item.quota}</p>
                <p className="text-xs text-slate-500">{Math.round((item.booked / item.quota) * 100)}%</p>
              </td>
              <td className="px-4 py-3 text-center">
                <Badge variant={STATUS_MAP[item.status].variant} size="sm">{STATUS_MAP[item.status].label}</Badge>
              </td>
              <td className="px-4 py-3">
                <div className="relative flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => setActionMenuId((prev) => (prev === item.id ? null : item.id))}
                    className="p-2 rounded-lg hover:bg-slate-100 text-slate-600"
                    aria-label="Buka menu aksi"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                  {actionMenuId === item.id && (
                    <div className={`absolute right-0 z-[70] min-w-[160px] rounded-xl border border-slate-200 bg-white shadow-lg p-1 ${index < 2 ? 'top-full mt-1' : 'bottom-full mb-1'}`}>
                      <button
                        type="button"
                        onClick={() => {
                          setDetailItem(item);
                          setActionMenuId(null);
                        }}
                        className="w-full text-left rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 inline-flex items-center gap-2"
                      >
                        <Eye className="w-4 h-4" />
                        Detail
                      </button>
                      {!isReadOnly && (
                        <button
                          type="button"
                          onClick={() => {
                            openEdit(item);
                            setActionMenuId(null);
                          }}
                          className="w-full text-left rounded-lg px-3 py-2 text-sm text-amber-700 hover:bg-amber-50 inline-flex items-center gap-2"
                        >
                          <Pencil className="w-4 h-4" />
                          Edit
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </td>
            </tr>
          )}
        />
      </Card>

      <Modal open={!!detailItem} onClose={() => setDetailItem(null)}>
        <ModalBox className="max-w-3xl min-h-0">
          <ModalHeader title={detailItem?.code || 'Detail Kloter'} subtitle={detailItem?.packageName} onClose={() => setDetailItem(null)} icon={<Users className="w-5 h-5" />} />
          <ModalBody>
            {detailItem && (
              <div className="space-y-4">
                {(() => {
                  const manifestForKloter = manifestRows.filter((row) => row.kloterId === detailItem.id);
                  return (
                    <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div><p className="text-slate-500">Ketua Kloter</p><p className="font-semibold">{detailItem.leaderName}</p></div>
                  <div><p className="text-slate-500">Maskapai</p><p className="font-semibold">{detailItem.airline}</p></div>
                  <div><p className="text-slate-500">Tanggal Berangkat</p><p className="font-semibold">{new Date(detailItem.departureDate).toLocaleDateString('id-ID')}</p></div>
                  <div><p className="text-slate-500">Tanggal Pulang</p><p className="font-semibold">{new Date(detailItem.returnDate).toLocaleDateString('id-ID')}</p></div>
                  <div><p className="text-slate-500">Titik Kumpul</p><p className="font-semibold">{detailItem.meetingPoint}</p></div>
                  <div><p className="text-slate-500">Status</p><Badge variant={STATUS_MAP[detailItem.status].variant} size="sm">{STATUS_MAP[detailItem.status].label}</Badge></div>
                </div>
                <Card className="bg-slate-50 border-slate-100">
                  <p className="text-sm text-slate-500">Kapasitas Jamaah</p>
                  <p className="text-2xl font-bold text-slate-800 mt-1">{detailItem.booked}/{detailItem.quota}</p>
                </Card>
                <Card className="bg-white border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-slate-700">Manifest Keberangkatan Jamaah</p>
                    <p className="text-xs text-slate-500">{manifestForKloter.length} order/jamaah</p>
                  </div>
                  {manifestForKloter.length === 0 ? (
                    <p className="text-sm text-slate-500">Belum ada data order keberangkatan pada kloter ini.</p>
                  ) : (
                    <div className="space-y-2">
                      {manifestForKloter.map((manifest) => (
                        <div key={manifest.id} className="rounded-lg border border-slate-200 px-3 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-slate-800">{manifest.jamaahName}</p>
                              <p className="text-xs text-slate-500">{manifest.orderNo}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={DEPARTURE_STATUS_MAP[manifest.status].variant} size="sm">
                                {DEPARTURE_STATUS_MAP[manifest.status].label}
                              </Badge>
                              {!isReadOnly && manifest.status !== 'departed' && (
                                <button
                                  type="button"
                                  onClick={() => markManifestDeparted(manifest.id)}
                                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Tandai Berangkat
                                </button>
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-slate-600 mt-1 inline-flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                            {manifest.originCity} - {manifest.originAirport}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
                {detailItem.notes && <p className="text-sm text-slate-600">Catatan: {detailItem.notes}</p>}
                    </>
                  );
                })()}
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={() => setDetailItem(null)}>Tutup</Button>
          </ModalFooter>
        </ModalBox>
      </Modal>

      <Modal open={formOpen} onClose={() => setFormOpen(false)}>
        <ModalBox>
          <ModalHeader title={editingItem ? 'Edit Kloter' : 'Tambah Kloter'} subtitle="Lengkapi data jadwal keberangkatan" onClose={() => setFormOpen(false)} />
          <ModalBody>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input label="Kode Kloter" value={formData.code} onChange={(e) => setFormData((p) => ({ ...p, code: e.target.value }))} />
              <Input label="Nama Paket" value={formData.packageName} onChange={(e) => setFormData((p) => ({ ...p, packageName: e.target.value }))} />
              <Input label="Tanggal Berangkat" type="date" value={formData.departureDate} onChange={(e) => setFormData((p) => ({ ...p, departureDate: e.target.value }))} />
              <Input label="Tanggal Pulang" type="date" value={formData.returnDate} onChange={(e) => setFormData((p) => ({ ...p, returnDate: e.target.value }))} />
              <Input label="Titik Kumpul" value={formData.meetingPoint} onChange={(e) => setFormData((p) => ({ ...p, meetingPoint: e.target.value }))} />
              <Input label="Maskapai" value={formData.airline} onChange={(e) => setFormData((p) => ({ ...p, airline: e.target.value }))} />
              <Input label="Ketua Kloter" value={formData.leaderName} onChange={(e) => setFormData((p) => ({ ...p, leaderName: e.target.value }))} />
              <Input label="Kuota" type="number" value={String(formData.quota)} onChange={(e) => setFormData((p) => ({ ...p, quota: Number(e.target.value) || 0 }))} />
              <Autocomplete
                label="Status"
                value={formData.status}
                onChange={(value) => setFormData((p) => ({ ...p, status: value as KloterStatus }))}
                options={kloterStatusOptions}
              />
              <Input label="Catatan" value={formData.notes || ''} onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))} />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={() => setFormOpen(false)}>Batal</Button>
            <Button onClick={saveKloter}>{editingItem ? 'Update Kloter' : 'Simpan Kloter'}</Button>
          </ModalFooter>
        </ModalBox>
      </Modal>
    </div>
  );
};

export default KlotersPage;
