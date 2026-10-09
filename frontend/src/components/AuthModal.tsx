import { useState } from 'react';
import { Sparkles, ShieldCheck, AlertCircle } from 'lucide-react';
import { api } from '../services/api';
import type { User } from '../services/api';

interface Props {
  isOpen: boolean;
  onSuccess: (user: User) => void;
  onClose?: () => void;
}

export const AuthModal: React.FC<Props> = ({ isOpen, onSuccess }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const getCleanErrorMessage = (err: any): string => {
    if (!err) return 'An error occurred';
    if (typeof err === 'string') return err;
    if (err.message && typeof err.message === 'string') return err.message;
    if (typeof err === 'object') {
      try {
        return JSON.stringify(err);
      } catch {
        return 'Authentication failed';
      }
    }
    return String(err);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isRegister) {
        const res = await api.register(username, email, password);
        onSuccess(res.user);
      } else {
        const res = await api.login(username, password);
        onSuccess(res.user);
      }
    } catch (err: any) {
      setError(getCleanErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      try {
        const res = await api.login('demo_user', 'demopass123');
        onSuccess(res.user);
      } catch (loginErr: any) {
        // If login failed, try registering demo_user
        try {
          const res = await api.register('demo_user', 'demo@spendwise.app', 'demopass123');
          onSuccess(res.user);
        } catch {
          // If register also failed, present the original login failure message
          throw loginErr;
        }
      }
    } catch (err: any) {
      setError(getCleanErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" id="auth-modal-overlay">
      <div className="modal-content" style={{ maxWidth: '440px' }} id="auth-modal">
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: '16px',
              background: 'linear-gradient(135deg, var(--primary) 0%, hsl(265, 80%, 60%) 100%)',
              color: '#fff',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 24px var(--primary-glow)',
              marginBottom: '12px',
            }}
          >
            <ShieldCheck size={28} />
          </div>
          <h2 style={{ fontSize: '22px', fontWeight: 800 }}>
            {isRegister ? 'Create Your Account' : 'Welcome to SpendWise'}
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
            {isRegister
              ? 'Start tracking multi-currency personal spending with budget alerts'
              : 'Sign in to access your personal expenses and category budgets'}
          </p>
        </div>

        {/* Quick Demo Access Button */}
        <button
          type="button"
          className="btn btn-secondary"
          onClick={handleDemoLogin}
          disabled={loading}
          id="quick-demo-login-btn"
          style={{
            width: '100%',
            marginBottom: '20px',
            border: '1px solid hsla(243, 85%, 68%, 0.4)',
            background: 'hsla(243, 75%, 59%, 0.1)',
            color: 'var(--primary-light)',
          }}
        >
          <Sparkles size={16} />
          <span>One-Click Instant Demo Login</span>
        </button>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            margin: '16px 0',
            color: 'var(--text-muted)',
            fontSize: '12px',
          }}
        >
          <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
          <span>OR SIGN IN WITH CREDENTIALS</span>
          <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
        </div>

        {error && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm)',
              background: 'hsla(350, 89%, 60%, 0.15)',
              border: '1px solid hsla(350, 89%, 60%, 0.35)',
              color: 'var(--danger)',
              fontSize: '13px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              lineHeight: 1.4,
            }}
            id="auth-error-message"
          >
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{typeof error === 'string' ? error : JSON.stringify(error)}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} id="auth-form">
          <div className="form-group">
            <label className="form-label" htmlFor="auth-username-input">
              Username
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="auth-username-input"
                className="form-input"
                type="text"
                placeholder="e.g. john_doe"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
          </div>

          {isRegister && (
            <div className="form-group">
              <label className="form-label" htmlFor="auth-email-input">
                Email Address
              </label>
              <input
                id="auth-email-input"
                className="form-input"
                type="email"
                placeholder="john@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="auth-password-input">
              Password
            </label>
            <input
              id="auth-password-input"
              className="form-input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '10px', height: '44px' }}
            disabled={loading}
            id="auth-submit-btn"
          >
            {loading ? 'Processing...' : isRegister ? 'Register & Sign In' : 'Sign In'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px', color: 'var(--text-secondary)' }}>
          {isRegister ? 'Already have an account?' : "Don't have an account yet?"}{' '}
          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister);
              setError(null);
            }}
            id="toggle-auth-mode-btn"
            style={{ color: 'var(--primary-light)', fontWeight: 600 }}
          >
            {isRegister ? 'Sign In' : 'Register Now'}
          </button>
        </div>
      </div>
    </div>
  );
};
