import React from 'react';
import { Plus } from 'lucide-react';
import Modal, { ModalHeader, ModalBody, ModalFooter, ModalBox } from './Modal';
import Button from './Button';
import Input from './Input';

const ROOM_LABELS: Record<string, string> = {
  double: 'Double',
  triple: 'Triple',
  quad: 'Quad',
  quint: 'Quint',
  single: 'Double'
};

export type HotelAddRoomQuantityRow = {
  roomType: string;
  total: number;
  booked: number;
  available: number;
};

export interface HotelAddRoomQuantityModalProps {
  open: boolean;
  /** Di atas modal ketersediaan gunakan 60; standalone 50 */
  zIndex?: number;
  saving: boolean;
  onClose: () => void;
  dateStr: string;
  seasonName?: string;
  /** Teks bantuan di bawah baris tanggal/musim */
  helpText?: string;
  rows: HotelAddRoomQuantityRow[];
  addInputs: Record<string, string>;
  onAddInputChange: (roomType: string, value: string) => void;
  onSave: () => void;
}

function formatDateId(ymd: string): string {
  const d = new Date(ymd + 'T12:00:00');
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Popup standar: tambah kuota kamar per tipe (dari kalender ketersediaan / daftar hotel).
 */
const HotelAddRoomQuantityModal: React.FC<HotelAddRoomQuantityModalProps> = ({
  open,
  zIndex = 50,
  saving,
  onClose,
  dateStr,
  seasonName,
  helpText,
  rows,
  addInputs,
  onAddInputChange,
  onSave
}) => {
  const handleClose = () => {
    if (!saving) onClose();
  };

  return (
    <Modal open={open} zIndex={zIndex} onClose={handleClose} closeOnBackdrop={!saving}>
      <ModalBox className="max-w-lg w-full !min-h-0 min-h-0 max-h-[min(90vh,640px)]">
        <ModalHeader
          title="Tambah jumlah kamar"
          subtitle={
            <>
              Tanggal <strong>{formatDateId(dateStr)}</strong>
              {seasonName ? (
                <>
                  {' '}
                  · Musim: <strong>{seasonName}</strong>
                </>
              ) : null}
            </>
          }
          icon={<Plus className="w-5 h-5" />}
          onClose={handleClose}
        />
        <ModalBody className="space-y-4 !pt-4">
          {helpText ? <p className="text-xs text-slate-500">{helpText}</p> : null}
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left py-2.5 px-3 font-semibold text-slate-700">Tipe</th>
                  <th className="text-center py-2.5 px-2 font-semibold text-slate-700">Total</th>
                  <th className="text-center py-2.5 px-2 font-semibold text-slate-700">Dipesan</th>
                  <th className="text-center py-2.5 px-2 font-semibold text-slate-700">Tersedia</th>
                  <th className="text-center py-2.5 px-2 font-semibold text-slate-700">Tambah</th>
                  <th className="text-center py-2.5 px-2 font-semibold text-slate-700">Total baru</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ roomType: rt, total, booked, available }) => {
                  const isFull = total > 0 && available <= 0;
                  const add = Math.max(0, parseInt(addInputs[rt] ?? '', 10) || 0);
                  const newTotal = total + add;
                  const label = ROOM_LABELS[rt] || rt;
                  return (
                    <tr key={rt} className={`border-b border-slate-100 last:border-0 ${isFull ? 'bg-rose-50/60' : ''}`}>
                      <td className="py-2 px-3 font-medium text-slate-800 capitalize">
                        {label}
                        {isFull ? ' (Penuh)' : ''}
                      </td>
                      <td className="py-2 px-2 text-center tabular-nums text-slate-700">{total}</td>
                      <td className="py-2 px-2 text-center tabular-nums text-slate-600">{booked}</td>
                      <td className={`py-2 px-2 text-center tabular-nums font-medium ${available <= 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {available}
                      </td>
                      <td className="py-2 px-2">
                        <Input
                          type="number"
                          min={0}
                          value={addInputs[rt] ?? ''}
                          onChange={(e) => onAddInputChange(rt, e.target.value)}
                          placeholder="0"
                          fullWidth={false}
                          className="w-16 min-w-[4rem]"
                          disabled={saving}
                        />
                      </td>
                      <td className="py-2 px-2 text-center font-semibold tabular-nums text-slate-800">{newTotal}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" size="sm" onClick={handleClose} disabled={saving}>
            Batal
          </Button>
          <Button variant="primary" size="sm" onClick={onSave} disabled={saving}>
            {saving ? 'Menyimpan…' : 'Simpan'}
          </Button>
        </ModalFooter>
      </ModalBox>
    </Modal>
  );
};

export default HotelAddRoomQuantityModal;
