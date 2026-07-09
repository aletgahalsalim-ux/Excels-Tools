'use client';

import { useEffect, useState, type JSX } from 'react';
import { useTranslations } from 'next-intl';
import { api, API_BASE } from '@/lib/api';

const ICONS: Record<string, JSX.Element> = {
  google: (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.3l7.8 6.1C12.3 13.2 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
      <path fill="#FBBC05" d="M10.4 28.6a14.5 14.5 0 0 1 0-9.2l-7.8-6.1a24 24 0 0 0 0 21.4l7.8-6.1z" />
      <path fill="#34A853" d="M24 48c6.2 0 11.4-2 15.2-5.5l-7.5-5.8c-2.1 1.4-4.7 2.2-7.7 2.2-6.3 0-11.7-3.7-13.6-9l-7.8 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  ),
  microsoft: (
    <svg width="18" height="18" viewBox="0 0 23 23" aria-hidden>
      <rect x="1" y="1" width="10" height="10" fill="#F25022" />
      <rect x="12" y="1" width="10" height="10" fill="#7FBA00" />
      <rect x="1" y="12" width="10" height="10" fill="#00A4EF" />
      <rect x="12" y="12" width="10" height="10" fill="#FFB900" />
    </svg>
  ),
  apple: (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M16.365 1.43c0 1.14-.42 2.2-1.26 3.08-.9 1-2.12 1.58-3.24 1.49a3.6 3.6 0 0 1-.03-.44c0-1.1.48-2.26 1.32-3.1.42-.44.96-.8 1.6-1.09.65-.28 1.26-.44 1.58-.44.02.17.03.34.03.5zm4.34 16.4c-.5 1.16-.74 1.68-1.39 2.7-.9 1.44-2.18 3.22-3.77 3.24-1.4.02-1.77-.92-3.67-.9-1.9 0-2.3.93-3.71.9-1.59-.02-2.8-1.62-3.71-3.05-2.55-3.99-2.82-8.67-1.24-11.16 1.11-1.77 2.87-2.8 4.52-2.8 1.68 0 2.74.92 4.13.92 1.35 0 2.17-.93 4.12-.93 1.47 0 3.03.8 4.14 2.19-3.64 2-3.05 7.19.58 8.89z"
      />
    </svg>
  ),
};

export function SocialButtons({ locale }: { locale: string }) {
  const t = useTranslations('auth');
  const [providers, setProviders] = useState<Record<string, boolean>>({});

  useEffect(() => {
    api.providers().then(setProviders).catch(() => setProviders({}));
  }, []);

  const enabled = (['google', 'microsoft', 'apple'] as const).filter((p) => providers[p]);
  if (enabled.length === 0) return null;

  return (
    <>
      <div className="divider">
        <span>{t('continueWith')}</span>
      </div>
      <div className="social-buttons">
        {enabled.map((p) => (
          <a key={p} className={`btn-social ${p}`} href={`${API_BASE}/api/v1/auth/oauth/${p}?locale=${locale}`}>
            {ICONS[p]}
            <span>{t(p)}</span>
          </a>
        ))}
      </div>
    </>
  );
}
