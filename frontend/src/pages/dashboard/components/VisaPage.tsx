import React, { useState, useEffect, useCallback } from 'react';
import { ShoppingCart, Pencil } from 'lucide-react';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import AutoRefreshControl from '../../../components/common/AutoRefreshControl';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { useOrderDraft } from '../../../contexts/OrderDraftContext';
import { businessRulesApi, branchesApi, productsApi } from '../../../services/api';
import { fillFromSource } from '../../../utils/currencyConversion';
import VisaWorkPage from './VisaWorkPage';

interface VisaProduct {
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

type VisaConfigItem = {
  wilayahId: string;
  wilayahName: string;
  visa_default_idr: number;
  require_hotel_with_visa: boolean;
};

type VisaPageProps = { embedInProducts?: boolean };

const VisaPage: React.FC<VisaPageProps> = ({ embedInProducts }) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [visaList, setVisaList] = useState<VisaConfigItem[]>([]);
  const [editWilayahId, setEditWilayahId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ visa_default_idr: 0, require_hotel_with_visa: true });
  const [currencyRates, setCurrencyRates] = useState<{ SAR_TO_IDR?: number; USD_TO_IDR?: number }>({});
  const [visaCurrency, setVisaCurrency] = useState<'IDR' | 'SAR' | 'USD'>('IDR');

  const isPusat = user?.role === 'super_admin' || user?.role === 'admin_pusat';
  const canConfig = isPusat;
  const canAddToOrder = user?.role === 'owner' || user?.role === 'invoice_koordinator' || user?.role === 'role_invoice_saudi';
  const [visaProducts, setVisaProducts] = useState<VisaProduct[]>([]);
  const [loadingVisaProducts, setLoadingVisaProducts] = useState(false);
  const { addItem: addDraftItem } = useOrderDraft();

  const fetchVisaList = useCallback(() => {
    if (!canConfig && !embedInProducts) return;
    setLoading(true);
    branchesApi.listWilayah()
      .then((wilayahRes) => {
        const wilayahList = (wilayahRes.data?.data || []) as Array<{ id: string; name: string }>;
        if (wilayahList.length === 0) {
          setVisaList([]);
          setLoading(false);
          return;
        }
        Promise.all(wilayahList.map((w) => businessRulesApi.get({ wilayah_id: w.id })))
          .then((rulesResponses) => {
            const items: VisaConfigItem[] = wilayahList.map((w, i) => {
              const d = (rulesResponses[i]?.data as { data?: Record<string, unknown> })?.data;
              return {
                wilayahId: w.id,
                wilayahName: w.name,
                visa_default_idr: Number(d?.visa_default_idr) || 0,
                require_hotel_with_visa: d?.require_hotel_with_visa === true || d?.require_hotel_with_visa === 'true'
              };
            });
            setVisaList(items);
          })
          .finally(() => setLoading(false));
      })
      .catch(() => setLoading(false));
  }, [canConfig, embedInProducts]);

  useEffect(() => {
    if (canConfig || embedInProducts) fetchVisaList();
  }, [canConfig, embedInProducts, fetchVisaList]);

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

  const fetchVisaProducts = useCallback(() => {
    if (!canAddToOrder && !embedInProducts) return;
    setLoadingVisaProducts(true);
    const params = { type: 'visa', with_prices: 'true', include_inactive: 'false', limit: 50, ...(user?.role === 'role_hotel' ? { view_as_pusat: 'true' } : {}) };
    productsApi.list(params)
      .then((res) => {
        const data = (res.data as { data?: VisaProduct[] })?.data;
        setVisaProducts(Array.isArray(data) ? data : []);
      })
      .catch(() => setVisaProducts([]))
      .finally(() => setLoadingVisaProducts(false));
  }, [canAddToOrder, embedInProducts, user?.role]);

  useEffect(() => {
    fetchVisaProducts();
  }, [fetchVisaProducts]);


  const handleOpenEdit = (item: VisaConfigItem) => {
    setEditWilayahId(item.wilayahId);
    setEditForm({ visa_default_idr: item.visa_default_idr, require_hotel_with_visa: item.require_hotel_with_visa });
  };

  const handleSaveWilayahConfig = async () => {
    if (!canConfig || !editWilayahId) return;
    setSaving(true);
    try {
      await businessRulesApi.set({
        wilayah_id: editWilayahId,
        rules: { visa_default_idr: editForm.visa_default_idr, require_hotel_with_visa: editForm.require_hotel_with_visa }
      });
      showToast('Harga visa wilayah disimpan', 'success');
      setEditWilayahId(null);
      fetchVisaList();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      showToast(err.response?.data?.message || 'Gagal menyimpan', 'error');
    } finally {
      setSaving(false);
    }
  };

  const refetchAll = useCallback(() => {
    fetchVisaList();
    fetchVisaProducts();
  }, [fetchVisaList, fetchVisaProducts]);

  if (user?.role === 'visa_koordinator' && !embedInProducts) {
    return <VisaWorkPage />;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div />
        <AutoRefreshControl onRefresh={refetchAll} disabled={loading || loadingVisaProducts} />
      </div>
      {(canConfig || embedInProducts) && (
        <Card>
          <h3 className="text-base font-semibold text-slate-900 mb-2">Harga visa per wilayah (dari admin pusat)</h3>
          <p className="text-sm text-slate-500 mb-3">{canConfig ? 'Edit per wilayah di tabel.' : 'Lihat saja. Pekerjaan visa di menu Visa.'}</p>
          {loading ? (
            <p className="text-slate-500 text-sm py-4">Memuat...</p>
          ) : visaList.length === 0 ? (
            <p className="text-slate-500 text-sm py-4">Belum ada wilayah. Tambah wilayah di master cabang/wilayah.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2.5 px-3 font-medium text-slate-600">Wilayah</th>
                    <th className="text-right py-2.5 px-3 font-medium text-slate-600">Harga visa (IDR)</th>
                    <th className="text-center py-2.5 px-3 font-medium text-slate-600">Wajib hotel</th>
                    {canConfig && <th className="text-center py-2.5 px-3 font-medium text-slate-600">Aksi</th>}
                  </tr>
                </thead>
                <tbody>
                  {visaList.map((item) => (
                    <tr key={item.wilayahId} className="border-b border-slate-100 hover:bg-slate-50/50">
                      <td className="py-2.5 px-3 font-medium text-slate-900">{item.wilayahName}</td>
                      <td className="py-2.5 px-3 text-right text-slate-800">Rp {Number(item.visa_default_idr || 0).toLocaleString('id-ID')}</td>
                      <td className="py-2.5 px-3 text-center text-slate-600">{item.require_hotel_with_visa ? 'Ya' : 'Tidak'}</td>
                      {canConfig && (
                        <td className="py-2.5 px-3 text-center">
                          <Button variant="outline" size="sm" className="p-2" onClick={() => handleOpenEdit(item)} title="Edit" aria-label="Edit">
                            <Pencil className="w-4 h-4" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Modal edit harga visa wilayah */}
      {editWilayahId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => !saving && setEditWilayahId(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5" onClick={(e) => e.stopPropagation()}>
            <h4 className="font-semibold text-slate-900 mb-3">Edit harga visa (wilayah)</h4>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Harga visa</label>
                <p className="text-xs text-slate-500 mb-1">Pilih mata uang. Lainnya mengikuti kurs dari Menu Settings.</p>
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <select
                    value={visaCurrency}
                    onChange={(e) => setVisaCurrency(e.target.value as 'IDR' | 'SAR' | 'USD')}
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 bg-white"
                  >
                    <option value="IDR">IDR</option>
                    <option value="SAR">SAR</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
                <div className="flex flex-wrap gap-2 mt-1">
                  {(['IDR', 'SAR', 'USD'] as const).map((curKey) => {
                    const triple = fillFromSource('IDR', editForm.visa_default_idr || 0, currencyRates);
                    const val = curKey === 'IDR' ? triple.idr : curKey === 'SAR' ? triple.sar : triple.usd;
                    const isEditable = visaCurrency === curKey;
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
                            setEditForm((f) => ({ ...f, visa_default_idr: Math.round(next.idr) }));
                          } : undefined}
                          className={`w-full max-w-[120px] border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 ${isEditable ? 'bg-white' : 'bg-slate-100 text-slate-600 cursor-not-allowed'}`}
                          placeholder="0"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editForm.require_hotel_with_visa}
                  onChange={(e) => setEditForm((f) => ({ ...f, require_hotel_with_visa: e.target.checked }))}
                  className="w-4 h-4 rounded border-slate-300 text-violet-600"
                />
                <span className="text-sm text-slate-700">Wajib punya hotel untuk visa</span>
              </label>
            </div>
            <div className="flex gap-2 mt-4">
              <Button variant="outline" onClick={() => setEditWilayahId(null)} disabled={saving}>Batal</Button>
              <Button variant="primary" onClick={handleSaveWilayahConfig} disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan'}</Button>
            </div>
          </div>
        </div>
      )}

      {/* Daftar produk visa: harga (view) atau tambah ke order (invoice/owner) */}
      {(canAddToOrder || embedInProducts) && (
        <Card>
          <h3 className="text-base font-semibold text-slate-900 mb-2">Produk visa {canAddToOrder ? 'untuk order' : '(harga dari admin pusat)'}</h3>
          <p className="text-sm text-slate-500 mb-3">{canAddToOrder ? 'Pilih produk visa lalu tambah ke keranjang order.' : 'Lihat saja. Pekerjaan visa di menu Visa.'}</p>
          {loadingVisaProducts ? (
            <p className="text-slate-500 text-sm py-4">Memuat produk...</p>
          ) : visaProducts.length === 0 ? (
            <p className="text-slate-500 text-sm py-4">Belum ada produk visa. Tambah produk visa di master produk.</p>
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
                  {visaProducts.map((p) => {
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
                                  type: 'visa',
                                  product_id: p.id,
                                  product_name: p.name,
                                  unit_price_idr: Number(priceIdr) || 0,
                                  quantity: 1
                                });
                                showToast('Visa ditambahkan ke order.', 'success');
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
    </div>
  );
};

export default VisaPage;
