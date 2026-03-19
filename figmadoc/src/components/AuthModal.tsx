import { useState } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { Icon } from './Icon';
import { isSupabaseConfigured } from '../lib/supabaseClient';

type View = 'login' | 'signup' | 'magic-link' | 'check-email';

export function AuthModal({ onClose }: { onClose: () => void }) {
  const [view, setView] = useState<View>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { signInWithEmail, signInWithMagicLink, signUp, signOut, status, user } = useAuthStore();

  const wrap = async (fn: () => Promise<void>) => {
    setError(null);
    setLoading(true);
    try {
      await fn();
      if (view !== 'magic-link') onClose();
      else setView('check-email');
    } catch (err) {
      setError((err as Error).message ?? 'Erro inesperado.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = () => wrap(() => signInWithEmail(email, password));
  const handleSignUp = () => {
    if (password !== confirmPassword) { setError('As senhas não coincidem.'); return; }
    wrap(() => signUp(email, password));
  };
  const handleMagicLink = () => wrap(() => signInWithMagicLink(email));
  const handleSignOut = () => { signOut(); onClose(); };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: 40,
    borderRadius: 10,
    border: '1px solid var(--border-color)',
    background: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    padding: '0 12px',
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box',
  };

  const btnStyle: React.CSSProperties = {
    width: '100%',
    height: 40,
    borderRadius: 10,
    border: 'none',
    background: 'var(--primary)',
    color: 'var(--primary-contrast)',
    fontSize: 13,
    fontWeight: 700,
    cursor: loading ? 'wait' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    opacity: loading ? 0.7 : 1,
  };

  const linkStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    color: 'var(--primary)',
    fontSize: 12,
    cursor: 'pointer',
    padding: 0,
    textDecoration: 'underline',
  };

  return (
    <>
      <div
        style={{ position: 'fixed', inset: 0, background: 'var(--backdrop)', zIndex: 1300 }}
        onClick={onClose}
      />
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 380,
          borderRadius: 18,
          border: '1px solid var(--border-color)',
          background: 'var(--bg-elevated)',
          boxShadow: 'var(--shadow-lg)',
          zIndex: 1301,
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Conta
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
              {status === 'authenticated' ? 'Conectado' : view === 'login' ? 'Entrar' : view === 'signup' ? 'Criar conta' : view === 'magic-link' ? 'Link mágico' : 'Verifique seu e-mail'}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ width: 34, height: 34, borderRadius: 10, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)' }}
          >
            <Icon name="close" size={19} />
          </button>
        </div>

        <div style={{ padding: '20px 18px', display: 'grid', gap: 14 }}>
          {!isSupabaseConfigured && (
            <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', fontSize: 12, color: '#ef4444', lineHeight: 1.6 }}>
              <strong>Supabase não configurado.</strong> Adicione <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code> no arquivo <code>.env.local</code>.
            </div>
          )}

          {/* Logged in view */}
          {status === 'authenticated' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, background: 'var(--bg-tertiary)' }}>
                <Icon name="account_circle" size={32} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{user?.email}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Conta conectada à nuvem</div>
                </div>
              </div>
              <button style={{ ...btnStyle, background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }} onClick={handleSignOut}>
                <Icon name="logout" size={16} />
                Sair
              </button>
            </>
          )}

          {/* Check email view */}
          {status !== 'authenticated' && view === 'check-email' && (
            <div style={{ textAlign: 'center', padding: '10px 0', display: 'grid', gap: 12 }}>
              <Icon name="mark_email_read" size={48} style={{ color: 'var(--primary)', margin: '0 auto' }} />
              <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 600 }}>Verifique seu e-mail</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                Enviamos um link de acesso para <strong>{email}</strong>. Clique no link para entrar automaticamente.
              </div>
              <button style={linkStyle} onClick={() => setView('login')}>Voltar ao login</button>
            </div>
          )}

          {/* Login form */}
          {status !== 'authenticated' && view === 'login' && (
            <>
              <input style={inputStyle} type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
              <input style={inputStyle} type="password" placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSignIn()} />
              {error && <div style={{ fontSize: 12, color: '#ef4444', lineHeight: 1.5 }}>{error}</div>}
              <button style={btnStyle} onClick={handleSignIn} disabled={loading}>
                {loading ? <Icon name="sync" size={16} className="spin" /> : <Icon name="login" size={16} />}
                Entrar
              </button>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button style={linkStyle} onClick={() => { setView('magic-link'); setError(null); }}>Entrar sem senha</button>
                <button style={linkStyle} onClick={() => { setView('signup'); setError(null); }}>Criar conta</button>
              </div>
            </>
          )}

          {/* Sign up form */}
          {status !== 'authenticated' && view === 'signup' && (
            <>
              <input style={inputStyle} type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
              <input style={inputStyle} type="password" placeholder="Senha (mín. 6 caracteres)" value={password} onChange={(e) => setPassword(e.target.value)} />
              <input style={inputStyle} type="password" placeholder="Confirmar senha" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSignUp()} />
              {error && <div style={{ fontSize: 12, color: '#ef4444', lineHeight: 1.5 }}>{error}</div>}
              <button style={btnStyle} onClick={handleSignUp} disabled={loading}>
                {loading ? <Icon name="sync" size={16} className="spin" /> : <Icon name="person_add" size={16} />}
                Criar conta
              </button>
              <div style={{ textAlign: 'center' }}>
                <button style={linkStyle} onClick={() => { setView('login'); setError(null); }}>Já tenho conta</button>
              </div>
            </>
          )}

          {/* Magic link form */}
          {status !== 'authenticated' && view === 'magic-link' && (
            <>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                Digite seu e-mail e enviaremos um link para acessar sua conta sem senha.
              </div>
              <input style={inputStyle} type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus onKeyDown={(e) => e.key === 'Enter' && handleMagicLink()} />
              {error && <div style={{ fontSize: 12, color: '#ef4444', lineHeight: 1.5 }}>{error}</div>}
              <button style={btnStyle} onClick={handleMagicLink} disabled={loading}>
                {loading ? <Icon name="sync" size={16} className="spin" /> : <Icon name="mail" size={16} />}
                Enviar link
              </button>
              <div style={{ textAlign: 'center' }}>
                <button style={linkStyle} onClick={() => { setView('login'); setError(null); }}>Voltar ao login</button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
