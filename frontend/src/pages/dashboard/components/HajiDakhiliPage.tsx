import React, { useCallback, useEffect, useState } from 'react';
import { FileText, Plus, Pencil, ShoppingCart } from 'lucide-react';
import { productsApi, businessRulesApi } from '../../../services/api';
import { fillFromSource } from '../../../utils/currencyConversion';
import { getPriceTripleForTable, PRICE_COLUMN_LABEL } from '../../../utils';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { useOrderDraft } from '../../../contexts/OrderDraftContext';
import { getProductListOwnerId } from '../../../utils/productHelpers';
import PageHeader from '../../../components/common/PageHeader';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import { AutoRefreshControl, Input, Modal, ModalBody, ModalBox, ModalFooter, ModalHeader } from '../../../components/common';

type HajiDakhiliProduct = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  price_general_idr?: number | null;
  price_general?: number | null;
  currency?: string;
};

const HajiDakhiliPage: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { addItem: addDraftItem } = useOrderDraft();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<HajiDakhiliProduct[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<HajiDakhiliProduct | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    price_idr: 0
  });
  const [currencyRates, setCurrencyRates] = useState<{ SAR_TO_IDR?: number; USD_TO_IDR?: number }>({});

  const isPusat = ['super_admin', 'admin_pusat', 'role_accounting'].includes(user?.role || '');
  const canAddToOrder = user?.role === 'owner_mou' || user?.role === 'owner_non_mou' || user?.role === 'invoice_koordinator' || user?.role === 'invoice_saudi';

  const fetchData = useCallback(() => {
    setLoading(true);
    const ownerId = getProductListOwnerId(user);
    productsApi.list({
      type: 'haji_dakhili',
      with_prices: 'true',
      include_inactive: 'false',
      limit: 500,
      ...(ownerId ? { owner_id: ownerId } : {})
    }).then((res) => {
      const data = (res.data as { data?: HajiDakhiliProduct[] })?.data || [];
      setItems(Array.isArray(data) ? data : []);
    }).catch(() => setItems([])).finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    businessRulesApi.get().then((res) => {
      const data = (res.data as { data?: { currency_rates?: unknown } })?.data;
      let cr = data?.currency_rates;
      if (typeof cr === 'string') {
        try {
          cr = JSON.parse(cr) as { SAR_TO_IDR?: number; USD_TO_IDR?: number };
        } catch {
          cr = null;
        }
      }
      const rates = cr as { SAR_TO_IDR?: number; USD_TO_IDR?: number } | null;
      if (rates && typeof rates === 'object') {
        setCurrencyRates({ SAR_TO_IDR: rates.SAR_TO_IDR ?? 4200, USD_TO_IDR: rates.USD_TO_IDR ?? 15500 });
      }
    }).catch(() => {});
  }, []);

  const resetForm = () => {
    setForm({ name: '', description: '', price_idr: 0 });
  };

  const submitCreate = async () => {
    if (!form.name.trim()) return showToast('Nama produk wajib diisi', 'warning');
    setSaving(true);
    try {
      const created = await productsApi.create({
        type: 'haji_dakhili',
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        is_package: false
      });
      const productId = (created.data as { data?: { id?: string } })?.data?.id;
      if (productId && form.price_idr > 0) {
        await productsApi.createPrice({
          product_id: productId,
          branch_id: null,
          owner_id: null,
          currency: 'IDR',
          amount: form.price_idr
        });
      }
      showToast('Produk Haji Dakhili ditambahkan', 'success');
      setShowAdd(false);
      resetForm();
      fetchData();
    } catch (e: any) {
      showToast(e?.response?.data?.message || 'Gagal menambah produk Haji Dakhili', 'error');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (p: HajiDakhiliProduct) => {
    setEditing(p);
    setForm({
      name: p.name || '',
      description: p.description || '',
      price_idr: Number(p.price_general_idr ?? p.price_general ?? 0) || 0
    });
  };

  const submitEdit = async () => {
    if (!editing) return;
    if (!form.name.trim()) return showToast('Nama produk wajib diisi', 'warning');
    setSaving(true);
    try {
      await productsApi.update(editing.id, {
        name: form.name.trim(),
        description: form.description.trim() || null
      });
      const pricesRes = await productsApi.listPrices({ product_id: editing.id });
      const prices = (pricesRes.data as { data?: Array<{ id: string; branch_id: string | null; owner_id: string | null }> })?.data ?? [];
      const generalPrices = prices.filter((p) => !p.branch_id && !p.owner_id);
      for (const gp of generalPrices) await productsApi.deletePrice(gp.id);
      if (form.price_idr > 0) {
        await productsApi.createPrice({
          product_id: editing.id,
          branch_id: null,
          owner_id: null,
          currency: 'IDR',
          amount: form.price_idr
        });
      }
      showToast('Produk Haji Dakhili diperbarui', 'success');
      setEditing(null);
      resetForm();
      fetchData();
    } catch (e: any) {
      showToast(e?.response?.data?.message || 'Gagal memperbarui produk Haji Dakhili', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Haji Dakhili"
        subtitle="Kelola produk Haji Dakhili beserta harga."
        right={<AutoRefreshControl onRefresh={fetchData} disabled={loading} />}
      />

      <Card className="overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-800 font-semibold">
            <FileText className="w-4 h-4" /> Daftar produk Haji Dakhili
          </div>
          {isPusat && (
            <Button size="sm" onClick={() => { resetForm(); setShowAdd(true); }}>
              <Plus className="w-4 h-4 mr-1" /> Tambah produk
            </Button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left px-4 py-2">Kode</th>
                <th className="text-left px-4 py-2">Nama</th>
                <th className="text-right px-4 py-2">{PRICE_COLUMN_LABEL}</th>
                {(isPusat || canAddToOrder) && <th className="text-center px-4 py-2">Aksi</th>}
              </tr>
            </thead>
            <tbody>
              {!loading && items.length === 0 && (
                <tr><td className="px-4 py-4 text-slate-500" colSpan={(isPusat || canAddToOrder) ? 4 : 3}>Belum ada produk Haji Dakhili.</td></tr>
              )}
              {items.map((p) => (
                <tr key={p.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2 font-mono">{p.code}</td>
                  <td className="px-4 py-2">{p.name}</td>
                  <td className="px-4 py-2 text-right text-slate-800 align-top">
                    {(() => {
                      const priceIdr = Number(p.price_general_idr ?? p.price_general ?? 0) || 0;
                      const triple = fillFromSource('IDR', priceIdr, currencyRates);
                      const t = getPriceTripleForTable(priceIdr, triple.sar, triple.usd);
                      if (!t.hasPrice) return <span className="text-slate-400">–</span>;
                      return (
                        <>
                          <div className="tabular-nums font-medium">{t.idrText}</div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            <span className="text-slate-400">SAR:</span> {t.sarText}
                            <span className="text-slate-400 ml-1">USD:</span> {t.usdText}
                          </div>
                        </>
                      );
                    })()}
                  </td>
                  {(isPusat || canAddToOrder) && (
                    <td className="px-4 py-2 text-center">
                      <div className="inline-flex items-center gap-2">
                        {canAddToOrder && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const priceIdr = Number(p.price_general_idr ?? p.price_general ?? 0) || 0;
                              addDraftItem({
                                type: 'haji_dakhili',
                                product_id: p.id,
                                product_name: p.name,
                                unit_price_idr: priceIdr,
                                unit_price: priceIdr,
                                price_currency: 'IDR',
                                quantity: 1,
                                meta: {}
                              });
                              showToast('Haji Dakhili ditambahkan ke order.', 'success');
                            }}
                            title="Tambah ke order"
                            aria-label="Tambah ke order"
                          >
                            <ShoppingCart className="w-4 h-4" />
                          </Button>
                        )}
                        {isPusat && (
                          <Button size="sm" variant="outline" onClick={() => openEdit(p)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={showAdd} onClose={() => !saving && setShowAdd(false)}>
        <ModalBox>
          <ModalHeader title="Tambah produk Haji Dakhili" onClose={() => !saving && setShowAdd(false)} />
          <ModalBody className="space-y-3">
            <Input label="Nama" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            <Input label="Harga (IDR)" type="number" min={0} value={String(form.price_idr)} onChange={(e) => setForm((f) => ({ ...f, price_idr: Math.max(0, parseInt(e.target.value || '0', 10) || 0) }))} />
            <Input label="Deskripsi" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </ModalBody>
          <ModalFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)} disabled={saving}>Batal</Button>
            <Button onClick={submitCreate} disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan'}</Button>
          </ModalFooter>
        </ModalBox>
      </Modal>

      <Modal open={!!editing} onClose={() => !saving && setEditing(null)}>
        <ModalBox>
          <ModalHeader title="Edit produk Haji Dakhili" onClose={() => !saving && setEditing(null)} />
          <ModalBody className="space-y-3">
            <Input label="Nama" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            <Input label="Harga (IDR)" type="number" min={0} value={String(form.price_idr)} onChange={(e) => setForm((f) => ({ ...f, price_idr: Math.max(0, parseInt(e.target.value || '0', 10) || 0) }))} />
            <Input label="Deskripsi" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </ModalBody>
          <ModalFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>Batal</Button>
            <Button onClick={submitEdit} disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan'}</Button>
          </ModalFooter>
        </ModalBox>
      </Modal>
    </div>
  );
};

export default HajiDakhiliPage;

