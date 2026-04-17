import React from 'react';
import {
  ArrowUpRight,
  Users,
  Receipt,
  CircleDollarSign,
  PlaneTakeoff,
  AlertTriangle
} from 'lucide-react';
import Card from '../../../components/common/Card';
import { useAuth } from '../../../contexts/AuthContext';

type StatItem = {
  label: string;
  value: string;
  delta: string;
  good?: boolean;
  icon: React.ComponentType<{ className?: string }>;
};

const topStats: StatItem[] = [
  { label: 'Total Jamaah Aktif', value: '1,284', delta: '+9.2%', good: true, icon: Users },
  { label: 'Invoice Terbayar', value: '926', delta: '+6.8%', good: true, icon: Receipt },
  { label: 'Omzet Bulan Ini', value: 'Rp 4.82 M', delta: '+12.4%', good: true, icon: CircleDollarSign },
  { label: 'Kloter Berangkat', value: '18', delta: '+2 kloter', good: true, icon: PlaneTakeoff }
];

const weeklyPerformance = [
  { day: 'Sen', orders: 42 },
  { day: 'Sel', orders: 55 },
  { day: 'Rab', orders: 61 },
  { day: 'Kam', orders: 58 },
  { day: 'Jum', orders: 76 },
  { day: 'Sab', orders: 63 },
  { day: 'Min', orders: 50 }
];

const paymentProgress = [
  { branch: 'Jakarta', paid: 82 },
  { branch: 'Bandung', paid: 74 },
  { branch: 'Surabaya', paid: 69 },
  { branch: 'Makassar', paid: 88 }
];

const priorityAlerts = [
  '12 jamaah belum upload dokumen visa (deadline < 3 hari).',
  '5 invoice cicilan terlambat > 7 hari.',
  '2 kloter perlu konfirmasi hotel sebelum H-10.'
];

const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const highestDay = weeklyPerformance.reduce((best, cur) => (cur.orders > best.orders ? cur : best), weeklyPerformance[0]);
  const maxBar = Math.max(...weeklyPerformance.map((item) => item.orders));

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-stone-500">Ringkasan Operasional</p>
            <h1 className="text-2xl font-bold text-stone-900 mt-1">
              Selamat datang, {user?.name ?? 'Admin'}
            </h1>
            <p className="text-sm text-stone-500 mt-2">
              Pantau performa cabang, pembayaran, dan kesiapan keberangkatan dalam satu layar.
            </p>
          </div>
          <div className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700 border border-emerald-100">
            Peak order pekan ini: <span className="font-semibold">{highestDay.day}</span> ({highestDay.orders} order)
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {topStats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} hover>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-stone-500">{stat.label}</p>
                  <p className="text-2xl font-bold text-stone-900 mt-1">{stat.value}</p>
                </div>
                <div className="rounded-lg bg-primary-50 p-2 text-primary-600">
                  <Icon className="h-5 w-5" />
                </div>
              </div>
              <div className={`mt-3 inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${stat.good ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                <ArrowUpRight className="h-3.5 w-3.5" />
                {stat.delta} vs bulan lalu
              </div>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-stone-900">Tren Order 7 Hari</h2>
            <span className="text-xs text-stone-500">Update tiap 30 menit</span>
          </div>
          <div className="mt-5 grid grid-cols-7 gap-2">
            {weeklyPerformance.map((item) => (
              <div key={item.day} className="flex flex-col items-center gap-2">
                <div className="h-32 w-full rounded-lg bg-stone-100 p-1 flex items-end">
                  <div
                    className="w-full rounded-md bg-gradient-to-t from-primary-600 to-primary-400"
                    style={{ height: `${Math.max(10, Math.round((item.orders / maxBar) * 100))}%` }}
                  />
                </div>
                <span className="text-xs text-stone-500">{item.day}</span>
                <span className="text-xs font-semibold text-stone-700">{item.orders}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="text-base font-semibold text-stone-900">Alert Prioritas</h2>
          <ul className="mt-4 space-y-3">
            {priorityAlerts.map((alert) => (
              <li key={alert} className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-100 p-3">
                <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-600 shrink-0" />
                <span className="text-sm text-amber-800">{alert}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-stone-900">Progress Pembayaran Per Cabang</h2>
          <span className="text-xs text-stone-500">Target minimal 75%</span>
        </div>
        <div className="mt-4 space-y-4">
          {paymentProgress.map((item) => (
            <div key={item.branch}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="text-stone-700 font-medium">{item.branch}</span>
                <span className={`font-semibold ${item.paid >= 75 ? 'text-emerald-600' : 'text-amber-600'}`}>{item.paid}%</span>
              </div>
              <div className="h-2 rounded-full bg-stone-100 overflow-hidden">
                <div
                  className={`h-full rounded-full ${item.paid >= 75 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                  style={{ width: `${item.paid}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default AdminDashboard;
