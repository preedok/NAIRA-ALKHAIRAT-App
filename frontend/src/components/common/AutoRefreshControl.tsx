import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import Button from './Button';
import Autocomplete from './Autocomplete';

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
  /** Susun vertikal (checkbox di atas, interval + refresh di bawah) — cocok kolom sempit / kartu dashboard */
  stacked?: boolean;
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
  stacked = false,
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
  const rootClass = stacked
    ? `flex flex-col items-stretch gap-2 ${className}`
    : `flex flex-wrap items-center gap-2 ${className}`;

  const controlsRow = (
    <div className={`flex flex-row items-center ${stacked ? 'gap-2 w-full' : 'gap-2'}`}>
      <Autocomplete
        value={String(intervalSeconds)}
        onChange={(v) => setIntervalSeconds(Number(v) as typeof INTERVAL_OPTIONS[number])}
        options={INTERVAL_OPTIONS.map((sec) => ({ value: String(sec), label: `${sec} detik` }))}
        disabled={disabled}
        fullWidth={stacked}
        className={stacked ? 'min-w-0 flex-1' : 'min-w-[5.5rem] w-auto'}
        placeholder="Interval"
      />
      <Button
        variant="outline"
        size="sm"
        icon={<RefreshCw className="w-4 h-4 shrink-0" />}
        className="h-9 w-9 p-0 min-w-[2.25rem] shrink-0 inline-flex items-center justify-center"
        onClick={refreshNow}
        disabled={disabled}
        title="Refresh sekarang"
        aria-label="Refresh sekarang"
      />
    </div>
  );

  return (
    <div className={rootClass}>
      <label className="flex items-center gap-1.5 cursor-pointer select-none shrink-0">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          disabled={disabled}
          className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
        />
        <span className={`whitespace-nowrap ${isSm ? 'text-xs text-slate-600' : 'text-sm text-slate-700'}`}>Auto refresh</span>
      </label>
      {controlsRow}
    </div>
  );
};

export default AutoRefreshControl;
