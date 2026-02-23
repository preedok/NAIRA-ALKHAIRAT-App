import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { publicApi } from '../services/api';

interface Notice {
  id: string;
  title: string;
  message: string;
  type: string;
  starts_at?: string | null;
  ends_at?: string | null;
}

/**
 * Jika maintenance block aktif (block_app), semua role kecuali super_admin hanya melihat halaman maintenance full-screen.
 * Super Admin tetap bisa akses aplikasi.
 */
const MaintenanceGate: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [blockApp, setBlockApp] = useState(false);
  const [notices, setNotices] = useState<Notice[]>([]);

  useEffect(() => {
    if (user?.role === 'super_admin') {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const fetchBlockStatus = () => {
      publicApi
        .getActiveMaintenance()
        .then((res) => {
          if (cancelled) return;
          const data = res.data as { success?: boolean; data?: Notice[]; block_app?: boolean };
          if (data.success) {
            setBlockApp(data.block_app === true);
            setNotices(Array.isArray(data.data) ? data.data : []);
          }
        })
        .catch(() => {})
        .finally(() => { if (!cancelled) setLoading(false); });
    };
    setLoading(true);
    fetchBlockStatus();
    const t = setInterval(fetchBlockStatus, 15000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [user?.role]);

  if (user?.role === 'super_admin') {
    return <Outlet />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <Loader2 className="w-12 h-12 text-emerald-600 animate-spin mb-4" />
        <p className="text-slate-600">Memuat...</p>
      </div>
    );
  }

  if (!blockApp) {
    return <Outlet />;
  }

  const primary = notices[0];
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white p-6">
      <div className="max-w-lg w-full rounded-2xl border border-slate-100 p-8 text-center bg-white shadow-sm">
        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="w-8 h-8 text-amber-600" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">
          Aplikasi Sedang Dalam Pemeliharaan
        </h1>
        <p className="text-slate-600 mb-6">
          Sementara ini aplikasi tidak dapat diakses. Silakan coba lagi nanti.
        </p>
        {primary && (
          <div className="text-left bg-slate-50 rounded-xl p-4 border border-slate-200">
            <p className="font-semibold text-slate-900">{primary.title}</p>
            <p className="text-sm text-slate-600 mt-2 whitespace-pre-wrap">{primary.message}</p>
            {(primary.starts_at || primary.ends_at) && (
              <p className="text-xs text-slate-500 mt-3">
                {primary.starts_at && `Mulai: ${new Date(primary.starts_at).toLocaleString('id-ID')}`}
                {primary.ends_at && ` — Selesai: ${new Date(primary.ends_at).toLocaleString('id-ID')}`}
              </p>
            )}
          </div>
        )}
        {notices.length > 1 && (
          <p className="text-xs text-slate-500 mt-4">+ {notices.length - 1} pemberitahuan lainnya</p>
        )}
      </div>
    </div>
  );
};

export default MaintenanceGate;
