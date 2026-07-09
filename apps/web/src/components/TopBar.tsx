'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { clearSession, getToken } from '@/lib/api';
import { useEffect, useState } from 'react';

export function TopBar({ title, locale }: { title: string; locale: string }) {
  const t = useTranslations('app');
  const router = useRouter();
  const pathname = usePathname();
  const [authed, setAuthed] = useState(false);

  useEffect(() => setAuthed(Boolean(getToken())), [pathname]);

  const otherLocale = locale === 'ar' ? 'en' : 'ar';
  const switched = pathname.replace(`/${locale}`, `/${otherLocale}`);

  return (
    <header className="topbar">
      <h1>{title}</h1>
      <div className="actions">
        <a href={switched}>{t('language')}</a>
        {authed && (
          <button
            onClick={() => {
              clearSession();
              router.push(`/${locale}`);
            }}
          >
            {t('logout')}
          </button>
        )}
      </div>
    </header>
  );
}
