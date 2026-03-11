/**
 * Card statistik untuk menu Progress divisi dengan modal "Lihat" menampilkan daftar invoice.
 * Satu komponen untuk Visa, Tiket, Hotel, Bus, Handling.
 */

import React from 'react';
import { Eye } from 'lucide-react';
import Button from './Button';
import StatCard from './StatCard';
import Modal, { ModalHeader, ModalBody, ModalBoxLg } from './Modal';
import Table from './Table';
import type { TableColumn } from '../../types';
import Badge from './Badge';
import NominalDisplay from './NominalDisplay';

export interface DivisionStatItem {
  id: string;
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  iconClassName?: string;
  modalTitle: string;
}

export interface DivisionStatCardsWithModalProps {
  /** Daftar stat: id, label, value, icon, iconClassName?, modalTitle */
  stats: DivisionStatItem[];
  /** Semua invoice (untuk filter per stat) */
  invoices: any[];
  /** Untuk stat dengan id tertentu, return daftar invoice yang ditampilkan di modal */
  getFilteredInvoices: (statId: string) => any[];
  /** Loading state: nilai card tampil "–" */
  loading?: boolean;
  /** Label untuk section "Per Status" (opsional, kalau ada dua baris card) */
  perStatusLabel?: string;
  /** Opsi: fungsi dapat status label per invoice (default: label sederhana) */
  getStatusLabel?: (row: any) => string;
  /** Opsi: variant badge per invoice: default|success|warning|error|info */
  getStatusBadgeVariant?: (row: any) => 'default' | 'success' | 'warning' | 'error' | 'info';
}

const DivisionStatCardsWithModal: React.FC<DivisionStatCardsWithModalProps> = ({
  stats,
  invoices,
  getFilteredInvoices,
  loading = false,
  perStatusLabel,
  getStatusLabel: getStatusLabelProp,
  getStatusBadgeVariant: getStatusBadgeVariantProp
}) => {
  const [openStatId, setOpenStatId] = React.useState<string | null>(null);

  const firstRow = stats.slice(0, 2);
  const restRow = stats.slice(2);

  const getStatusLabel = (row: any) => {
    if (getStatusLabelProp) return getStatusLabelProp(row);
    const inv = row;
    if (inv.status === 'canceled' || inv.status === 'cancelled') return 'Dibatalkan';
    if (inv.status === 'cancelled_refund') return 'Refund';
    if (inv.status === 'tentative') return 'Tentative';
    if (inv.status === 'partial_paid') return 'DP';
    if (inv.status === 'paid') return 'Lunas';
    if (inv.status === 'processing') return 'Proses';
    if (inv.status === 'completed') return 'Selesai';
    return inv.status || '–';
  };

  const getStatusVariant = (row: any): 'default' | 'success' | 'warning' | 'error' | 'info' => {
    if (getStatusBadgeVariantProp) return getStatusBadgeVariantProp(row);
    const s = (row.status || '').toLowerCase();
    if (s === 'paid' || s === 'completed') return 'success';
    if (s === 'partial_paid' || s === 'processing') return 'warning';
    if (s === 'canceled' || s === 'cancelled' || s === 'cancelled_refund') return 'error';
    if (s === 'tentative') return 'info';
    return 'default';
  };

  const tableColumns: TableColumn[] = [
    { id: 'invoice_number', label: 'No. Invoice' },
    { id: 'owner', label: 'Owner' },
    { id: 'total', label: 'Total' },
    { id: 'status', label: 'Status' }
  ];

  return (
    <>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {firstRow.map((stat) => (
            <StatCard
              key={stat.id}
              icon={stat.icon}
              label={stat.label}
              value={loading ? '–' : stat.value}
              iconClassName={stat.iconClassName}
              onClick={() => setOpenStatId(stat.id)}
              action={
                <div onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 w-full justify-center"
                    onClick={() => setOpenStatId(stat.id)}
                  >
                    <Eye className="w-4 h-4" /> Lihat
                  </Button>
                </div>
              }
            />
          ))}
        </div>
        {restRow.length > 0 && (
          <div>
            {perStatusLabel && (
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                {perStatusLabel}
              </p>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {restRow.map((stat) => (
                <StatCard
                  key={stat.id}
                  icon={stat.icon}
                  label={stat.label}
                  value={loading ? '–' : stat.value}
                  iconClassName={stat.iconClassName}
                  onClick={() => setOpenStatId(stat.id)}
                  action={
                    <div onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1 w-full justify-center"
                        onClick={() => setOpenStatId(stat.id)}
                      >
                        <Eye className="w-4 h-4" /> Lihat
                      </Button>
                    </div>
                  }
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {openStatId && (
        <Modal open onClose={() => setOpenStatId(null)}>
          <ModalBoxLg>
            <ModalHeader
              title={stats.find((s) => s.id === openStatId)?.modalTitle ?? 'Daftar Invoice'}
              onClose={() => setOpenStatId(null)}
            />
            <ModalBody>
              <Table
                columns={tableColumns}
                data={getFilteredInvoices(openStatId)}
                emptyMessage="Tidak ada invoice"
                renderRow={(row: any) => (
                  <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                    <td className="py-2 px-4 text-sm">{row.invoice_number || '–'}</td>
                    <td className="py-2 px-4 text-sm">
                      {row.Order?.User?.name ?? row.User?.name ?? '–'}
                    </td>
                    <td className="py-2 px-4 text-sm">
                      <NominalDisplay amount={row.total_amount ?? 0} currency="IDR" />
                    </td>
                    <td className="py-2 px-4">
                      <Badge variant={getStatusVariant(row)}>{getStatusLabel(row)}</Badge>
                    </td>
                  </tr>
                )}
              />
            </ModalBody>
          </ModalBoxLg>
        </Modal>
      )}
    </>
  );
};

export default DivisionStatCardsWithModal;
