'use client';

import { Suspense, useState } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { api, setSession } from '@/lib/api';
import { SocialButtons } from '@/components/SocialButtons';

function AuthForm() {
  const t = useTranslations();
  const router = useRouter();
  const { locale } = useParams<{ locale: string }>();
  const search = useSearchParams();
  const [mode, setMode] = useState<'login' | 'register'>(
    search.get('mode') === 'register' ? 'register' : 'login',
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(
    search.get('error') ? t('auth.oauthError') : '',
  );
  const [form, setForm] = useState({ email: '', password: '', name: '', organizationName: '' });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const auth =
        mode === 'login'
          ? await api.login({ email: form.email, password: form.password })
          : await api.register(form);
      setSession(auth);
      router.push(`/${locale}/projects`);
    } catch {
      setError(t('auth.error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card auth-card">
      <h2>{mode === 'login' ? t('auth.login') : t('auth.register')}</h2>
      <p className="muted">{t('app.tagline')}</p>
      <form onSubmit={submit}>
        {mode === 'register' && (
          <>
            <label>{t('auth.name')}</label>
            <input value={form.name} onChange={set('name')} required />
            <label>{t('auth.organization')}</label>
            <input value={form.organizationName} onChange={set('organizationName')} required />
          </>
        )}
        <label>{t('auth.email')}</label>
        <input type="email" value={form.email} onChange={set('email')} required />
        <label>{t('auth.password')}</label>
        <input
          type="password"
          value={form.password}
          onChange={set('password')}
          required
          minLength={8}
        />
        {error && <p className="error-text">{error}</p>}
        <button className="primary wide" disabled={busy} type="submit">
          {mode === 'login' ? t('auth.login') : t('auth.register')}
        </button>
      </form>

      <SocialButtons locale={locale} />

      <p style={{ marginTop: '1rem' }}>
        <span className="muted">
          {mode === 'login' ? t('auth.noAccount') : t('auth.haveAccount')}{' '}
        </span>
        <button className="link" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
          {mode === 'login' ? t('auth.register') : t('auth.login')}
        </button>
      </p>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense>
      <AuthForm />
    </Suspense>
  );
}
