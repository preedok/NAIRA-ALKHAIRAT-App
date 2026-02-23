import React, { useState, useEffect } from 'react';
import { AlertTriangle, X, ChevronDown } from 'lucide-react';
import Modal from './common/Modal';
import { publicApi } from '../services/api';

interface Notice {
  id: string;
  title: string;
  message: string;
  type: string;
  starts_at?: string | null;
  ends_at?: string | null;
}

export const MaintenanceBanner: React.FC = () => {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [detailId, setDetailId] = useState<string | null>(null);

  useEffect(() => {
    publicApi.getActiveMaintenance()
      .then((res) => {
        if (!res.data.success) return;
        const d = res.data as { data?: Notice[]; block_app?: boolean; upcoming?: Notice[] };
        setNotices(d.upcoming || []);
      })
      .catch(() => {});
  }, []);

  const visible = notices.filter((n) => !dismissed.has(n.id));
  if (visible.length === 0) return null;

  const bg = (type: string) => {
    if (type === 'error' || type === 'bug') return 'bg-red-100 border-red-300 text-red-900';
    if (type === 'warning') return 'bg-yellow-100 border-yellow-300 text-yellow-900';
    return 'bg-blue-100 border-blue-300 text-blue-900';
  };

  const selected = visible.find((n) => n.id === detailId);

  return (
    <>
      <div className="space-y-2">
        {visible.map((n) => (
          <div
            key={n.id}
            className={`flex items-start gap-3 px-4 py-3 border ${bg(n.type)} rounded-lg cursor-pointer transition-opacity hover:opacity-95`}
            onClick={() => setDetailId(n.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && setDetailId(n.id)}
          >
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold">{n.title}</p>
              <p className="text-sm opacity-90 line-clamp-1">{n.message}</p>
              {n.starts_at && (
                <p className="text-xs mt-1 opacity-75">Pemeliharaan dijadwalkan: {new Date(n.starts_at).toLocaleString('id-ID')}</p>
              )}
              <p className="text-xs mt-0.5 opacity-75">Klik untuk detail</p>
            </div>
            <ChevronDown className="w-4 h-4 flex-shrink-0 mt-1" />
            <button
              onClick={(e) => { e.stopPropagation(); setDismissed((s) => new Set(s).add(n.id)); }}
              className="p-1 rounded hover:bg-black/10"
              aria-label="Tutup"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Modal detail notifikasi */}
      <Modal open={!!selected} onClose={() => setDetailId(null)}>
        {selected && (
          <div className={`max-w-lg w-full rounded-xl shadow-xl border-2 p-6 ${bg(selected.type)}`}>
            <div className="flex justify-between items-start gap-4">
              <h3 className="text-lg font-bold">{selected.title}</h3>
              <button
                onClick={() => setDetailId(null)}
                className="p-1 rounded hover:bg-black/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="mt-3 text-sm whitespace-pre-wrap">{selected.message}</p>
            {(selected.starts_at || selected.ends_at) && (
              <p className="mt-3 text-xs opacity-80">
                {selected.starts_at && `Mulai: ${new Date(selected.starts_at).toLocaleString('id-ID')}`}
                {selected.ends_at && ` — Selesai: ${new Date(selected.ends_at).toLocaleString('id-ID')}`}
              </p>
            )}
          </div>
        )}
      </Modal>
    </>
  );
};

export default MaintenanceBanner;
