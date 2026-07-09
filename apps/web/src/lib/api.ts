'use client';

import type {
  AuthResponseDto,
  GeneratedDocumentDto,
  ProjectDto,
  UploadedFileDto,
  ValidationResultDto,
} from '@afdip/shared';

export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const API = `${API_BASE}/api/v1`;

export function getToken(): string | null {
  return typeof window === 'undefined' ? null : localStorage.getItem('afdip_token');
}

export function setSession(auth: AuthResponseDto): void {
  localStorage.setItem('afdip_token', auth.accessToken);
  localStorage.setItem('afdip_user', JSON.stringify(auth.user));
}

export function clearSession(): void {
  localStorage.removeItem('afdip_token');
  localStorage.removeItem('afdip_user');
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (init.body && typeof init.body === 'string') headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API}${path}`, { ...init, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  register: (input: { email: string; password: string; name: string; organizationName: string }) =>
    request<AuthResponseDto>('/auth/register', { method: 'POST', body: JSON.stringify(input) }),

  login: (input: { email: string; password: string }) =>
    request<AuthResponseDto>('/auth/login', { method: 'POST', body: JSON.stringify(input) }),

  listProjects: () => request<ProjectDto[]>('/projects'),

  createProject: (name: string) =>
    request<ProjectDto>('/projects', { method: 'POST', body: JSON.stringify({ name }) }),

  listFiles: (projectId: string) => request<UploadedFileDto[]>(`/projects/${projectId}/files`),

  uploadFile: (projectId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return request<UploadedFileDto>(`/projects/${projectId}/files`, {
      method: 'POST',
      body: form,
    });
  },

  fileStatus: (fileId: string) => request<UploadedFileDto>(`/files/${fileId}/status`),

  fileDetails: (fileId: string) =>
    request<{
      id: string;
      fileName: string;
      status: string;
      sheets: Array<{
        id: string;
        name: string;
        detectedTables: Array<{
          id: string;
          range: string;
          rowCount: number;
          statementType: string | null;
          headers: string[];
        }>;
      }>;
    }>(`/files/${fileId}`),

  fileResults: (fileId: string) => request<ValidationResultDto[]>(`/files/${fileId}/results`),

  generateDocument: (fileId: string, format: 'docx' | 'html', language: 'ar' | 'en') =>
    request<GeneratedDocumentDto>(`/files/${fileId}/documents`, {
      method: 'POST',
      body: JSON.stringify({ format, language }),
    }),
};

/** Authenticated download that preserves the server's filename. */
export async function downloadDocument(downloadUrl: string): Promise<void> {
  const res = await fetch(`${API_BASE}${downloadUrl}`, {
    headers: { Authorization: `Bearer ${getToken() ?? ''}` },
  });
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') ?? '';
  const match = /filename\*=UTF-8''([^;]+)/.exec(disposition);
  const name = match ? decodeURIComponent(match[1]) : 'report';
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
