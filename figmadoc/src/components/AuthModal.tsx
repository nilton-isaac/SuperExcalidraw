import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

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
    if (password !== confirmPassword) {
      setError('As senhas nao coincidem.');
      return;
    }
    wrap(() => signUp(email, password));
  };
  const handleMagicLink = () => wrap(() => signInWithMagicLink(email));
  const handleSignOut = () => {
    signOut();
    onClose();
  };

  const title =
    status === 'authenticated'
      ? 'Conta conectada'
      : view === 'login'
        ? 'Entrar'
        : view === 'signup'
          ? 'Criar conta'
          : view === 'magic-link'
            ? 'Link magico'
            : 'Verifique seu e-mail';

  const subtitle =
    status === 'authenticated'
      ? 'Gerencie o acesso da sua conta cloud em um dialogo dedicado.'
      : 'Acesse a nuvem do Synth em um modal centralizado.';

  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: 46,
    borderRadius: 14,
    border: '1px solid color-mix(in srgb, var(--border-color) 92%, white)',
    background: 'color-mix(in srgb, var(--bg-primary) 94%, white)',
    color: 'var(--text-primary)',
    padding: '0 14px',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
  };

  const primaryButtonStyle: React.CSSProperties = {
    width: '100%',
    height: 46,
    borderRadius: 14,
    border: 'none',
    background: 'linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 68%, #7dd3fc))',
    color: 'var(--primary-contrast)',
    fontSize: 14,
    fontWeight: 700,
    cursor: loading ? 'wait' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    opacity: loading ? 0.78 : 1,
    boxShadow: '0 18px 36px color-mix(in srgb, var(--primary) 24%, transparent)',
  };

  const secondaryButtonStyle: React.CSSProperties = {
    ...primaryButtonStyle,
    background: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-color)',
    boxShadow: 'none',
  };

  const linkStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    color: 'var(--primary)',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    padding: 0,
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        display: 'grid',
        placeItems: 'center',
        padding:
          'max(20px, calc(var(--safe-area-top) + 20px)) max(20px, calc(var(--safe-area-right) + 20px)) max(20px, calc(var(--safe-area-bottom) + 20px)) max(20px, calc(var(--safe-area-left) + 20px))',
      }}
      aria-modal="true"
      role="dialog"
      aria-labelledby="auth-modal-title"
    >
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(circle at top, rgba(15, 23, 42, 0.16), rgba(15, 23, 42, 0.58))',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
        }}
      />

      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          position: 'relative',
          width: 'min(460px, calc(100vw - 40px - var(--safe-area-left) - var(--safe-area-right)))',
          maxHeight: 'min(720px, calc(100dvh - 40px - var(--safe-area-top) - var(--safe-area-bottom)))',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderRadius: 28,
          border: '1px solid color-mix(in srgb, var(--border-color) 82%, white)',
          background:
            'linear-gradient(180deg, color-mix(in srgb, var(--bg-elevated) 96%, white), color-mix(in srgb, var(--bg-elevated) 92%, transparent))',
          boxShadow: '0 40px 120px rgba(15, 23, 42, 0.3)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 16,
            padding: '24px 24px 16px',
            borderBottom: '1px solid color-mix(in srgb, var(--border-color) 88%, white)',
            background:
              'linear-gradient(180deg, color-mix(in srgb, var(--bg-secondary) 92%, white), transparent)',
          }}
        >
          <div style={{ display: 'grid', gap: 8 }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 11,
                fontWeight: 800,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  background: 'var(--primary)',
                  boxShadow: '0 0 18px color-mix(in srgb, var(--primary) 55%, transparent)',
                }}
              />
              Conta Synth
            </div>
            <div id="auth-modal-title" style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>
              {title}
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)', maxWidth: 320 }}>
              {subtitle}
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Fechar"
            style={{
              width: 38,
              height: 38,
              borderRadius: 999,
              border: '1px solid var(--border-color)',
              background: 'color-mix(in srgb, var(--bg-primary) 82%, white)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-primary)',
              flexShrink: 0,
            }}
          >
            <Icon name="close" size={19} />
          </button>
        </div>

        <div style={{ padding: '20px 24px 24px', display: 'grid', gap: 16, overflowY: 'auto' }}>
          {!isSupabaseConfigured && (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 14,
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.28)',
                fontSize: 12,
                color: '#ef4444',
                lineHeight: 1.6,
              }}
            >
              <strong>Supabase nao configurado.</strong> Adicione <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code> no arquivo <code>.env.local</code>.
            </div>
          )}

          {status === 'authenticated' && (
            <>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '14px 16px',
                  borderRadius: 16,
                  background: 'linear-gradient(180deg, var(--bg-tertiary), color-mix(in srgb, var(--bg-tertiary) 88%, white))',
                  border: '1px solid color-mix(in srgb, var(--border-color) 88%, white)',
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 14,
                    display: 'grid',
                    placeItems: 'center',
                    background: 'color-mix(in srgb, var(--primary) 14%, white)',
                    color: 'var(--primary)',
                    flexShrink: 0,
                  }}
                >
                  <Icon name="account_circle" size={28} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{user?.email}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Conta conectada a nuvem</div>
                </div>
              </div>

              <button style={secondaryButtonStyle} onClick={handleSignOut}>
                <Icon name="logout" size={16} />
                Sair
              </button>
            </>
          )}

          {status !== 'authenticated' && view === 'check-email' && (
            <div style={{ textAlign: 'center', padding: '8px 4px', display: 'grid', gap: 14 }}>
              <div
                style={{
                  width: 68,
                  height: 68,
                  borderRadius: 20,
                  margin: '0 auto',
                  display: 'grid',
                  placeItems: 'center',
                  background: 'color-mix(in srgb, var(--primary) 12%, white)',
                  color: 'var(--primary)',
                }}
              >
                <Icon name="mark_email_read" size={34} />
              </div>
              <div style={{ fontSize: 16, color: 'var(--text-primary)', fontWeight: 700 }}>Verifique seu e-mail</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                Enviamos um link de acesso para <strong>{email}</strong>. Clique no link para entrar automaticamente.
              </div>
              <button style={linkStyle} onClick={() => setView('login')}>
                Voltar ao login
              </button>
            </div>
          )}

          {status !== 'authenticated' && view === 'login' && (
            <>
              <div style={{ display: 'grid', gap: 12 }}>
                <input
                  style={inputStyle}
                  type="email"
                  placeholder="E-mail"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoFocus
                />
                <input
                  style={inputStyle}
                  type="password"
                  placeholder="Senha"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  onKeyDown={(event) => event.key === 'Enter' && handleSignIn()}
                />
              </div>
              {error && <div style={{ fontSize: 12, color: '#ef4444', lineHeight: 1.5 }}>{error}</div>}
              <button style={primaryButtonStyle} onClick={handleSignIn} disabled={loading}>
                {loading ? <Icon name="sync" size={16} className="spin" /> : <Icon name="login" size={16} />}
                Entrar
              </button>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <button
                  style={linkStyle}
                  onClick={() => {
                    setView('magic-link');
                    setError(null);
                  }}
                >
                  Entrar sem senha
                </button>
                <button
                  style={linkStyle}
                  onClick={() => {
                    setView('signup');
                    setError(null);
                  }}
                >
                  Criar conta
                </button>
              </div>
            </>
          )}

          {status !== 'authenticated' && view === 'signup' && (
            <>
              <div style={{ display: 'grid', gap: 12 }}>
                <input
                  style={inputStyle}
                  type="email"
                  placeholder="E-mail"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoFocus
                />
                <input
                  style={inputStyle}
                  type="password"
                  placeholder="Senha (min. 6 caracteres)"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <input
                  style={inputStyle}
                  type="password"
                  placeholder="Confirmar senha"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  onKeyDown={(event) => event.key === 'Enter' && handleSignUp()}
                />
              </div>
              {error && <div style={{ fontSize: 12, color: '#ef4444', lineHeight: 1.5 }}>{error}</div>}
              <button style={primaryButtonStyle} onClick={handleSignUp} disabled={loading}>
                {loading ? <Icon name="sync" size={16} className="spin" /> : <Icon name="person_add" size={16} />}
                Criar conta
              </button>
              <div style={{ textAlign: 'center' }}>
                <button
                  style={linkStyle}
                  onClick={() => {
                    setView('login');
                    setError(null);
                  }}
                >
                  Ja tenho conta
                </button>
              </div>
            </>
          )}

          {status !== 'authenticated' && view === 'magic-link' && (
            <>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                Digite seu e-mail e enviaremos um link para acessar sua conta sem senha.
              </div>
              <input
                style={inputStyle}
                type="email"
                placeholder="E-mail"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoFocus
                onKeyDown={(event) => event.key === 'Enter' && handleMagicLink()}
              />
              {error && <div style={{ fontSize: 12, color: '#ef4444', lineHeight: 1.5 }}>{error}</div>}
              <button style={primaryButtonStyle} onClick={handleMagicLink} disabled={loading}>
                {loading ? <Icon name="sync" size={16} className="spin" /> : <Icon name="mail" size={16} />}
                Enviar link
              </button>
              <div style={{ textAlign: 'center' }}>
                <button
                  style={linkStyle}
                  onClick={() => {
                    setView('login');
                    setError(null);
                  }}
                >
                  Voltar ao login
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
