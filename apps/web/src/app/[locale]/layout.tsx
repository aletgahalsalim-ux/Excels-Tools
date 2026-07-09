import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import '../globals.css';
import { TopBar } from '@/components/TopBar';

export const metadata: Metadata = {
  title: 'AI Financial Document Intelligence Platform',
};

export default async function LocaleLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  const messages = await getMessages();
  const t = await getTranslations('app');

  return (
    <html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <body>
        <NextIntlClientProvider messages={messages}>
          <TopBar title={t('title')} locale={locale} />
          <main>{children}</main>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
