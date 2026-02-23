import React, { useState, useEffect, useCallback } from 'react';
import { Plane, Edit2, ShoppingCart } from 'lucide-react';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import ActionsMenu from '../../../components/common/ActionsMenu';
import AutoRefreshControl from '../../../components/common/AutoRefreshControl';
import type { ActionsMenuItem } from '../../../components/common/ActionsMenu';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { useOrderDraft } from '../../../contexts/OrderDraftContext';
import { businessRulesApi, branchesApi, productsApi } from '../../../services/api';
import { fillFromSource } from '../../../utils/currencyConversion';
import TicketWorkPage from './TicketWorkPage';

interface TicketProduct {
  id: string;
  code: string;
  name: string;
  price_general_idr?: number | null;
  price_general_sar?: number | null;
  price_general_usd?: number | null;
  price_general?: number | null;
  price_branch?: number | null;
  currency?: string;
}

type TicketForm = {
  ticket_general_idr: number;
  ticket_lion_idr: number;
  ticket_super_air_jet_idr: number;
  ticket_garuda_idr: number;
};

type TicketWilayahRow = TicketForm & {
  wilayahId: string;
  wilayahName: string;
};

const MASKAPAI: Array<{ key: keyof TicketForm; label: string }> = [
  { key: 'ticket_lion_idr', label: 'Lion' },
  { key: 'ticket_super_air_jet_idr', label: 'Super Air Jet' },
  { key: 'ticket_garuda_idr', label: 'Garuda' }
];

const emptyForm: TicketForm = {
  ticket_general_idr: 0,
  ticket_lion_idr: 0,
  ticket_super_air_jet_idr: 0,
  ticket_garuda_idr: 0
};

function toForm(d: Record<string, unknown> | undefined): TicketForm {
  if (!d) return { ...emptyForm };
  return {
    ticket_general_idr: Number(d.ticket_general_idr) || 0,
    ticket_lion_idr: Number(d.ticket_lion_idr) || 0,
    ticket_super_air_jet_idr: Number(d.ticket_super_air_jet_idr) || 0,
    ticket_garuda_idr: Number(d.ticket_garuda_idr) || 0
  };
}

const formatPrice = (n: number) => (n != null && n > 0 ? `Rp ${Number(n).toLocaleString('id-ID')}` : '-');

type TicketsPageProps = { embedInProducts?: boolean };

const TicketsPage: React.FC<TicketsPageProps> = ({ embedInProducts }) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [wilayahRows, setWilayahRows] = useState<TicketWilayahRow[]>([]);
  const [editWilayahId, setEditWilayahId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<TicketForm>(emptyForm);
  const [currencyRates, setCurrencyRates] = useState<{ SAR_TO_IDR?: number; USD_TO_IDR?: number }>({});
  const [ticketCurrency, setTicketCurrency] = useState<'IDR' | 'SAR' | 'USD'>('IDR');

  const isPusat = user?.role === 'super_admin' || user?.role === 'admin_pusat';
  const canConfig = isPusat;
  const canAddToOrder = user?.role === 'owner' || user?.role === 'invoice_koordinator' || user?.role === 'role_invoice_saudi';
  const [ticketProducts, setTicketProducts] = useState<TicketProduct[]>([]);
  const [loadingTicketProducts, setLoadingTicketProducts] = useState(false);
  const { addItem: addDraftItem } = useOrderDraft();

  const fetchTicketList = useCallback(() => {
    if (!canConfig && !embedInProducts) return;
    setListLoading(true);
    branchesApi.listWilayah()
      .then((wilayahRes) => {
        const wilayahList = (wilayahRes.data?.data || []) as Array<{ id: string; name: string }>;
        if (wilayahList.length === 0) {
          setWilayahRows([]);
          setListLoading(false);
          return;
        }
        Promise.all(wilayahList.map((w) => businessRulesApi.get({ wilayah_id: w.id })))
          .then((rulesResps) => {
            const rows: TicketWilayahRow[] = wilayahList.map((w, i) => {
              const d = (rulesResps[i]?.data as { data?: Record<string, unknown> })?.data;
              return { ...toForm(d), wilayahId: w.id, wilayahName: w.name };
            });
            setWilayahRows(rows);
          })
          .finally(() => setListLoading(false));
      })
      .catch(() => setListLoading(false));
  }, [canConfig, embedInProducts]);

  useEffect(() => {
    if (canConfig || embedInProducts) fetchTicketList();
  }, [canConfig, embedInProducts, fetchTicketList]);

  useEffect(() => {
    businessRulesApi.get().then((res) => {
      const data = (res.data as { data?: { currency_rates?: unknown } })?.data;
      let cr = data?.currency_rates;
      if (typeof cr === 'string') {
        try { cr = JSON.parse(cr) as { SAR_TO_IDR?: number; USD_TO_IDR?: number }; } catch { cr = null; }
      }
      const rates = cr as { SAR_TO_IDR?: number; USD_TO_IDR?: number } | null;
      if (rates && typeof rates === 'object') setCurrencyRates({ SAR_TO_IDR: rates.SAR_TO_IDR ?? 4200, USD_TO_IDR: rates.USD_TO_IDR ?? 15500 });
    }).catch(() => {});
  }, []);

  const fetchTicketProducts = useCallback(() => {
    if (!canAddToOrder && !embedInProducts) return;
    setLoadingTicketProducts(true);
    const params = { type: 'ticket', with_prices: 'true', include_inactive: 'false', limit: 50, ...(user?.role === 'role_hotel' ? { view_as_pusat: 'true' } : {}) };
    productsApi.list(params)
      .then((res) => {
        const data = (res.data as { data?: TicketProduct[] })?.data;
        setTicketProducts(Array.isArray(data) ? data : []);
      })
      .catch(() => setTicketProducts([]))
      .finally(() => setLoadingTicketProducts(false));
  }, [canAddToOrder, embedInProducts, user?.role]);

  const refetchAll = useCallback(() => {
    fetchTicketList();
    fetchTicketProducts();
  }, [fetchTicketList, fetchTicketProducts]);

  useEffect(() => {
    fetchTicketProducts();
  }, [fetchTicketProducts]);

  const handleOpenEdit = (row: TicketWilayahRow) => {
    setEditWilayahId(row.wilayahId);
    setEditForm({
      ticket_general_idr: row.ticket_general_idr,
      ticket_lion_idr: row.ticket_lion_idr,
      ticket_super_air_jet_idr: row.ticket_super_air_jet_idr,
      ticket_garuda_idr: row.ticket_garuda_idr
    });
  };

  const handleSaveWilayahConfig = async () => {
    if (!canConfig || !editWilayahId) return;
    setSaving(true);
    try {
      await businessRulesApi.set({
        wilayah_id: editWilayahId,
        rules: {
          ticket_general_idr: editForm.ticket_general_idr,
          ticket_lion_idr: editForm.ticket_lion_idr,
          ticket_super_air_jet_idr: editForm.ticket_super_air_jet_idr,
          ticket_garuda_idr: editForm.ticket_garuda_idr
        }
      });
      showToast('Harga tiket wilayah disimpan', 'success');
      setEditWilayahId(null);
      fetchTicketList();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      showToast(err.response?.data?.message || 'Gagal menyimpan', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (user?.role === 'tiket_koordinator' && !embedInProducts) {
    return <TicketWorkPage />;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Tiket</h2>
          <p className="text-slate-600 text-sm mt-0.5">
            {embedInProducts ? 'Harga tiket dari admin pusat. Pekerjaan tiket di menu Tiket.' : 'Harga tiket per wilayah per maskapai (General, Lion, Super Air Jet, Garuda).'}
          </p>
        </div>
        <AutoRefreshControl onRefresh={refetchAll} disabled={listLoading || loadingTicketProducts} />
      </div>

      {(canConfig || embedInProducts) && (
        <>
          <Card>
            <h3 className="text-base font-semibold text-slate-900 mb-3">Harga tiket per wilayah {embedInProducts && !canConfig ? '(dari admin pusat)' : ''}</h3>
            {listLoading ? (
              <p className="text-slate-500 text-sm py-4">Memuat...</p>
            ) : wilayahRows.length === 0 ? (
              <p className="text-slate-500 text-sm py-2">Belum ada wilayah.</p>
            ) : (
              <div className="overflow-x-auto -mx-1">
                <table className="w-full text-sm min-w-[500px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left py-3 px-4 font-semibold text-slate-700">Wilayah</th>
                      <th className="text-right py-3 px-4 font-semibold text-slate-700">General</th>
                      <th className="text-right py-3 px-4 font-semibold text-slate-700">Lion</th>
                      <th className="text-right py-3 px-4 font-semibold text-slate-700">Super Air Jet</th>
                      <th className="text-right py-3 px-4 font-semibold text-slate-700">Garuda</th>
                      {canConfig && <th className="text-center py-3 px-4 font-semibold text-slate-700 w-24">Aksi</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {wilayahRows.map((row) => (
                      <tr key={row.wilayahId} className="border-b border-slate-100 hover:bg-slate-50/50">
                        <td className="py-3 px-4 font-medium text-slate-900">{row.wilayahName}</td>
                        <td className="py-3 px-4 text-right text-slate-700">{formatPrice(row.ticket_general_idr)}</td>
                        <td className="py-3 px-4 text-right text-slate-700">{formatPrice(row.ticket_lion_idr)}</td>
                        <td className="py-3 px-4 text-right text-slate-700">{formatPrice(row.ticket_super_air_jet_idr)}</td>
                        <td className="py-3 px-4 text-right text-slate-700">{formatPrice(row.ticket_garuda_idr)}</td>
                        {canConfig && (
                          <td className="py-3 px-4">
                            <div className="flex justify-center">
                              <ActionsMenu
                                align="right"
                                items={[
                                  { id: 'edit', label: 'Edit', icon: <Edit2 className="w-4 h-4" />, onClick: () => handleOpenEdit(row) },
                                ] as ActionsMenuItem[]}
                              />
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Modal Edit harga wilayah */}
          {editWilayahId !== null && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setEditWilayahId(null)}>
              <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-5" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-base font-semibold text-slate-900 mb-3">Edit harga tiket wilayah</h3>
                <p className="text-sm text-slate-600 mb-2">
                  {wilayahRows.find((r) => r.wilayahId === editWilayahId)?.wilayahName ?? 'Wilayah'}
                </p>
                <div className="mb-3">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Input harga dalam</label>
                  <select
                    value={ticketCurrency}
                    onChange={(e) => setTicketCurrency(e.target.value as 'IDR' | 'SAR' | 'USD')}
                    className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 bg-white"
                  >
                    <option value="IDR">IDR</option>
                    <option value="SAR">SAR</option>
                    <option value="USD">USD</option>
                  </select>
                  <p className="text-xs text-slate-500 mt-1">Mata uang lain mengikuti kurs dari Menu Settings.</p>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">General</label>
                    <div className="flex flex-wrap gap-2">
                      {(['IDR', 'SAR', 'USD'] as const).map((curKey) => {
                        const triple = fillFromSource('IDR', editForm.ticket_general_idr || 0, currencyRates);
                        const val = curKey === 'IDR' ? triple.idr : curKey === 'SAR' ? triple.sar : triple.usd;
                        const isEditable = ticketCurrency === curKey;
                        return (
                          <div key={curKey}>
                            <span className="text-xs text-slate-500 block mb-0.5">{curKey}{!isEditable && ' (konversi)'}</span>
                            <input
                              type="number"
                              min={0}
                              step={curKey === 'IDR' ? 1 : 0.01}
                              value={val || ''}
                              readOnly={!isEditable}
                              onChange={isEditable ? (e) => {
                                const v = parseFloat(e.target.value) || 0;
                                const next = fillFromSource(curKey, v, currencyRates);
                                setEditForm((f) => ({ ...f, ticket_general_idr: Math.round(next.idr) }));
                              } : undefined}
                              className={`w-full max-w-[100px] border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 ${isEditable ? 'bg-white' : 'bg-slate-100 text-slate-600 cursor-not-allowed'}`}
                              placeholder="0"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {MASKAPAI.map((m) => {
                    const idrVal = editForm[m.key] as number;
                    return (
                      <div key={m.key}>
                        <label className="block text-sm font-medium text-slate-700 mb-1">{m.label}</label>
                        <div className="flex flex-wrap gap-2">
                          {(['IDR', 'SAR', 'USD'] as const).map((curKey) => {
                            const triple = fillFromSource('IDR', idrVal || 0, currencyRates);
                            const val = curKey === 'IDR' ? triple.idr : curKey === 'SAR' ? triple.sar : triple.usd;
                            const isEditable = ticketCurrency === curKey;
                            return (
                              <div key={curKey}>
                                <span className="text-xs text-slate-500 block mb-0.5">{curKey}{!isEditable && ' (konversi)'}</span>
                                <input
                                  type="number"
                                  min={0}
                                  step={curKey === 'IDR' ? 1 : 0.01}
                                  value={val || ''}
                                  readOnly={!isEditable}
                                  onChange={isEditable ? (e) => {
                                    const v = parseFloat(e.target.value) || 0;
                                    const next = fillFromSource(curKey, v, currencyRates);
                                    setEditForm((f) => ({ ...f, [m.key]: Math.round(next.idr) }));
                                  } : undefined}
                                  className={`w-full max-w-[100px] border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 ${isEditable ? 'bg-white' : 'bg-slate-100 text-slate-600 cursor-not-allowed'}`}
                                  placeholder="0"
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <Button variant="outline" onClick={() => setEditWilayahId(null)}>Batal</Button>
                  <Button variant="primary" onClick={handleSaveWilayahConfig} disabled={saving}>
                    {saving ? 'Menyimpan...' : 'Simpan'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Daftar produk tiket: harga (view) atau tambah ke order (invoice/owner) */}
      {(canAddToOrder || embedInProducts) && (
        <Card>
          <h3 className="text-base font-semibold text-slate-900 mb-2">Produk tiket {canAddToOrder ? 'untuk order' : '(harga dari admin pusat)'}</h3>
          <p className="text-sm text-slate-500 mb-3">{canAddToOrder ? 'Pilih produk tiket lalu tambah ke keranjang order.' : 'Lihat saja. Pekerjaan tiket di menu Tiket.'}</p>
          {loadingTicketProducts ? (
            <p className="text-slate-500 text-sm py-4">Memuat produk...</p>
          ) : ticketProducts.length === 0 ? (
            <p className="text-slate-500 text-sm py-4">Belum ada produk tiket. Tambah produk tiket di master produk.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2.5 px-3 font-medium text-slate-600">Kode</th>
                    <th className="text-left py-2.5 px-3 font-medium text-slate-600">Nama</th>
                    <th className="text-right py-2.5 px-3 font-medium text-slate-600">Harga (IDR)</th>
                    {canAddToOrder && <th className="text-center py-2.5 px-3 font-medium text-slate-600">Aksi</th>}
                  </tr>
                </thead>
                <tbody>
                  {ticketProducts.map((p) => {
                    const priceIdr = p.price_general_idr ?? (p.currency === 'IDR' || !p.currency ? p.price_general ?? p.price_branch : null) ?? 0;
                    return (
                      <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                        <td className="py-2.5 px-3 font-mono text-slate-600">{p.code || '-'}</td>
                        <td className="py-2.5 px-3 font-medium text-slate-900">{p.name}</td>
                        <td className="py-2.5 px-3 text-right text-slate-800">Rp {Number(priceIdr).toLocaleString('id-ID')}</td>
                        {canAddToOrder && (
                          <td className="py-2.5 px-3 text-center">
                            <Button
                              variant="outline"
                              size="sm"
                              className="p-2 mx-auto"
                              onClick={() => {
                                addDraftItem({
                                  type: 'ticket',
                                  product_id: p.id,
                                  product_name: p.name,
                                  unit_price_idr: Number(priceIdr) || 0,
                                  quantity: 1
                                });
                                showToast('Tiket ditambahkan ke order.', 'success');
                              }}
                              title="Tambah ke order"
                              aria-label="Tambah ke order"
                            >
                              <ShoppingCart className="w-4 h-4" />
                            </Button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex gap-3">
        <Plane className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
        <div>
          <h3 className="font-medium text-slate-900 text-sm">Penerbitan tiket</h3>
          <p className="text-sm text-slate-600 mt-0.5">
            Order dan penerbitan tiket jamaah dikelola dengan akun role Tiket cabang.
          </p>
        </div>
      </div>
    </div>
  );
};

export default TicketsPage;
