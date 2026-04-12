import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import {
  Mail, Lock, User, Phone, Building2,
  MapPin, FileText, ArrowRight, Upload,
  CheckCircle, AlertCircle,
} from 'lucide-react';
import { ownersApi, branchesApi, businessRulesApi, type Branch } from '../../services/api';
import { validateEmail } from '../../utils';
import { AUTOCOMPLETE_PILIH } from '../../utils/constants';
import Input from '../../components/common/Input';
import Autocomplete from '../../components/common/Autocomplete';
import { AuthSplitLayout, AuthBrandLogoRow } from './AuthSplitLayout';

const PRIMARY = '#0D1A63';

/* ─── Styles (form terang, selaras halaman login) ─────────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

  @keyframes fadeUp {
    from { opacity:0; transform:translateY(12px); }
    to   { opacity:1; transform:translateY(0);    }
  }
  @keyframes errIn {
    from { opacity:0; transform:translateY(-6px); max-height:0; }
    to   { opacity:1; transform:translateY(0);    max-height:80px; }
  }
  @keyframes spin { to { transform:rotate(360deg); } }

  .fu         { animation:fadeUp .5s cubic-bezier(.22,1,.36,1) both; }
  .fu-1       { animation-delay:.08s; }
  .fu-2       { animation-delay:.16s; }
  .fu-3       { animation-delay:.24s; }

  .err-msg { animation:errIn .25s ease-out both; overflow:hidden; }

  .rg-scroll::-webkit-scrollbar { width:4px; }
  .rg-scroll::-webkit-scrollbar-track { background:transparent; }
  .rg-scroll::-webkit-scrollbar-thumb { background:rgba(13,26,99,0.22); border-radius:99px; }

  /* Blok section rata dengan halaman login (tanpa kartu kedua) */
  .rg-section {
    padding:0;
    margin:0 0 1.5rem 0;
    background:transparent;
    border:none;
  }
  .rg-section-title {
    font-size:11px; font-weight:700; letter-spacing:.12em;
    text-transform:uppercase; color:#64748b; margin-bottom:14px;
    display:flex; align-items:center; gap:10px;
  }
  .rg-section-title::before {
    content:''; width:3px; height:14px; border-radius:2px;
    background:linear-gradient(180deg,#0D1A63,#152a7a);
  }

  .branch-info {
    margin-top:8px; padding:10px 12px; border-radius:10px;
    background:#eff6ff; border:1px solid #dbeafe;
    font-size:12px; color:#475569; line-height:1.6;
  }

  .rg-spinner {
    width:15px; height:15px; border-radius:50%;
    border:2px solid rgba(255,255,255,0.35); border-top-color:white;
    animation:spin .75s linear infinite; flex-shrink:0;
  }

  .rg-form-row-3 {
    display:grid; grid-template-columns:repeat(3,1fr); gap:14px 16px;
  }
  .rg-form-row-2 {
    display:grid; grid-template-columns:repeat(2,1fr); gap:14px 16px;
  }
  .rg-form-row-1 { display:flex; flex-direction:column; gap:14px; }
  @media (max-width:768px) {
    .rg-form-row-3 { grid-template-columns:repeat(2,1fr); }
    .rg-form-row-2 { grid-template-columns:1fr; }
  }
  @media (max-width:520px) {
    .rg-form-row-3 { grid-template-columns:1fr; }
  }
`;

interface DropdownOption { value: string; label: string; sub?: string; }

/* ─── RegisterPage ───────────────────────────────────────────────── */
const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ownerType = searchParams.get('type'); // 'mou' | 'non_mou' | null
  const [branches, setBranches]          = useState<Branch[]>([]);
  const [, setBranchLoad]                = useState(true);
  const [form, setForm] = useState({
    name: '', email: '', password: '', phone: '',
    company_name: '', address: '', preferred_branch_id: '',
    operational_region: '', whatsapp: '', npwp: '',
    registration_payment_amount: '',
  });
  const [registrationPaymentFile, setRegistrationPaymentFile] = useState<File | null>(null);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const injected = useRef(false);
  const paymentFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!injected.current) {
      injected.current = true;
      const s = document.createElement('style');
      s.innerHTML = STYLES;
      document.head.appendChild(s);
    }
    branchesApi.listPublic({ limit: 600 })
      .then(res => { if (res.data?.data) setBranches(res.data.data); })
      .catch(() => {})
      .finally(() => setBranchLoad(false));
  }, []);

  useEffect(() => {
    if (ownerType === 'mou') {
      businessRulesApi.getPublic()
        .then(res => {
          if (res.data?.success && res.data?.data?.registration_deposit_idr != null) {
            const amount = Number(res.data.data.registration_deposit_idr);
            if (Number.isFinite(amount) && amount > 0) {
              setForm(f => ({ ...f, registration_payment_amount: String(amount) }));
            }
          }
        })
        .catch(() => {});
    }
  }, [ownerType]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
    if (error) setError('');
  };

  const handleBranchChange = (val: string) => {
    const b = branches.find(x => x.id === val);
    setForm(f => ({ ...f, preferred_branch_id: val, operational_region: b?.region || f.operational_region }));
    if (error) setError('');
  };

  const selectedBranch = form.preferred_branch_id
    ? branches.find(b => b.id === form.preferred_branch_id)
    : null;

  const branchOptions: DropdownOption[] = branches.map(b => ({
    value: b.id,
    label: b.name,
    sub: b.region,
  }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim())  { setError('Nama wajib diisi'); return; }
    if (!form.email.trim()) { setError('Email wajib diisi'); return; }
    const emailErr = validateEmail(form.email);
    if (emailErr)           { setError(emailErr); return; }
    if (!form.password || form.password.length < 6) { setError('Password minimal 6 karakter'); return; }
    if (!form.phone.trim()) { setError('Telepon wajib diisi'); return; }
    if (!form.whatsapp.trim()) { setError('WhatsApp wajib diisi'); return; }
    if (!form.company_name.trim()) { setError('Nama perusahaan / travel wajib diisi'); return; }
    if (!form.address.trim()) { setError('Alamat kantor wajib diisi'); return; }
    if (!form.preferred_branch_id) { setError('Kota operasional wajib dipilih'); return; }
    const isMou = ownerType === 'mou';
    if (isMou) {
      const amountNum = parseFloat(String(form.registration_payment_amount).replace(/[^\d.-]/g, ''));
      if (!Number.isFinite(amountNum) || amountNum <= 0) { setError('Jumlah pembayaran MoU wajib diisi dan harus lebih dari 0'); return; }
      if (!registrationPaymentFile) { setError('Bukti bayar MoU wajib diupload'); return; }
    }

    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('name', form.name.trim());
      fd.append('email', form.email.trim().toLowerCase());
      fd.append('password', form.password);
      if (form.phone.trim()) fd.append('phone', form.phone.trim());
      if (form.company_name.trim()) fd.append('company_name', form.company_name.trim());
      if (form.address.trim()) fd.append('address', form.address.trim());
      if (form.operational_region.trim()) fd.append('operational_region', form.operational_region.trim());
      if (form.preferred_branch_id) fd.append('preferred_branch_id', form.preferred_branch_id);
      fd.append('whatsapp', (form.whatsapp.trim() || form.phone.trim()) || '');
      if (form.npwp.trim()) fd.append('npwp', form.npwp.trim());
      if (isMou) {
        const amountNum = parseFloat(String(form.registration_payment_amount).replace(/[^\d.-]/g, ''));
        fd.append('registration_payment_amount', String(amountNum));
        if (registrationPaymentFile) fd.append('registration_payment_file', registrationPaymentFile);
      }
      fd.append('is_mou_owner', isMou ? 'true' : 'false');
      await ownersApi.register(fd);
      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Registrasi gagal. Coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  /* ── Redirect: no type or invalid type ── */
  if (ownerType !== 'mou' && ownerType !== 'non_mou') {
    return null;
  }

  /* ── Success screen ── */
  if (success) {
    return (
      <div
        className="min-h-screen w-full bg-slate-100 flex items-center justify-center p-4 sm:p-6"
        style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
      >
        <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-slate-200/80 p-8 sm:p-10 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto mb-5">
            <CheckCircle className="w-8 h-8 text-emerald-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-3">Registrasi berhasil</h2>
          <p className="text-sm text-slate-600 leading-relaxed mb-8">
            Registrasi dan bukti bayar MoU Anda telah diterima. Admin Pusat akan memverifikasi bukti bayar dan mengaktifkan akun. Setelah akun diaktifkan, Anda dapat login dan mengakses seluruh fitur aplikasi serta akan mendapat surat MoU dan password baru dari sistem.
          </p>
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="w-full py-3 rounded-xl font-bold text-sm text-white inline-flex items-center justify-center gap-2 hover:brightness-110 transition-all"
            style={{ backgroundColor: '#0D1A63', boxShadow: '0 8px 24px rgba(13,26,99,0.2)' }}
          >
            Ke halaman login
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  /* ── Main ── */
  return (
    <AuthSplitLayout singleColumn singleColumnClassName="max-w-3xl w-full">
      <AuthBrandLogoRow />

      <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
        {ownerType === 'mou' ? 'Buat akun Owner MOU' : 'Buat akun Owner Non-MOU'}
      </h1>
      <p className="text-sm text-slate-500 mt-1.5 mb-3 max-w-2xl leading-relaxed">
        {ownerType === 'mou'
          ? 'Mitra dengan MOU — harga produk mengikuti ketentuan diskon mitra. Lengkapi form di bawah.'
          : 'Mitra tanpa MOU — harga standar. Lengkapi form di bawah; tidak ada pembayaran MoU di awal.'}
      </p>
      <p className="text-xs font-semibold mb-6">
        <Link to="/register-owner-type" className="text-slate-500 hover:text-[#0D1A63] hover:underline">
          ← Ganti jenis pendaftaran
        </Link>
      </p>

      {error && (
        <div
          className="err-msg flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 mb-4 text-sm text-red-700 bg-red-50 border border-red-100"
          role="alert"
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="rg-scroll fu fu-1 max-h-[min(72vh,calc(100vh-16rem))] overflow-y-auto -mr-1 pr-1">
        <form onSubmit={handleSubmit} className="space-y-6 pb-1">
            <div className="rg-section">
              <div className="rg-section-title">Informasi Akun</div>
              <div className="rg-form-row-3">
                <Input label="Nama Lengkap" name="name" value={form.name} onChange={handleChange} placeholder="Nama lengkap" icon={<User className="w-4 h-4 text-slate-400" />} required />
                <Input label="Email" name="email" type="email" value={form.email} onChange={handleChange} placeholder="email@travel.com" icon={<Mail className="w-4 h-4 text-slate-400" />} required />
                <Input label="Password" name="password" type="password" value={form.password} onChange={handleChange} placeholder="Min. 6 karakter" icon={<Lock className="w-4 h-4 text-slate-400" />} required />
              </div>
            </div>

            <div className="rg-section">
              <div className="rg-section-title">Informasi Kontak</div>
              <div className="rg-form-row-3">
                <Input label="Telepon" name="phone" type="tel" value={form.phone} onChange={handleChange} placeholder="+62 812 ..." icon={<Phone className="w-4 h-4 text-slate-400" />} required />
                <Input label="WhatsApp" name="whatsapp" type="tel" value={form.whatsapp} onChange={handleChange} placeholder="Nomor WhatsApp" icon={<Phone className="w-4 h-4 text-slate-400" />} required />
                <Input label="NPWP" name="npwp" value={form.npwp} onChange={handleChange} placeholder="Opsional" icon={<FileText className="w-4 h-4 text-slate-400" />} />
              </div>
            </div>

            <div className="rg-section">
              <div className="rg-section-title">Informasi Perusahaan</div>
              <div className="rg-form-row-3">
                <Input label="Nama Perusahaan / Travel" name="company_name" value={form.company_name} onChange={handleChange} placeholder="PT / CV / Nama travel" icon={<Building2 className="w-4 h-4 text-slate-400" />} required />
                <Input label="Alamat Kantor" name="address" value={form.address} onChange={handleChange} placeholder="Alamat kantor" icon={<MapPin className="w-4 h-4 text-slate-400" />} required />
                <div>
                  <Autocomplete
                    label="Kota Operasional *"
                    value={form.preferred_branch_id}
                    onChange={handleBranchChange}
                    options={branchOptions.map(b => ({ value: b.value, label: b.label }))}
                    placeholder={AUTOCOMPLETE_PILIH.PILIH_KABUPATEN}
                    emptyLabel={AUTOCOMPLETE_PILIH.PILIH_KABUPATEN}
                  />
                  {selectedBranch && (
                    <div className="branch-info">
                      <span>Provinsi: </span>
                      <span>{selectedBranch.region}</span>
                      {selectedBranch.koordinator_provinsi && (
                        <>
                          {' · '}
                          <span>Koord: </span>
                          <span>{selectedBranch.koordinator_provinsi}</span>
                          {selectedBranch.koordinator_provinsi_phone && (
                            <span> · {selectedBranch.koordinator_provinsi_phone}</span>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {ownerType === 'mou' && (
              <div className="rg-section">
                <div className="rg-section-title">Pembayaran MoU (wajib di awal pendaftaran)</div>
                <div className="rg-form-row-2">
                  <div>
                    <Input
                      label="Jumlah pembayaran (Rp)"
                      name="registration_payment_amount"
                      value={form.registration_payment_amount}
                      onChange={handleChange}
                      placeholder="Nominal dari Settings"
                      readOnly
                      icon={<FileText className="w-4 h-4 text-slate-400" />}
                    />
                    <p className="text-[11px] text-slate-500 mt-1.5 leading-snug">
                      Nominal dari Settings. Hanya Admin Pusat yang dapat mengubah di menu Settings.
                    </p>
                  </div>
                  <div>
                    <span className="block text-sm font-semibold text-slate-700 mb-2">
                      Bukti bayar MoU <span className="text-red-500">*</span>
                    </span>
                    <input
                      ref={paymentFileInputRef}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      className="hidden"
                      onChange={(e) => setRegistrationPaymentFile(e.target.files?.[0] || null)}
                    />
                    <button
                      type="button"
                      onClick={() => paymentFileInputRef.current?.click()}
                      className="w-full flex items-center gap-2 py-3 px-4 rounded-xl border-2 border-slate-200 bg-white text-left text-sm text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors"
                    >
                      <Upload className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="truncate">{registrationPaymentFile ? registrationPaymentFile.name : 'Pilih file (PDF / gambar)'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {ownerType === 'non_mou' && (
              <div className="rg-section rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3.5">
                <div className="rg-section-title !mb-2">Pendaftaran Non-MOU (gratis)</div>
                <p className="text-sm text-slate-600 leading-relaxed m-0">
                  Tidak ada pembayaran MoU. Akun Anda tetap akan divalidasi oleh Admin Pusat. Setelah disetujui dan diaktifkan, Anda dapat login dan menggunakan aplikasi.
                </p>
              </div>
            )}

            <div className="fu fu-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 mb-1">
              <p className="text-sm text-slate-600 leading-relaxed m-0">
                {ownerType === 'mou' ? (
                  <>
                    <strong className="text-slate-800">Alur aktivasi:</strong> Pembayaran MoU di awal (upload bukti). Admin Pusat memverifikasi dan mengaktifkan akun; setelah aktif Anda dapat login dan memakai seluruh fitur.
                  </>
                ) : (
                  <>
                    <strong className="text-slate-800">Alur aktivasi:</strong> Setelah mendaftar, Admin Pusat memvalidasi dan mengaktifkan akun Anda. Setelah diaktifkan, Anda dapat login dan memakai seluruh fitur.
                  </>
                )}
              </p>
            </div>

            <div className="fu fu-2 pt-1">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl font-bold text-sm text-white shadow-md transition-all disabled:opacity-70 disabled:cursor-not-allowed hover:brightness-110 active:scale-[0.99] inline-flex items-center justify-center gap-2"
                style={{ backgroundColor: PRIMARY, boxShadow: '0 8px 24px rgba(13,26,99,0.25)' }}
              >
                {loading ? (
                  <>
                    <span className="rg-spinner" />
                    Memproses…
                  </>
                ) : (
                  <>
                    Daftar sekarang
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
      </div>

      <p className="text-center text-sm text-slate-600 mt-8">
        Sudah punya akun?{' '}
        <Link to="/login" className="font-semibold hover:underline" style={{ color: PRIMARY }}>
          Masuk
        </Link>
      </p>
    </AuthSplitLayout>
  );
};

export default RegisterPage;