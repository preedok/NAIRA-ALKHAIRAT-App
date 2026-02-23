import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import Button from './Button';

const STORAGE_PREFIX = 'autoRefresh_';
const INTERVAL_OPTIONS = [10, 30, 60, 120] as const;

export interface AutoRefreshControlProps {
  /** Dipanggil setiap interval (saat auto refresh) atau saat klik Refresh */
  onRefresh: () => void;
  /** Key untuk simpan preferensi di localStorage (default: pathname) */
  storageKey?: string;
  /** Nonaktifkan kontrol (mis. saat loading) */
  disabled?: boolean;
  /** Ukuran tampilan: compact (inline) atau default */
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Kontrol auto refresh: toggle, pilih interval (detik), dan tombol refresh sekarang.
 * Preferensi (enabled + interval) disimpan per storageKey (default pathname) untuk semua role.
 */
const AutoRefreshControl: React.FC<AutoRefreshControlProps> = ({
  onRefresh,
  storageKey: propStorageKey,
  disabled = false,
  size = 'md',
  className = ''
}) => {
  const location = useLocation();
  const key = propStorageKey ?? (location.pathname || 'default');
  const enabledKey = `${STORAGE_PREFIX}enabled_${key}`;
  const intervalKey = `${STORAGE_PREFIX}interval_${key}`;

  const [enabled, setEnabled] = useState(() => {
    try {
      const v = localStorage.getItem(enabledKey);
      return v === 'true';
    } catch {
      return false;
    }
  });
  const [intervalSeconds, setIntervalSeconds] = useState(() => {
    try {
      const v = localStorage.getItem(intervalKey);
      const n = v ? parseInt(v, 10) : 30;
      return INTERVAL_OPTIONS.includes(n as typeof INTERVAL_OPTIONS[number]) ? n : 30;
    } catch {
      return 30;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(enabledKey, String(enabled));
    } catch {}
  }, [enabled, enabledKey]);

  useEffect(() => {
    try {
      localStorage.setItem(intervalKey, String(intervalSeconds));
    } catch {}
  }, [intervalSeconds, intervalKey]);

  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;
  useEffect(() => {
    if (!enabled || disabled) return;
    const ms = intervalSeconds * 1000;
    const id = setInterval(() => onRefreshRef.current(), ms);
    return () => clearInterval(id);
  }, [enabled, intervalSeconds, disabled]);

  const refreshNow = useCallback(() => {
    onRefresh();
  }, [onRefresh]);

  const isSm = size === 'sm';
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <label className="flex items-center gap-1.5 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          disabled={disabled}
          className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
        />
        <span className={isSm ? 'text-xs text-slate-600' : 'text-sm text-slate-700'}>Auto refresh</span>
      </label>
      <select
        value={intervalSeconds}
        onChange={(e) => setIntervalSeconds(Number(e.target.value) as typeof INTERVAL_OPTIONS[number])}
        disabled={disabled}
        className={`border border-slate-200 rounded-lg bg-white text-slate-700 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${isSm ? 'text-xs py-1 px-2' : 'text-sm py-1.5 px-2'}`}
        aria-label="Interval auto refresh (detik)"
      >
        {INTERVAL_OPTIONS.map((sec) => (
          <option key={sec} value={sec}>{sec} detik</option>
        ))}
      </select>
      <Button
        variant="outline"
        size={isSm ? 'sm' : 'sm'}
        className={isSm ? 'p-1.5' : 'p-2'}
        onClick={refreshNow}
        disabled={disabled}
        title="Refresh sekarang"
        aria-label="Refresh sekarang"
      >
        <RefreshCw className={isSm ? 'w-4 h-4' : 'w-4 h-4'} />
      </Button>
    </div>
  );
};

export default AutoRefreshControl;
