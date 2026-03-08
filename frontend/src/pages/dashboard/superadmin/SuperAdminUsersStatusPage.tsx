import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Users, Circle, CircleOff, Activity, Radio } from 'lucide-react';
import {
  Card,
  PageHeader,
  AutoRefreshControl,
  Badge,
  Table,
  StatCard,
  CardSectionHeader,
  Input
} from '../../../components/common';
import ContentLoading from '../../../components/common/ContentLoading';
import { superAdminApi, branchesApi } from '../../../services/api';
import { ROLE_NAMES } from '../../../types';

const REFRESH_INTERVAL_MS = 5000;

function formatDateTime(iso: string | null): string {
  if (!iso) return '–';
  const d = new Date(iso);
  return d.toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' });
}

type UserStatusItem = {
  id: string;
  name: string;
  email: string;
  role: string;
  branch_id: string | null;
  is_active: boolean;
  last_login_at: string | null;
  last_activity_at: string | null;
  is_online: boolean;
  created_at: string | null;
};

export const SuperAdminUsersStatusPage: React.FC = () => {
  const [list, setList] = useState<UserStatusItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterBranch, setFilterBranch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([]);

  const fetchBranches = useCallback(() => {
    branchesApi.list().then((r) => {
      if (r.data.success && Array.isArray(r.data.data)) {
        setBranches(r.data.data.map((b: { id: string; name: string }) => ({ id: b.id, name: b.name })));
      }
    }).catch(() => {});
  }, []);

  const fetchUsers = useCallback((showLoading = true) => {
    if (showLoading) setLoading(true);
    const params: { branch_id?: string; role?: string } = {};
    if (filterBranch) params.branch_id = filterBranch;
    if (filterRole) params.role = filterRole;
    superAdminApi.getUsersStatus(params)
      .then((res) => {
        if (res.data.success && Array.isArray(res.data.data)) {
          setList(res.data.data as UserStatusItem[]);
        } else {
          setList([]);
        }
      })
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, [filterBranch, filterRole]);

  useEffect(() => { fetchBranches(); }, [fetchBranches]);
  useEffect(() => { fetchUsers(); }, [fetchUsers]);
  useEffect(() => {
    const id = setInterval(() => fetchUsers(false), REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchUsers]);

  const filteredList = useMemo(() => {
    if (!searchQuery.trim()) return list;
    const q = searchQuery.trim().toLowerCase();
    return list.filter(
      (u) =>
        (u.name || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q)
    );
  }, [list, searchQuery]);

  const total = list.length;
  const activeCount = list.filter((u) => u.is_active).length;
  const onlineCount = list.filter((u) => u.is_online).length;

  const columns = [
    { id: 'name', label: 'Nama', align: 'left' as const },
    { id: 'email', label: 'Email', align: 'left' as const },
    { id: 'role', label: 'Role', align: 'left' as const },
    { id: 'is_active', label: 'Aktif', align: 'center' as const },
    { id: 'is_online', label: 'Online', align: 'center' as const },
    { id: 'last_activity_at', label: 'Terakhir Aktif', align: 'left' as const },
    { id: 'last_login_at', label: 'Terakhir Login', align: 'left' as const }
  ];

  const renderUserRow = (u: UserStatusItem) => (
    <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
      <td className="py-3 px-4"><span className="font-medium text-slate-800">{u.name}</span></td>
      <td className="py-3 px-4 text-slate-600">{u.email}</td>
      <td className="py-3 px-4 text-slate-700">{ROLE_NAMES[u.role as keyof typeof ROLE_NAMES] || u.role}</td>
      <td className="py-3 px-4 text-center">
        {u.is_active ? (
          <Badge variant="success" className="gap-1"><Circle className="w-3 h-3" /> Aktif</Badge>
        ) : (
          <Badge variant="default" className="gap-1"><CircleOff className="w-3 h-3" /> Nonaktif</Badge>
        )}
      </td>
      <td className="py-3 px-4 text-center">
        {u.is_online ? (
          <Badge variant="success" className="gap-1 bg-emerald-100 text-emerald-800 border-emerald-200"><Radio className="w-3 h-3" /> Online</Badge>
        ) : (
          <Badge variant="default" className="gap-1 text-slate-500">Offline</Badge>
        )}
      </td>
      <td className={`py-3 px-4 ${u.is_online ? 'text-emerald-600 font-medium' : 'text-slate-500'}`}>
        {formatDateTime(u.last_activity_at || u.last_login_at)}
      </td>
      <td className="py-3 px-4 text-slate-600">{formatDateTime(u.last_login_at)}</td>
    </tr>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Monitor User (Realtime)"
        subtitle="Lihat user aktif/nonaktif dan siapa yang sedang online. Data diperbarui otomatis setiap 5 detik."
      />

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={<Users className="w-5 h-5" />}
          label="Total User"
          value={total}
          subtitle="Semua akun terdaftar"
          iconClassName="bg-slate-100 text-slate-600"
        />
        <StatCard
          icon={<Circle className="w-5 h-5" />}
          label="Aktif"
          value={activeCount}
          subtitle="Akun aktif (bukan nonaktif)"
          iconClassName="bg-blue-100 text-blue-600"
        />
        <StatCard
          icon={<Activity className="w-5 h-5" />}
          label="Online"
          value={onlineCount}
          subtitle="Aktivitas dalam 5 menit terakhir"
          iconClassName="bg-emerald-100 text-emerald-600"
        />
      </div>

      <Card className="rounded-xl border-slate-200/80 shadow-sm overflow-hidden">
        <CardSectionHeader
          icon={<Users className="w-5 h-5" />}
          title="Daftar User"
          subtitle="Filter menurut cabang, role, dan cari nama/email. Status online mengikuti heartbeat (aktivitas) dalam 5 menit."
          className="p-4 border-b border-slate-100"
        />
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <Input
                label="Cari"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Nama atau email..."
                className="max-w-xs"
              />
              <select
                value={filterBranch}
                onChange={(e) => setFilterBranch(e.target.value)}
                className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white min-w-[160px] focus:ring-2 focus:ring-[#0D1A63]/20 focus:border-[#0D1A63]"
              >
                <option value="">Semua cabang</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white min-w-[160px] focus:ring-2 focus:ring-[#0D1A63]/20 focus:border-[#0D1A63]"
              >
                <option value="">Semua role</option>
                {Object.entries(ROLE_NAMES).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="default" className="text-emerald-600 border border-emerald-200 bg-emerald-50">
                Live · 5 detik
              </Badge>
              <AutoRefreshControl onRefresh={() => fetchUsers()} disabled={loading} size="sm" />
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          {loading && list.length === 0 ? (
            <ContentLoading />
          ) : (
            <Table<UserStatusItem>
              columns={columns}
              data={filteredList}
              renderRow={(u) => renderUserRow(u)}
              emptyMessage={searchQuery.trim() ? 'Tidak ada user sesuai pencarian' : 'Belum ada user'}
            />
          )}
        </div>
        {list.length > 0 && (
          <div className="p-3 border-t border-slate-100 text-sm text-slate-500 flex flex-wrap items-center justify-between gap-2">
            <span>Menampilkan {filteredList.length} dari {list.length} user</span>
            <span>Online = aktivitas (heartbeat) dalam 5 menit terakhir</span>
          </div>
        )}
      </Card>
    </div>
  );
};

export default SuperAdminUsersStatusPage;
