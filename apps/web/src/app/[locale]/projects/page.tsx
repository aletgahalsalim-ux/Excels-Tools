'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { ProjectDto } from '@afdip/shared';
import { api, getToken } from '@/lib/api';

export default function ProjectsPage() {
  const t = useTranslations('projects');
  const router = useRouter();
  const { locale } = useParams<{ locale: string }>();
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.push(`/${locale}`);
      return;
    }
    api.listProjects().then(setProjects).catch(() => router.push(`/${locale}`));
  }, [locale, router]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      const project = await api.createProject(name.trim());
      setProjects([project, ...projects]);
      setName('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="card">
        <h2>{t('title')}</h2>
        <form onSubmit={create} className="row">
          <div>
            <label>{t('name')}</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div style={{ flex: '0 0 auto' }}>
            <button className="primary" disabled={busy} type="submit">
              {t('create')}
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        {projects.length === 0 ? (
          <p className="empty">{t('empty')}</p>
        ) : (
          <table>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td className="muted">{new Date(p.createdAt).toLocaleDateString(locale)}</td>
                  <td style={{ textAlign: 'end' }}>
                    <Link href={`/${locale}/projects/${p.id}`}>{t('open')}</Link>
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
