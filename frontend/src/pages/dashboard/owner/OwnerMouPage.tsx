import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Download, ExternalLink, X } from 'lucide-react';
import Button from '../../../components/common/Button';
import { ownersApi, type OwnerProfile } from '../../../services/api';
import { API_BASE_URL } from '../../../utils/constants';
import { useAuth } from '../../../contexts/AuthContext';

const UPLOAD_BASE = (API_BASE_URL || '').replace(/\/api\/v1\/?$/, '') || (typeof window !== 'undefined' ? window.location.origin : '');

const formatDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';

const OwnerMouPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<OwnerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    ownersApi
      .getMe()
      .then((res) => {
        if (!cancelled && res.data?.success && res.data?.data) setProfile(res.data.data);
      })
      .catch(() => {
        if (!cancelled) setError('Gagal memuat data profil');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-slate-600">Memuat informasi MoU...</p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-red-700">
        {error || 'Profil tidak ditemukan'}
      </div>
    );
  }

  const mouUrl = profile.mou_generated_url
    ? `${(UPLOAD_BASE || '').replace(/\/$/, '')}${profile.mou_generated_url.startsWith('/') ? '' : '/'}${profile.mou_generated_url}`
    : '';

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-white">
      {/* Header: judul + info ringkas + aksi */}
      <div className="flex-shrink-0 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button type="button" onClick={() => navigate('/dashboard')} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 shrink-0" title="Kembali">
              <X className="w-5 h-5" />
            </button>
            <FileText className="w-7 h-7 text-primary-600 shrink-0" />
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-stone-900 truncate">Surat MoU Saya</h1>
              <p className="text-xs text-slate-500 truncate">
                {user?.email ?? profile.User?.email ?? '—'}
                {profile.AssignedBranch && ` · ${profile.AssignedBranch.code} – ${profile.AssignedBranch.name}`}
              </p>
            </div>
          </div>
          {mouUrl && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => window.open(mouUrl, '_blank')}
                className="gap-1.5"
              >
                <ExternalLink className="w-4 h-4" />
                Buka di tab baru
              </Button>
              <a
                href={mouUrl}
                download
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-stone-300 bg-white text-stone-700 hover:bg-stone-50 text-sm font-medium"
              >
                <Download className="w-4 h-4" />
                Unduh PDF
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Area konten full screen */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {mouUrl ? (
          <iframe
            title="Surat MoU"
            src={mouUrl}
            className="w-full h-full min-h-0 border-0"
          />
        ) : (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center max-w-md">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-600">Surat MoU belum tersedia. Setelah akun Anda diaktivasi oleh Admin Pusat, surat MoU akan muncul di sini dan dikirim ke email Anda.</p>
              <p className="text-sm text-slate-500 mt-2">Email: {user?.email ?? '—'} · Aktivasi: {formatDate(profile.activated_at)}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OwnerMouPage;
