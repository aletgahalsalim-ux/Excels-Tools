import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

export default async function LandingPage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  const t = await getTranslations('landing');
  const features = ['understand', 'validate', 'agents', 'bilingual'] as const;
  const steps = ['upload', 'review', 'export'] as const;

  return (
    <div className="landing">
      <section className="hero">
        <h1>{t('heroTitle')}</h1>
        <p>{t('heroSubtitle')}</p>
        <div className="hero-cta">
          <Link className="btn-hero primary" href={`/${locale}/auth?mode=register`}>
            {t('ctaPrimary')}
          </Link>
          <Link className="btn-hero" href={`/${locale}/auth`}>
            {t('ctaSecondary')}
          </Link>
        </div>
      </section>

      <section>
        <h2 className="section-title">{t('featuresTitle')}</h2>
        <div className="features">
          {features.map((key) => (
            <div className="feature" key={key}>
              <h3>{t(`features.${key}.title`)}</h3>
              <p>{t(`features.${key}.body`)}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="section-title">{t('stepsTitle')}</h2>
        <div className="steps">
          {steps.map((key, i) => (
            <div className="step" key={key}>
              <span className="step-num">{i + 1}</span>
              <h3>{t(`steps.${key}.title`)}</h3>
              <p>{t(`steps.${key}.body`)}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="landing-footer">© {new Date().getFullYear()} — {t('footer')}</footer>
    </div>
  );
}
