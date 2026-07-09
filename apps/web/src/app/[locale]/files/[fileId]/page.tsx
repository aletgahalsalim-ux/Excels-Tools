'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { ValidationResultDto } from '@afdip/shared';
import { api, downloadDocument, getToken } from '@/lib/api';

type Details = Awaited<ReturnType<typeof api.fileDetails>>;

export default function FileResultsPage() {
  const t = useTranslations();
  const router = useRouter();
  const { locale, fileId } = useParams<{ locale: string; fileId: string }>();
  const [details, setDetails] = useState<Details | null>(null);
  const [results, setResults] = useState<ValidationResultDto[]>([]);
  const [format, setFormat] = useState<'docx' | 'html'>('docx');
  const [docLang, setDocLang] = useState<'ar' | 'en'>(locale === 'en' ? 'en' : 'ar');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!getToken()) {
      router.push(`/${locale}/auth`);
      return;
    }
    api.fileDetails(fileId).then(setDetails).catch(() => router.push(`/${locale}/projects`));
    api.fileResults(fileId).then(setResults).catch(() => undefined);
  }, [fileId, locale, router]);

  const generate = async () => {
    setGenerating(true);
    setError('');
    try {
      const doc = await api.generateDocument(fileId, format, docLang);
      await downloadDocument(doc.downloadUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setGenerating(false);
    }
  };

  if (!details) return <p className="empty">…</p>;

  const statementType = (type: string | null) =>
    type ? t(`analysis.statementType.${type}` as never) : '—';

  return (
    <>
      <div className="card">
        <h2>{details.fileName}</h2>
        {details.sheets.map((sheet) => (
          <div key={sheet.id}>
            <h3>
              {t('analysis.sheets')}: {sheet.name}
            </h3>
            {sheet.detectedTables.length > 0 && (
              <table>
                <thead>
                  <tr>
                    <th>{t('analysis.range')}</th>
                    <th>{t('analysis.rows')}</th>
                    <th>{t('analysis.type')}</th>
                  </tr>
                </thead>
                <tbody>
                  {sheet.detectedTables.map((table) => (
                    <tr key={table.id}>
                      <td dir="ltr">{table.range}</td>
                      <td>{table.rowCount}</td>
                      <td>{statementType(table.statementType)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))}
      </div>

      <div className="card">
        <h2>{t('analysis.results')}</h2>
        {results.length === 0 ? (
          <p className="empty">{t('analysis.noResults')}</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>{t('analysis.severity.error')}/…</th>
                <th>{t('analysis.location')}</th>
                <th>{t('analysis.message')}</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.id}>
                  <td>
                    <span className={`badge ${r.severity}`}>
                      {t(`analysis.severity.${r.severity}` as never)}
                    </span>
                  </td>
                  <td dir="ltr">{[r.sheetName, r.cell].filter(Boolean).join(' / ') || '—'}</td>
                  <td>
                    {locale === 'ar' ? r.messageAr : r.message}
                    {r.needsReview && (
                      <div className="muted">⚠ {t('analysis.needsReview')}</div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2>{t('documents.title')}</h2>
        <div className="row">
          <div>
            <label>{t('documents.format')}</label>
            <select value={format} onChange={(e) => setFormat(e.target.value as 'docx' | 'html')}>
              <option value="docx">DOCX</option>
              <option value="html">HTML</option>
            </select>
          </div>
          <div>
            <label>{t('documents.language')}</label>
            <select value={docLang} onChange={(e) => setDocLang(e.target.value as 'ar' | 'en')}>
              <option value="ar">{t('documents.arabic')}</option>
              <option value="en">{t('documents.english')}</option>
            </select>
          </div>
          <div style={{ flex: '0 0 auto' }}>
            <button className="primary" onClick={generate} disabled={generating}>
              {generating ? t('documents.generating') : t('documents.generate')}
            </button>
          </div>
        </div>
        {error && <p className="error-text">{error}</p>}
      </div>
    </>
  );
}
