import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import type {
  AuthResponseDto,
  GeneratedDocumentDto,
  ProjectDto,
  UploadedFileDto,
  ValidationResultDto,
} from '@afdip/shared';

export const API_BASE: string =
  process.env.EXPO_PUBLIC_API_URL ??
  (Constants.expoConfig?.extra?.apiUrl as string) ??
  'http://localhost:3001';

const API = `${API_BASE}/api/v1`;
const TOKEN_KEY = 'afdip_token';

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setSession(auth: AuthResponseDto): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, auth.accessToken);
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (typeof init.body === 'string') headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API}${path}`, { ...init, headers });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export const api = {
  providers: () =>
    request<{ google: boolean; microsoft: boolean; apple: boolean }>('/auth/providers'),
  register: (input: { email: string; password: string; name: string; organizationName: string }) =>
    request<AuthResponseDto>('/auth/register', { method: 'POST', body: JSON.stringify(input) }),
  login: (input: { email: string; password: string }) =>
    request<AuthResponseDto>('/auth/login', { method: 'POST', body: JSON.stringify(input) }),
  listProjects: () => request<ProjectDto[]>('/projects'),
  createProject: (name: string) =>
    request<ProjectDto>('/projects', { method: 'POST', body: JSON.stringify({ name }) }),
  listFiles: (projectId: string) => request<UploadedFileDto[]>(`/projects/${projectId}/files`),
  uploadFile: async (projectId: string, file: { uri: string; name: string; mimeType?: string }) => {
    const form = new FormData();
    // React Native FormData file part
    form.append('file', {
      uri: file.uri,
      name: file.name,
      type:
        file.mimeType ?? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    } as unknown as Blob);
    return request<UploadedFileDto>(`/projects/${projectId}/files`, {
      method: 'POST',
      body: form,
    });
  },
  fileResults: (fileId: string) => request<ValidationResultDto[]>(`/files/${fileId}/results`),
  fileDetails: (fileId: string) =>
    request<{
      id: string;
      fileName: string;
      sheets: Array<{
        id: string;
        name: string;
        detectedTables: Array<{ id: string; range: string; rowCount: number; statementType: string | null }>;
      }>;
    }>(`/files/${fileId}`),
  generateDocument: (fileId: string, format: 'docx' | 'html', language: 'ar' | 'en') =>
    request<GeneratedDocumentDto>(`/files/${fileId}/documents`, {
      method: 'POST',
      body: JSON.stringify({ format, language }),
    }),
};
