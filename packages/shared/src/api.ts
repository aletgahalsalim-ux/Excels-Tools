/** REST API DTOs shared between apps/api and apps/web. */

export type FileStatus =
  | 'uploaded'
  | 'analyzing'
  | 'analyzed'
  | 'agents_running'
  | 'completed'
  | 'failed';

export interface UploadedFileDto {
  id: string;
  projectId: string;
  fileName: string;
  sizeBytes: number;
  status: FileStatus;
  errorMessage: string | null;
  createdAt: string;
}

export interface ValidationResultDto {
  id: string;
  severity: 'error' | 'warning' | 'info';
  ruleKey: string;
  sheetName: string | null;
  cell: string | null;
  message: string;
  messageAr: string;
  source: 'engine' | 'agent';
  needsReview: boolean;
}

export interface GeneratedDocumentDto {
  id: string;
  fileId: string;
  format: 'docx' | 'html';
  language: 'ar' | 'en';
  version: number;
  createdAt: string;
  downloadUrl: string;
}

export interface ProjectDto {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
}

export interface AuthResponseDto {
  accessToken: string;
  user: { id: string; email: string; name: string; role: string };
}
