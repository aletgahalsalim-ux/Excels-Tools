import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { CellValue, ExecutiveSummary, GeneratedDocumentDto } from '@afdip/shared';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { buildDocx, DocumentData } from './docx-builder';
import { buildHtml } from './html-builder';

const CONTENT_TYPES: Record<string, string> = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  html: 'text/html; charset=utf-8',
};

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async generate(
    fileId: string,
    orgId: string,
    format: 'docx' | 'html',
    language: 'ar' | 'en',
  ): Promise<GeneratedDocumentDto> {
    const file = await this.prisma.uploadedFile.findFirst({
      where: { id: fileId, project: { organizationId: orgId } },
      include: {
        project: true,
        sheets: { include: { detectedTables: true }, orderBy: { index: 'asc' } },
        validationResults: { orderBy: { severity: 'asc' } },
      },
    });
    if (!file) throw new NotFoundException('File not found');
    if (file.status !== 'completed') {
      throw new BadRequestException(`File is not ready (status: ${file.status})`);
    }

    const data = await this.collectData(file, language);
    const body =
      format === 'docx'
        ? await buildDocx(data)
        : Buffer.from(buildHtml(data), 'utf-8');

    const storageKey = `documents/${fileId}/${randomUUID()}.${format}`;
    await this.storage.put(storageKey, body, CONTENT_TYPES[format]);

    const document = await this.prisma.generatedDocument.upsert({
      where: { fileId_format_language: { fileId, format, language } },
      update: {},
      create: { fileId, format, language },
      include: { versions: true },
    });
    const version = await this.prisma.documentVersion.create({
      data: {
        documentId: document.id,
        version: document.versions.length + 1,
        storageKey,
        sizeBytes: body.length,
      },
    });

    return {
      id: document.id,
      fileId,
      format,
      language,
      version: version.version,
      createdAt: version.createdAt.toISOString(),
      downloadUrl: `/api/v1/documents/versions/${version.id}/download`,
    };
  }

  async download(
    versionId: string,
    orgId: string,
  ): Promise<{ body: Buffer; contentType: string; fileName: string }> {
    const version = await this.prisma.documentVersion.findFirst({
      where: { id: versionId, document: { file: { project: { organizationId: orgId } } } },
      include: { document: { include: { file: true } } },
    });
    if (!version) throw new NotFoundException('Document version not found');

    const body = await this.storage.get(version.storageKey);
    const base = version.document.file.fileName.replace(/\.(xlsx|xlsm)$/i, '');
    return {
      body,
      contentType: CONTENT_TYPES[version.document.format],
      fileName: `${base}-report-v${version.version}.${version.document.format}`,
    };
  }

  private async collectData(
    file: {
      id: string;
      fileName: string;
      project: { name: string };
      sheets: Array<{
        name: string;
        detectedTables: Array<{
          range: string;
          statementType: string | null;
          headers: unknown;
          rows: unknown;
        }>;
      }>;
      validationResults: Array<{
        severity: string;
        message: string;
        messageAr: string;
        sheetName: string | null;
        cell: string | null;
      }>;
    },
    language: 'ar' | 'en',
  ): Promise<DocumentData> {
    // Latest successful executive summary from the agents pipeline
    const summaryRun = await this.prisma.agentRun.findFirst({
      where: {
        fileId: file.id,
        status: { in: ['succeeded', 'needs_review'] },
        agent: { key: 'executive-summary-generator' },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Export style from the Rules Engine — editable without a deploy
    const styleRule = await this.prisma.rule.findUnique({
      where: { ruleKey: 'export_default_style' },
    });
    const styleDef = (styleRule?.definition ?? {}) as Record<string, unknown>;

    return {
      fileName: file.fileName,
      projectName: file.project.name,
      language,
      summary: (summaryRun?.output as unknown as ExecutiveSummary) ?? null,
      tables: file.sheets.flatMap((s) =>
        s.detectedTables.map((t) => ({
          sheetName: s.name,
          range: t.range,
          statementType: t.statementType,
          headers: t.headers as string[],
          rows: t.rows as CellValue[][],
        })),
      ),
      findings: file.validationResults,
      style: {
        brandColor: (styleDef.brandColor as string) ?? '1F4E79',
        fontLatin: (styleDef.fontLatin as string) ?? 'Calibri',
        fontArabic: (styleDef.fontArabic as string) ?? 'Traditional Arabic',
        includeCover: (styleDef.includeCover as boolean) ?? true,
        includeValidationReport: (styleDef.includeValidationReport as boolean) ?? true,
      },
    };
  }
}
