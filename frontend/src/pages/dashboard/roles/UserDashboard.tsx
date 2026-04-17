import React from 'react';
import { CalendarClock, CircleCheck, Clock3, CreditCard, FileBadge2, PlaneTakeoff, Receipt, Wallet, Package } from 'lucide-react';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import { useAuth } from '../../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const paymentTimeline = [
  { label: 'DP Paket', status: 'done', date: '12 Jan 2026', amount: 'Rp 5.000.000' },
  { label: 'Cicilan #1', status: 'done', date: '12 Feb 2026', amount: 'Rp 3.000.000' },
  { label: 'Cicilan #2', status: 'upcoming', date: '12 Mei 2026', amount: 'Rp 3.000.000' },
  { label: 'Pelunasan', status: 'upcoming', date: '15 Jul 2026', amount: 'Rp 6.500.000' }
];

const travelChecklist = [
  { item: 'Paspor valid > 8 bulan', done: true },
  { item: 'Foto visa latar putih', done: true },
  { item: 'Sertifikat vaksin meningitis', done: false },
  { item: 'Konfirmasi mahram / keluarga', done: false }
];

const UserDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const completedChecklist = travelChecklist.filter((item) => item.done).length;
  const checklistPercent = Math.round((completedChecklist / travelChecklist.length) * 100);

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-stone-500">Dashboard Jamaah</p>
            <h1 className="text-2xl font-bold text-stone-900 mt-1">
              Assalamu&apos;alaikum, {user?.name ?? 'Sahabat Umroh'}
            </h1>
            <p className="mt-2 text-sm text-stone-500">
              Lacak progres keberangkatan, pembayaran, dan dokumen ibadah Anda secara real-time.
            </p>
          </div>
          <div className="rounded-xl bg-primary-50 px-3 py-2 text-sm text-primary-700 border border-primary-100">
            Estimasi berangkat: <span className="font-semibold">24 Agustus 2026</span>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card hover>
          <div className="flex items-center justify-between">
            <p className="text-sm text-stone-500">Status Pembayaran</p>
            <CreditCard className="h-5 w-5 text-primary-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-stone-900">63%</p>
          <p className="mt-1 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-full px-2 py-1 inline-block">
            Cicilan berikutnya 12 Mei 2026
          </p>
        </Card>

        <Card hover>
          <div className="flex items-center justify-between">
            <p className="text-sm text-stone-500">Dokumen Lengkap</p>
            <FileBadge2 className="h-5 w-5 text-primary-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-stone-900">{completedChecklist}/{travelChecklist.length}</p>
          <p className="mt-1 text-xs text-stone-500">Perlu lengkapi {travelChecklist.length - completedChecklist} dokumen lagi.</p>
        </Card>

        <Card hover>
          <div className="flex items-center justify-between">
            <p className="text-sm text-stone-500">Paket Aktif</p>
            <PlaneTakeoff className="h-5 w-5 text-primary-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-stone-900">Umroh Plus Turki</p>
          <p className="mt-1 text-xs text-stone-500">Durasi 12 hari · Hotel bintang 5</p>
        </Card>

        <Card hover>
          <div className="flex items-center justify-between">
            <p className="text-sm text-stone-500">Agenda Terdekat</p>
            <CalendarClock className="h-5 w-5 text-primary-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-stone-900">Manasik #2</p>
          <p className="mt-1 text-xs text-stone-500">Minggu, 18 Mei 2026 · 09:00 WIB</p>
        </Card>
      </div>

      <Card>
        <h2 className="text-base font-semibold text-stone-900">Fitur Jamaah</h2>
        <p className="text-sm text-stone-500 mt-1">Akses cepat ke fitur utama untuk memantau perjalanan ibadah Anda.</p>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <Button variant="outline" icon={<Receipt className="w-4 h-4" />} onClick={() => navigate('/dashboard/orders-invoices')} className="justify-start">
            Invoice Saya
          </Button>
          <Button variant="outline" icon={<Wallet className="w-4 h-4" />} onClick={() => navigate('/dashboard/installments')} className="justify-start">
            Cicilan Saya
          </Button>
          <Button variant="outline" icon={<PlaneTakeoff className="w-4 h-4" />} onClick={() => navigate('/dashboard/kloters')} className="justify-start">
            Keberangkatan Saya
          </Button>
          <Button variant="outline" icon={<Package className="w-4 h-4" />} onClick={() => navigate('/dashboard/packages')} className="justify-start">
            Paket Umroh
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <h2 className="text-base font-semibold text-stone-900">Timeline Pembayaran</h2>
          <div className="mt-4 space-y-3">
            {paymentTimeline.map((step) => (
              <div key={step.label} className="flex items-start gap-3 rounded-xl border border-stone-100 p-3">
                <div className={`mt-0.5 ${step.status === 'done' ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {step.status === 'done' ? <CircleCheck className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-stone-900">{step.label}</p>
                    <span className="text-xs text-stone-500">{step.date}</span>
                  </div>
                  <p className="text-sm text-stone-600 mt-0.5">{step.amount}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="text-base font-semibold text-stone-900">Checklist Keberangkatan</h2>
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-stone-600">Progress</span>
              <span className="font-semibold text-primary-700">{checklistPercent}%</span>
            </div>
            <div className="h-2 rounded-full bg-stone-100 overflow-hidden mb-4">
              <div className="h-full rounded-full bg-primary-600" style={{ width: `${checklistPercent}%` }} />
            </div>
            <ul className="space-y-2">
              {travelChecklist.map((check) => (
                <li key={check.item} className="flex items-start gap-2 text-sm">
                  <CircleCheck className={`mt-0.5 h-4 w-4 shrink-0 ${check.done ? 'text-emerald-600' : 'text-stone-300'}`} />
                  <span className={check.done ? 'text-stone-700' : 'text-stone-500'}>{check.item}</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default UserDashboard;
