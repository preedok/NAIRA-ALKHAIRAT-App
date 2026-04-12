import React, { useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FileText, User, ArrowRight, ArrowLeft } from 'lucide-react';
import { AuthSplitLayout, AuthBrandLogoRow } from './AuthSplitLayout';

const STYLES = `
  @keyframes cardIn {
    from { opacity:0; transform:translateY(20px) scale(.98); }
    to   { opacity:1; transform:translateY(0) scale(1); }
  }
  .ty-card-in { animation: cardIn .45s cubic-bezier(.22,1,.36,1) both; }
`;

const RegisterOwnerTypePage: React.FC = () => {
  const navigate = useNavigate();
  const injected = useRef(false);

  useEffect(() => {
    if (!injected.current) {
      injected.current = true;
      const s = document.createElement('style');
      s.innerHTML = STYLES;
      document.head.appendChild(s);
    }
  }, []);

  const handleChoose = (type: 'mou' | 'non_mou') => {
    navigate(`/register?type=${type}`);
  };

  const optBtn =
    'ty-card-in w-full text-left rounded-xl border-2 border-slate-200 bg-white p-5 flex gap-4 items-start ' +
    'hover:border-[#0D1A63]/30 hover:shadow-md hover:bg-slate-50/80 transition-all cursor-pointer group';

  return (
    <AuthSplitLayout
      panelTitle="Dua jalur mitra, satu layanan profesional."
      panelSubtitle="MOU atau non-MOU — keduanya terintegrasi dengan tim koordinator dan tarif produk yang transparan."
      panelFooterLink={{ to: '/login', label: 'Kembali ke login →' }}
    >
      <AuthBrandLogoRow />

      <Link
        to="/login"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-[#0D1A63] mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Kembali ke login
      </Link>

      <h1 className="text-2xl sm:text-[1.65rem] font-bold text-slate-900 tracking-tight">Daftar sebagai Partner Owner</h1>
      <p className="text-sm text-slate-500 mt-2 mb-8 max-w-md leading-relaxed">
        Pilih jenis pendaftaran sesuai kesepakatan Anda dengan Bintang Global Group. Setelah memilih, Anda akan diarahkan ke form registrasi.
      </p>

      <div className="flex flex-col gap-4">
        <button type="button" onClick={() => handleChoose('mou')} className={optBtn}>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
            <FileText className="w-6 h-6 text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-base font-bold text-slate-900 group-hover:text-[#0D1A63]">Owner MOU</div>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Mitra dengan perjanjian MOU. Mendapat harga produk lebih murah (diskon sesuai ketentuan).
            </p>
          </div>
          <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-[#0D1A63] shrink-0 mt-1" />
        </button>

        <button type="button" onClick={() => handleChoose('non_mou')} className={optBtn} style={{ animationDelay: '0.08s' }}>
          <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
            <User className="w-6 h-6 text-slate-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-base font-bold text-slate-900 group-hover:text-[#0D1A63]">Owner Non-MOU</div>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">Mitra tanpa MOU. Harga produk mengikuti tarif standar.</p>
          </div>
          <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-[#0D1A63] shrink-0 mt-1" />
        </button>
      </div>
    </AuthSplitLayout>
  );
};

export default RegisterOwnerTypePage;
