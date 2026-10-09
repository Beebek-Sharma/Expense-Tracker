import React, { useState } from 'react';
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isRegister) {
        const res = await api.register(username.trim(), email.trim(), password);
        onSuccess(res.user);
      } else {
        const res = await api.login(username.trim(), password);
        onSuccess(res.user);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoAccess = async () => {
    setError(null);
    setLoading(true);
    try {
      try {
        const res = await api.login('demo_user', 'demopass123');
        onSuccess(res.user);
      } catch {
        // If login fails, try auto-registering demo_user
        const res = await api.register('demo_user', 'demo@spendwise.app', 'demopass123');
        onSuccess(res.user);
      }
    } catch (err: any) {
      setError(err.message || 'Unable to connect to demo account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-base/90 backdrop-blur-md"
      role="dialog"
      id="auth-modal-overlay"
    >
      {/* Ambient Lighting Background */}
      <div className="absolute top-1/4 left-1/3 w-80 h-80 bg-secondary/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 w-80 h-80 bg-secondary-bright/15 rounded-full blur-[120px] pointer-events-none" />

      {/* Modal Dialog Card */}
      <div
        className="relative w-full max-w-md bg-surface-card border border-stroke-strong rounded-2xl shadow-[0_24px_50px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col z-10 animate-in fade-in zoom-in-95 duration-200"
        id="auth-modal"
      >
        {/* Luminescent Top Bar */}
        <div className="h-1 w-full bg-gradient-to-r from-secondary-light via-secondary to-[#5898A3]" />

        {/* Modal Header */}
        <div className="p-6 text-center border-b border-stroke-subtle flex flex-col items-center">
          <div className="w-12 h-12 rounded-2xl bg-accent-teal-subtle border border-secondary/40 flex items-center justify-center text-secondary-bright shadow-[0_0_16px_rgba(63,110,118,0.35)] mb-3">
            <span className="material-symbols-outlined text-2xl font-bold">account_balance_wallet</span>
          </div>
          <h2 className="font-headline-sm text-xl text-primary font-bold tracking-tight">
            SpendWise Financial OS
          </h2>
          <p className="font-caption-code text-xs text-on-surface-variant mt-1">
            Enterprise Telemetry & Multi-Currency Ledger
          </p>

          {/* Tab Switcher */}
          <div className="flex bg-surface-elevated p-1 rounded-lg border border-stroke-subtle mt-4 w-full">
            <button
              type="button"
              onClick={() => {
                setIsRegister(false);
                setError(null);
              }}
              className={`flex-1 py-1.5 rounded-md font-label-md text-xs font-semibold transition-all ${!isRegister ? 'bg-primary text-on-primary shadow-sm font-bold' : 'text-on-surface-variant hover:text-primary'}`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setIsRegister(true);
                setError(null);
              }}
              className={`flex-1 py-1.5 rounded-md font-label-md text-xs font-semibold transition-all ${isRegister ? 'bg-primary text-on-primary shadow-sm font-bold' : 'text-on-surface-variant hover:text-primary'}`}
            >
              Create Account
            </button>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-critical-crimson/15 border border-critical-crimson/40 text-critical-crimson p-3 rounded-lg text-xs font-semibold flex items-center gap-2">
              <span className="material-symbols-outlined text-base">error</span>
              <span>{error}</span>
            </div>
          )}

          {/* Username */}
          <div className="space-y-1">
            <label className="font-label-sm text-xs text-tertiary-light uppercase tracking-wider block" htmlFor="auth-username">
              Username
            </label>
            <div className="relative flex items-center">
              <span className="material-symbols-outlined text-tertiary text-base absolute left-3 pointer-events-none">
                person
              </span>
              <input
                id="auth-username"
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. alex_rivers"
                className="w-full bg-surface-elevated text-primary text-xs pl-9 pr-3 py-2.5 rounded-lg border border-stroke-subtle focus:border-secondary focus:outline-none"
              />
            </div>
          </div>

          {/* Email (only on register) */}
          {isRegister && (
            <div className="space-y-1">
              <label className="font-label-sm text-xs text-tertiary-light uppercase tracking-wider block" htmlFor="auth-email">
                Email Address
              </label>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined text-tertiary text-base absolute left-3 pointer-events-none">
                  mail
                </span>
                <input
                  id="auth-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="alex@spendwise.io"
                  className="w-full bg-surface-elevated text-primary text-xs pl-9 pr-3 py-2.5 rounded-lg border border-stroke-subtle focus:border-secondary focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Password */}
          <div className="space-y-1">
            <label className="font-label-sm text-xs text-tertiary-light uppercase tracking-wider block" htmlFor="auth-password">
              Password
            </label>
            <div className="relative flex items-center">
              <span className="material-symbols-outlined text-tertiary text-base absolute left-3 pointer-events-none">
                lock
              </span>
              <input
                id="auth-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-surface-elevated text-primary text-xs pl-9 pr-3 py-2.5 rounded-lg border border-stroke-subtle focus:border-secondary focus:outline-none"
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-neutral-200 text-on-primary font-label-md text-xs py-2.5 rounded-lg shadow-sm font-bold transition-all active:scale-95 disabled:opacity-50 mt-2"
          >
            <span className="material-symbols-outlined text-base font-bold">
              {isRegister ? 'person_add' : 'login'}
            </span>
            <span>{loading ? 'Authenticating...' : isRegister ? 'Register Workspace' : 'Sign In to Workspace'}</span>
          </button>

          {/* 1-Click Demo Access Button */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleDemoAccess}
              disabled={loading}
              className="w-full flex items-center justify-center gap-1.5 bg-surface-elevated hover:bg-surface-container-high text-secondary-bright border border-secondary/30 font-caption-code text-xs py-2 rounded-lg transition-colors"
            >
              <span className="material-symbols-outlined text-sm">bolt</span>
              <span>1-Click Instant Demo Login (demo_user)</span>
            </button>
          </div>
        </form>

        {/* Footer info */}
        <div className="p-3 bg-surface-container-lowest border-t border-stroke-subtle text-center font-caption-code text-[11px] text-tertiary-light">
          Django REST Framework 5.1 & Token Auth Active
        </div>
      </div>
    </div>
  );
};
