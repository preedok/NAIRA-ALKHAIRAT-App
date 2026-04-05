import React, { useState, useEffect, useCallback } from 'react';
import { ClipboardList } from 'lucide-react';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import Badge from '../../../components/common/Badge';
import { Modal, ModalHeader, ModalBody, ModalFooter, ModalBox, ContentLoading, Textarea, CardSectionHeader } from '../../../components/common';
import Table from '../../../components/common/Table';
import { orderCancellationRequestsApi } from '../../../services/api';
import { useToast } from '../../../contexts/ToastContext';
import type { TableColumn } from '../../../types';

function actionLabel(action: string | undefined) {
  if (action === 'to_balance') return 'Jadikan saldo';
  if (action === 'refund') return 'Refund ke rekening';
  if (action === 'allocate_to_order') return 'Pindah ke invoice lain';
  return action || '–';
}

function statusBadgeVariant(st: string) {
  if (st === 'pending') return 'warning' as const;
  if (st === 'completed') return 'success' as const;
  if (st === 'rejected') return 'error' as const;
  return 'default' as const;
}

type Row = {
  id: string;
  status: string;
  owner_note?: string | null;
  payload?: { action?: string };
  created_at?: string;
  Order?: { order_number?: string };
  Invoice?: { invoice_number?: string };
  Owner?: { name?: string; company_name?: string };
};

const OrderCancellationRequestsPanel: React.FC = () => {
  const { showToast } = useToast();
  const [filterStatus, setFilterStatus] = useState<'pending' | 'all'>('pending');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Row[]>([]);
  const [pagination, setPagination] = useState<{ total: number; page: number; limit: number; totalPages: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectRow, setRejectRow] = useState<Row | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [approveRow, setApproveRow] = useState<Row | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await orderCancellationRequestsApi.list({
        status: filterStatus,
        page,
        limit: 15
      });
      if (res.data.success) {
        setRows((res.data.data as Row[]) || []);
        setPagination(res.data.pagination || null);
      } else {
        setRows([]);
        setPagination(null);
      }
    } catch {
      setRows([]);
      setPagination(null);
    } finally {
      setLoading(false);
    }
  }, [filterStatus, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [filterStatus]);

  const submitReject = async () => {
    if (!rejectRow) return;
    setBusyId(rejectRow.id);
    try {
      await orderCancellationRequestsApi.review(rejectRow.id, {
        decision: 'reject',
        rejection_reason: rejectReason.trim() || undefined
      });
      setRejectRow(null);
      setRejectReason('');
      await load();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      showToast(msg || 'Gagal menolak pengajuan', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const confirmApprove = async () => {
    if (!approveRow) return;
    const row = approveRow;
    setBusyId(row.id);
    try {
      await orderCancellationRequestsApi.review(row.id, { decision: 'approve' });
      setApproveRow(null);
      showToast('Pengajuan disetujui dan pembatalan diproses.', 'success');
      await load();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      showToast(msg || 'Gagal menyetujui', 'error');
      await load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <Card className="travel-card">
        <CardSectionHeader
          icon={<ClipboardList className="w-6 h-6" />}
          title="Pengajuan pembatalan invoice (lunas)"
          subtitle="Owner mengajukan pembatalan order yang sudah lunas. Setujui untuk menjalankan alur pembatalan yang sama seperti batalkan langsung."
          className="mb-4"
        />
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <Button
            type="button"
            variant={filterStatus === 'pending' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setFilterStatus('pending')}
          >
            Menunggu
          </Button>
          <Button
            type="button"
            variant={filterStatus === 'all' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setFilterStatus('all')}
          >
            Semua status
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => load()} disabled={loading}>
            Muat ulang
          </Button>
        </div>
        {loading && rows.length === 0 ? (
          <ContentLoading />
        ) : (
          <Table
            columns={[
              { id: 'inv', label: 'Invoice / Order', align: 'left' },
              { id: 'owner', label: 'Owner', align: 'left' },
              { id: 'action', label: 'Tindakan', align: 'left' },
              { id: 'status', label: 'Status', align: 'left' },
              { id: 'note', label: 'Catatan owner', align: 'left' },
              { id: 'acts', label: 'Aksi', align: 'right' }
            ] as TableColumn[]}
            data={rows}
            emptyMessage="Tidak ada pengajuan"
            pagination={
              pagination && pagination.total > 0
                ? {
                    total: pagination.total,
                    page: pagination.page,
                    limit: pagination.limit,
                    totalPages: pagination.totalPages,
                    onPageChange: setPage,
                    onLimitChange: () => {}
                  }
                : undefined
            }
            renderRow={(row: Row) => (
              <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3 align-top text-sm">
                  <div className="font-medium text-slate-900">{row.Invoice?.invoice_number || '–'}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{row.Order?.order_number || '–'}</div>
                </td>
                <td className="px-4 py-3 align-top text-sm">{row.Owner?.company_name || row.Owner?.name || '–'}</td>
                <td className="px-4 py-3 align-top text-sm">{actionLabel(row.payload?.action)}</td>
                <td className="px-4 py-3 align-top">
                  <Badge variant={statusBadgeVariant(row.status)}>{row.status}</Badge>
                </td>
                <td className="px-4 py-3 align-top text-sm text-slate-600 max-w-[200px]">
                  {row.owner_note ? <span className="line-clamp-3">{row.owner_note}</span> : '–'}
                </td>
                <td className="px-4 py-3 align-top text-right whitespace-nowrap">
                  {row.status === 'pending' ? (
                    <div className="flex flex-col sm:flex-row gap-2 justify-end">
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700"
                        disabled={busyId === row.id}
                        onClick={() => setApproveRow(row)}
                      >
                        Setujui
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="border-red-200 text-red-700"
                        disabled={busyId === row.id}
                        onClick={() => { setRejectRow(row); setRejectReason(''); }}
                      >
                        Tolak
                      </Button>
                    </div>
                  ) : (
                    <span className="text-slate-400 text-sm">—</span>
                  )}
                </td>
              </tr>
            )}
          />
        )}
      </Card>

      {approveRow && (
        <Modal open onClose={() => !busyId && setApproveRow(null)} zIndex={70}>
          <ModalBox className="max-w-md w-full">
            <ModalHeader
              title="Setujui pembatalan?"
              subtitle={`Invoice ${approveRow.Invoice?.invoice_number || '–'} · ${approveRow.Owner?.company_name || approveRow.Owner?.name || 'Owner'}`}
              onClose={() => !busyId && setApproveRow(null)}
            />
            <ModalBody className="space-y-2">
              <p className="text-sm text-slate-600">
                Proses pembatalan akan langsung dijalankan (saldo, refund, atau alokasi sesuai pilihan owner). Tindakan ini tidak dapat dibatalkan dari sini.
              </p>
              <p className="text-sm text-slate-500">
                Tindakan: <strong className="text-slate-800">{actionLabel(approveRow.payload?.action)}</strong>
              </p>
            </ModalBody>
            <ModalFooter>
              <Button variant="outline" onClick={() => setApproveRow(null)} disabled={!!busyId}>
                Batal
              </Button>
              <Button
                variant="primary"
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={confirmApprove}
                disabled={!!busyId}
              >
                {busyId ? 'Memproses...' : 'Ya, setujui'}
              </Button>
            </ModalFooter>
          </ModalBox>
        </Modal>
      )}

      {rejectRow && (
        <Modal open onClose={() => !busyId && setRejectRow(null)} zIndex={70}>
          <ModalBox className="max-w-lg w-full">
            <ModalHeader title="Tolak pengajuan" subtitle="Opsional: beri alasan agar owner memahami penolakan." onClose={() => !busyId && setRejectRow(null)} />
            <ModalBody className="space-y-3">
              <Textarea
                label="Alasan penolakan (opsional)"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                placeholder="Contoh: Dokumen belum lengkap..."
                disabled={!!busyId}
              />
            </ModalBody>
            <ModalFooter>
              <Button variant="outline" onClick={() => setRejectRow(null)} disabled={!!busyId}>Batal</Button>
              <Button variant="primary" className="bg-red-600 hover:bg-red-700" onClick={submitReject} disabled={!!busyId}>
                {busyId ? 'Memproses...' : 'Tolak pengajuan'}
              </Button>
            </ModalFooter>
          </ModalBox>
        </Modal>
      )}
    </>
  );
};

export default OrderCancellationRequestsPanel;
