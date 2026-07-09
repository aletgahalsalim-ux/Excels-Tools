'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { AuthResponseDto } from '@afdip/shared';
import { setSession } from '@/lib/api';

/** Receives the session from the OAuth redirect (URL fragment) and stores it. */
export default function OAuthCallbackPage() {
  const t = useTranslations('auth');
  const router = useRouter();
  const { locale } = useParams<{ locale: string }>();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const match = /[#&]session=([^&]+)/.exec(window.location.hash);
    if (!match) {
      setFailed(true);
      return;
    }
    try {
      const auth = JSON.parse(
        new TextDecoder().decode(
          Uint8Array.from(atob(match[1].replace(/-/g, '+').replace(/_/g, '/')), (c) =>
            c.charCodeAt(0),
          ),
        ),
      ) as AuthResponseDto;
      setSession(auth);
      window.location.hash = '';
      router.replace(`/${locale}/projects`);
    } catch {
      setFailed(true);
    }
  }, [locale, router]);

  useEffect(() => {
    if (failed) router.replace(`/${locale}/auth?error=oauth_failed`);
  }, [failed, locale, router]);

  return <p className="empty">{t('finishing')}</p>;
}
