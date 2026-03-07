import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FileText, User, ArrowRight, ArrowLeft } from 'lucide-react';

const DARK = '#0a0f1e';
const MUTED = '#475569';
const SKY = '#38bdf8';

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
  .ty-card { animation: cardIn .5s cubic-bezier(.22,1,.36,1) both; }
  .ty-opt  { animation: fadeUp .45s cubic-bezier(.22,1,.36,1) both; }
  .ty-opt-1 { animation-delay:.1s; }
  .ty-opt-2 { animation-delay:.2s; }
  @keyframes cardIn {
    from { opacity:0; transform:translateY(24px) scale(.98); }
    to   { opacity:1; transform:translateY(0) scale(1); }
  }
  @keyframes fadeUp {
    from { opacity:0; transform:translateY(12px); }
    to   { opacity:1; transform:translateY(0); }
  }
  .ty-opt-card {
    transition: transform .2s, box-shadow .2s, border-color .2s;
  }
  .ty-opt-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 40px rgba(56,189,248,0.15);
    border-color: rgba(56,189,248,0.35);
  }
  .blob { filter:blur(90px); position:absolute; border-radius:50%; pointer-events:none; }
  .grid-bg {
    background-image:
      linear-gradient(rgba(56,189,248,0.04) 1px,transparent 1px),
      linear-gradient(90deg,rgba(56,189,248,0.04) 1px,transparent 1px);
    background-size: 48px 48px;
  }
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

  return (
    <div
      className="grid-bg"
      style={{
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: DARK,
        padding: '24px 16px',
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Background blobs */}
      <div className="blob" style={{ width: 400, height: 400, left: '-5%', top: '-10%', background: 'rgba(37,99,235,0.2)' }} />
      <div className="blob" style={{ width: 320, height: 320, right: '-4%', bottom: '10%', background: 'rgba(56,189,248,0.15)' }} />

      <div className="ty-card" style={{ position: 'relative', width: '100%', maxWidth: 560, zIndex: 10 }}>
        <div
          style={{
            position: 'absolute',
            inset: -1,
            borderRadius: 20,
            pointerEvents: 'none',
            background: 'linear-gradient(135deg,rgba(56,189,248,0.25) 0%,rgba(37,99,235,0.1) 50%,rgba(79,70,229,0.2) 100%)'
          }}
        />
        <div
          style={{
            position: 'relative',
            borderRadius: 19,
            padding: '32px 28px',
            background: 'rgba(8,13,30,0.94)',
            backdropFilter: 'blur(24px)',
            border: '1px solid rgba(56,189,248,0.12)'
          }}
        >
          <Link
            to="/login"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
              color: MUTED,
              textDecoration: 'none',
              marginBottom: 20
            }}
          >
            <ArrowLeft size={16} /> Kembali ke Login
          </Link>

          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'white', margin: '0 0 8px' }}>
            Daftar sebagai Partner Owner
          </h1>
          <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.6, margin: '0 0 28px' }}>
            Pilih jenis pendaftaran sesuai kesepakatan Anda dengan Bintang Global Group. Setelah memilih, Anda akan diarahkan ke form registrasi.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Owner MOU */}
            <button
              type="button"
              onClick={() => handleChoose('mou')}
              className="ty-opt ty-opt-1 ty-opt-card"
              style={{
                textAlign: 'left',
                padding: '20px 20px',
                borderRadius: 14,
                border: '1.5px solid rgba(56,189,248,0.2)',
                background: 'rgba(56,189,248,0.06)',
                cursor: 'pointer',
                color: 'white',
                fontFamily: 'inherit'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    background: 'rgba(34,197,94,0.15)',
                    border: '1px solid rgba(34,197,94,0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  <FileText size={24} color="#22c55e" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'white', marginBottom: 4 }}>
                    Owner MOU
                  </div>
                  <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.5 }}>
                    Mitra dengan perjanjian MOU. Mendapat harga produk lebih murah (diskon sesuai ketentuan).
                  </div>
                </div>
                <ArrowRight size={20} color={SKY} style={{ flexShrink: 0, marginTop: 4 }} />
              </div>
            </button>

            {/* Owner Non-MOU */}
            <button
              type="button"
              onClick={() => handleChoose('non_mou')}
              className="ty-opt ty-opt-2 ty-opt-card"
              style={{
                textAlign: 'left',
                padding: '20px 20px',
                borderRadius: 14,
                border: '1.5px solid rgba(56,189,248,0.2)',
                background: 'rgba(56,189,248,0.06)',
                cursor: 'pointer',
                color: 'white',
                fontFamily: 'inherit'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    background: 'rgba(100,116,139,0.2)',
                    border: '1px solid rgba(100,116,139,0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  <User size={24} color="#94a3b8" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'white', marginBottom: 4 }}>
                    Owner Non-MOU
                  </div>
                  <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.5 }}>
                    Mitra tanpa MOU. Harga produk mengikuti tarif standar.
                  </div>
                </div>
                <ArrowRight size={20} color={SKY} style={{ flexShrink: 0, marginTop: 4 }} />
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterOwnerTypePage;
