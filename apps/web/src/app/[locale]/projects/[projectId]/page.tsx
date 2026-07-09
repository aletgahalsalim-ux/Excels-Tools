'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { UploadedFileDto } from '@afdip/shared';
import { api, getToken } from '@/lib/api';

const ACTIVE_STATUSES = ['uploaded', 'analyzing', 'analyzed', 'agents_running'];

export default function ProjectFilesPage() {
  const t = useTranslations('files');
  const router = useRouter();
  const { locale, projectId } = useParams<{ locale: string; projectId: string }>();
  const [files, setFiles] = useState<UploadedFileDto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(() => {
    api.listFiles(projectId).then(setFiles).catch(() => router.push(`/${locale}`));
  }, [projectId, locale, router]);

  useEffect(() => {
    if (!getToken()) {
      router.push(`/${locale}`);
      return;
    }
    refresh();
  }, [refresh, locale, router]);

  // poll while any file is still in the pipeline
  useEffect(() => {
    if (!files.some((f) => ACTIVE_STATUSES.includes(f.status))) return;
    const timer = setInterval(refresh, 2500);
    return () => clearInterval(timer);
  }, [files, refresh]);

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      await api.uploadFile(projectId, file);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <>
      <div className="card">
        <h2>{t('title')}</h2>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xlsm"
          onChange={upload}
          disabled={uploading}
        />
        {uploading && <p className="muted">{t('uploading')}</p>}
        {error && <p className="error-text">{error}</p>}
      </div>

      <div className="card">
        {files.length === 0 ? (
          <p className="empty">{t('empty')}</p>
        ) : (
          <table>
            <tbody>
              {files.map((f) => (
                <tr key={f.id}>
                  <td>{f.fileName}</td>
                  <td>
                    <span className={`badge ${f.status}`}>{t(`status.${f.status}`)}</span>
                  </td>
                  <td className="muted">{(f.sizeBytes / 1024).toFixed(1)} KB</td>
                  <td style={{ textAlign: 'end' }}>
                    {f.status === 'completed' && (
                      <Link href={`/${locale}/files/${f.id}`}>{t('view')}</Link>
                    )}
                    {f.status === 'failed' && (
                      <span className="error-text">{f.errorMessage}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
