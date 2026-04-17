import React, { useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, Eye, MapPin, PlaneLanding, PlaneTakeoff, Search, Ticket } from 'lucide-react';
import Card from '../../../components/common/Card';
import Table from '../../../components/common/Table';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Input from '../../../components/common/Input';
import Autocomplete from '../../../components/common/Autocomplete';
import ActionMenu from '../../../components/common/ActionMenu';
import StatCard from '../../../components/common/StatCard';
import Modal, { ModalBody, ModalBox, ModalFooter, ModalHeader } from '../../../components/common/Modal';
import { SelectOption, TableColumn } from '../../../types';
import { useAuth } from '../../../contexts/AuthContext';

type DepartureStatus = 'scheduled' | 'checkin' | 'departed';

type DepartureItem = {
  id: string;
  orderNo: string;
  jamaahName: string;
  packageName: string;
  departureDate: string;
  departureTime: string;
  originCity: string;
  originAirport: string;
  destination: string;
  returnDate: string;
  returnTime: string;
  returnAirport: string;
  returnFlightNo: string;
  airline: string;
  flightNo: string;
  status: DepartureStatus;
  returnStatus: 'scheduled' | 'returned';
};

const STATUS_MAP: Record<DepartureStatus, { label: string; variant: 'default' | 'warning' | 'success' }> = {
  scheduled: { label: 'Terjadwal', variant: 'default' },
  checkin: { label: 'Check-in', variant: 'warning' },
  departed: { label: 'Berangkat', variant: 'success' }
};

const RETURN_STATUS_MAP: Record<DepartureItem['returnStatus'], { label: string; variant: 'default' | 'success' }> = {
  scheduled: { label: 'Terjadwal', variant: 'default' },
  returned: { label: 'Sudah Pulang', variant: 'success' }
};

const initialDepartures: DepartureItem[] = [
  {
    id: 'DPT-001',
    orderNo: 'ORD-2026-011',
    jamaahName: 'Ahmad Fauzi',
    packageName: 'Umroh Ramadhan Premium',
    departureDate: '2026-08-24',
    departureTime: '10:40',
    originCity: 'Jakarta',
    originAirport: 'CGK - Soekarno Hatta',
    destination: 'Jeddah',
    returnDate: '2026-09-05',
    returnTime: '19:10',
    returnAirport: 'CGK - Soekarno Hatta',
    returnFlightNo: 'SV-822',
    airline: 'Saudi Airlines',
    flightNo: 'SV-823',
    status: 'scheduled',
    returnStatus: 'scheduled'
  },
  {
    id: 'DPT-002',
    orderNo: 'ORD-2026-018',
    jamaahName: 'Siti Rahma',
    packageName: 'Umroh Plus Turki',
    departureDate: '2026-09-10',
    departureTime: '13:25',
    originCity: 'Surabaya',
    originAirport: 'SUB - Juanda',
    destination: 'Istanbul',
    returnDate: '2026-09-24',
    returnTime: '16:45',
    returnAirport: 'SUB - Juanda',
    returnFlightNo: 'TK-056',
    airline: 'Turkish Airlines',
    flightNo: 'TK-057',
    status: 'checkin',
    returnStatus: 'scheduled'
  },
  {
    id: 'DPT-003',
    orderNo: 'ORD-2026-025',
    jamaahName: 'Budi Santoso',
    packageName: 'Umroh Liburan Keluarga',
    departureDate: '2026-12-18',
    departureTime: '07:15',
    originCity: 'Makassar',
    originAirport: 'UPG - Sultan Hasanuddin',
    destination: 'Madinah',
    returnDate: '2026-12-29',
    returnTime: '21:00',
    returnAirport: 'UPG - Sultan Hasanuddin',
    returnFlightNo: 'QR-974',
    airline: 'Qatar Airways',
    flightNo: 'QR-975',
    status: 'scheduled',
    returnStatus: 'scheduled'
  },
  {
    id: 'DPT-004',
    orderNo: 'ORD-2026-028',
    jamaahName: 'Maya Fitri',
    packageName: 'Umroh Awal Musim',
    departureDate: '2026-10-05',
    departureTime: '09:55',
    originCity: 'Medan',
    originAirport: 'KNO - Kualanamu',
    destination: 'Jeddah',
    returnDate: '2026-10-16',
    returnTime: '20:20',
    returnAirport: 'KNO - Kualanamu',
    returnFlightNo: 'GA-981',
    airline: 'Garuda Indonesia',
    flightNo: 'GA-980',
    status: 'departed',
    returnStatus: 'returned'
  },
  {
    id: 'DPT-005',
    orderNo: 'ORD-2026-033',
    jamaahName: 'Rina Wulandari',
    packageName: 'Umroh Plus Turki',
    departureDate: '2026-09-10',
    departureTime: '15:20',
    originCity: 'Balikpapan',
    originAirport: 'BPN - Sultan Aji Muhammad',
    destination: 'Istanbul',
    returnDate: '2026-09-24',
    returnTime: '18:10',
    returnAirport: 'BPN - Sultan Aji Muhammad',
    returnFlightNo: 'TK-058',
    airline: 'Turkish Airlines',
    flightNo: 'TK-059',
    status: 'scheduled',
    returnStatus: 'scheduled'
  }
];

const columns: TableColumn[] = [
  { id: 'jamaah', label: 'Jamaah' },
  { id: 'order', label: 'Order & Paket' },
  { id: 'departure', label: 'Keberangkatan' },
  { id: 'return', label: 'Kepulangan' },
  { id: 'airport', label: 'Bandara Asal' },
  { id: 'departureStatus', label: 'Status Pergi', align: 'center' },
  { id: 'returnStatus', label: 'Status Pulang', align: 'center' },
  { id: 'action', label: 'Aksi', align: 'right' }
];

const DeparturesPage: React.FC = () => {
  const { user } = useAuth();
  const isReadOnly = user?.role === 'jamaah';
  const [rows, setRows] = useState<DepartureItem[]>(initialDepartures);
  const [query, setQuery] = useState('');
  const [packageFilter, setPackageFilter] = useState<'all' | string>('all');
  const [airportFilter, setAirportFilter] = useState<'all' | string>('all');
  const [detail, setDetail] = useState<DepartureItem | null>(null);
  const scopedRows = useMemo(() => {
    if (!isReadOnly) return rows;
    const currentUserName = (user?.name || '').trim().toLowerCase();
    if (!currentUserName) return [];
    return rows.filter((item) => item.jamaahName.trim().toLowerCase() === currentUserName);
  }, [rows, isReadOnly, user?.name]);
  const packageOptions = useMemo(() => Array.from(new Set(scopedRows.map((x) => x.packageName))).sort((a, b) => a.localeCompare(b)), [scopedRows]);
  const airportOptions = useMemo(() => Array.from(new Set(scopedRows.map((x) => x.originAirport))).sort((a, b) => a.localeCompare(b)), [scopedRows]);
  const packageSelectOptions: SelectOption[] = packageOptions.map((label) => ({ value: label, label }));
  const airportSelectOptions: SelectOption[] = airportOptions.map((label) => ({ value: label, label }));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return scopedRows.filter((item) => {
      const queryMatch =
        q.length === 0 ||
        item.jamaahName.toLowerCase().includes(q) ||
        item.orderNo.toLowerCase().includes(q) ||
        item.originCity.toLowerCase().includes(q) ||
        item.originAirport.toLowerCase().includes(q);
      const packageMatch = packageFilter === 'all' || item.packageName === packageFilter;
      const airportMatch = airportFilter === 'all' || item.originAirport === airportFilter;
      return queryMatch && packageMatch && airportMatch;
    });
  }, [scopedRows, query, packageFilter, airportFilter]);

  const stats = useMemo(() => {
    const total = scopedRows.length;
    const thisMonth = scopedRows.filter((x) => x.departureDate.slice(0, 7) === '2026-09').length;
    const activeAirports = new Set(scopedRows.map((x) => x.originAirport)).size;
    const departed = scopedRows.filter((x) => x.status === 'departed').length;
    const returned = scopedRows.filter((x) => x.returnStatus === 'returned').length;
    return { total, thisMonth, activeAirports, departed, returned };
  }, [scopedRows]);

  const markDeparted = (id: string) => {
    setRows((prev) => prev.map((item) => (item.id === id ? { ...item, status: 'departed' } : item)));
  };

  const markReturned = (id: string) => {
    setRows((prev) => prev.map((item) => (item.id === id ? { ...item, returnStatus: 'returned' } : item)));
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Total Jadwal Jamaah" value={stats.total} />
        <StatCard label="Keberangkatan Bulan Ini" value={stats.thisMonth} accentClassName="text-[#8f6828]" />
        <StatCard label="Bandara Asal Aktif" value={stats.activeAirports} />
        <StatCard label="Sudah Berangkat" value={stats.departed} accentClassName="text-emerald-600" />
        <StatCard label="Sudah Pulang" value={stats.returned} accentClassName="text-sky-600" />
      </div>

      <Card>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
          <Input
            ariaLabel="Cari keberangkatan jamaah"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            icon={<Search className="w-4 h-4" />}
            placeholder="Cari jamaah, order, kota, bandara"
          />
          <Autocomplete
            value={packageFilter === 'all' ? '' : packageFilter}
            onChange={(value) => setPackageFilter(value || 'all')}
            options={packageSelectOptions}
            emptyLabel="Semua paket"
          />
          <Autocomplete
            value={airportFilter === 'all' ? '' : airportFilter}
            onChange={(value) => setAirportFilter(value || 'all')}
            options={airportSelectOptions}
            emptyLabel="Semua bandara asal"
          />
          <div className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-600 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-slate-400" />
            Keberangkatan: seluruh Indonesia
          </div>
        </div>
      </Card>

      <Card padding="none">
        <Table
          columns={columns}
          data={filtered}
          stickyActionsColumn
          emptyMessage="Belum ada jadwal keberangkatan"
          emptyDescription="Data muncul setelah order paket ditetapkan ke jadwal keberangkatan."
          renderRow={(item) => (
            <tr key={item.id} className="hover:bg-slate-50">
              <td className="px-4 py-3">
                <p className="font-semibold text-slate-800">{item.jamaahName}</p>
                <p className="text-xs text-slate-500">{item.id}</p>
              </td>
              <td className="px-4 py-3">
                <p className="font-semibold text-slate-700">{item.orderNo}</p>
                <p className="text-xs text-slate-500">{item.packageName}</p>
              </td>
              <td className="px-4 py-3">
                <ul className="space-y-1.5">
                  <li className="text-sm text-slate-700 flex items-center gap-1.5">
                    <CalendarDays className="w-4 h-4 text-slate-400" />
                    {new Date(item.departureDate).toLocaleDateString('id-ID')} • {item.departureTime}
                  </li>
                  <li className="text-xs text-slate-500 flex items-center gap-1.5">
                    <PlaneTakeoff className="w-3.5 h-3.5" />
                    {item.airline} ({item.flightNo}) ke {item.destination}
                  </li>
                </ul>
              </td>
              <td className="px-4 py-3">
                <ul className="space-y-1.5">
                  <li className="text-sm text-slate-700 flex items-center gap-1.5">
                    <CalendarDays className="w-4 h-4 text-slate-400" />
                    {new Date(item.returnDate).toLocaleDateString('id-ID')} • {item.returnTime}
                  </li>
                  <li className="text-xs text-slate-500 flex items-center gap-1.5">
                    <PlaneLanding className="w-3.5 h-3.5" />
                    {item.airline} ({item.returnFlightNo}) ke {item.returnAirport}
                  </li>
                </ul>
              </td>
              <td className="px-4 py-3">
                <p className="font-semibold text-slate-700">{item.originCity}</p>
                <p className="text-xs text-slate-500">{item.originAirport}</p>
              </td>
              <td className="px-4 py-3 text-center">
                <Badge variant={STATUS_MAP[item.status].variant} size="sm">{STATUS_MAP[item.status].label}</Badge>
              </td>
              <td className="px-4 py-3 text-center">
                <Badge variant={RETURN_STATUS_MAP[item.returnStatus].variant} size="sm">{RETURN_STATUS_MAP[item.returnStatus].label}</Badge>
              </td>
              <td className="px-4 py-3">
                <div className="relative flex items-center justify-end">
                  <ActionMenu
                    menuWidthClass="w-[190px]"
                    items={[
                      { id: 'detail', label: 'Detail Keberangkatan', icon: <Eye className="w-4 h-4" />, onClick: () => setDetail(item) },
                      ...(!isReadOnly && item.status !== 'departed'
                        ? [{
                            id: 'mark-departed',
                            label: 'Tandai Sudah Berangkat',
                            icon: <PlaneTakeoff className="w-4 h-4" />,
                            tone: 'success' as const,
                            onClick: () => markDeparted(item.id)
                          }]
                        : []),
                      ...(!isReadOnly && item.returnStatus !== 'returned'
                        ? [{
                            id: 'mark-returned',
                            label: 'Tandai Sudah Pulang',
                            icon: <PlaneLanding className="w-4 h-4" />,
                            tone: 'info' as const,
                            onClick: () => markReturned(item.id)
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

      <Modal open={!!detail} onClose={() => setDetail(null)}>
        <ModalBox className="max-w-2xl min-h-0">
          <ModalHeader title="Detail Keberangkatan Jamaah" subtitle={detail?.orderNo} onClose={() => setDetail(null)} icon={<Ticket className="w-5 h-5" />} />
          <ModalBody>
            {detail && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div><p className="text-slate-500">Nama Jamaah</p><p className="font-semibold">{detail.jamaahName}</p></div>
                  <div><p className="text-slate-500">Order Paket</p><p className="font-semibold">{detail.orderNo}</p></div>
                  <div><p className="text-slate-500">Paket</p><p className="font-semibold">{detail.packageName}</p></div>
                  <div><p className="text-slate-500">Status</p><Badge variant={STATUS_MAP[detail.status].variant} size="sm">{STATUS_MAP[detail.status].label}</Badge></div>
                  <div><p className="text-slate-500">Tanggal Berangkat</p><p className="font-semibold">{new Date(detail.departureDate).toLocaleDateString('id-ID')} • {detail.departureTime}</p></div>
                  <div><p className="text-slate-500">Bandara Asal</p><p className="font-semibold">{detail.originAirport}</p></div>
                  <div><p className="text-slate-500">Maskapai</p><p className="font-semibold">{detail.airline}</p></div>
                  <div><p className="text-slate-500">No Flight</p><p className="font-semibold">{detail.flightNo}</p></div>
                  <div><p className="text-slate-500">Tanggal Pulang</p><p className="font-semibold">{new Date(detail.returnDate).toLocaleDateString('id-ID')} • {detail.returnTime}</p></div>
                  <div><p className="text-slate-500">Bandara Kepulangan</p><p className="font-semibold">{detail.returnAirport}</p></div>
                  <div><p className="text-slate-500">Flight Kepulangan</p><p className="font-semibold">{detail.returnFlightNo}</p></div>
                  <div><p className="text-slate-500">Status Pulang</p><Badge variant={RETURN_STATUS_MAP[detail.returnStatus].variant} size="sm">{RETURN_STATUS_MAP[detail.returnStatus].label}</Badge></div>
                </div>
                <Card className="bg-slate-50 border-slate-200">
                  <p className="text-sm text-slate-600 inline-flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Rute: {detail.originCity} ({detail.originAirport.split(' - ')[0]}) - {detail.destination}
                  </p>
                </Card>
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={() => setDetail(null)}>Tutup</Button>
            {!isReadOnly && detail?.status !== 'departed' && (
              <Button
                onClick={() => {
                  if (detail) markDeparted(detail.id);
                  setDetail(null);
                }}
                icon={<CheckCircle2 className="w-4 h-4" />}
              >
                Konfirmasi Berangkat
              </Button>
            )}
            {!isReadOnly && detail?.returnStatus !== 'returned' && (
              <Button
                variant="outline"
                onClick={() => {
                  if (detail) markReturned(detail.id);
                  setDetail(null);
                }}
                icon={<PlaneLanding className="w-4 h-4" />}
              >
                Konfirmasi Pulang
              </Button>
            )}
          </ModalFooter>
        </ModalBox>
      </Modal>
    </div>
  );
};

export default DeparturesPage;
