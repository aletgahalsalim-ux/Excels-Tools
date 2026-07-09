import { Body, Controller, Get, Param, Post, Req, Res } from '@nestjs/common';
import { IsIn } from 'class-validator';
import type { Response } from 'express';
import type { GeneratedDocumentDto } from '@afdip/shared';
import { DocumentsService } from './documents.service';
import { AuditService } from '../audit/audit.service';
import { RequireAction, AuthedRequest } from '../auth/jwt-auth.guard';

class GenerateDocumentDto {
  @IsIn(['docx', 'html'])
  format!: 'docx' | 'html';

  @IsIn(['ar', 'en'])
  language!: 'ar' | 'en';
}

@Controller()
export class DocumentsController {
  constructor(
    private readonly documents: DocumentsService,
    private readonly audit: AuditService,
  ) {}

  @Post('files/:fileId/documents')
  @RequireAction('document:generate')
  async generate(
    @Param('fileId') fileId: string,
    @Body() dto: GenerateDocumentDto,
    @Req() req: AuthedRequest,
  ): Promise<GeneratedDocumentDto> {
    const result = await this.documents.generate(fileId, req.user.orgId, dto.format, dto.language);
    await this.audit.log(req.user.sub, 'generate', 'document', result.id, {
      fileId,
      format: dto.format,
      language: dto.language,
      version: result.version,
    });
    return result;
  }

  @Get('documents/versions/:versionId/download')
  @RequireAction('document:read')
  async download(
    @Param('versionId') versionId: string,
    @Req() req: AuthedRequest,
    @Res() res: Response,
  ): Promise<void> {
    const { body, contentType, fileName } = await this.documents.download(
      versionId,
      req.user.orgId,
    );
    await this.audit.log(req.user.sub, 'export', 'documentVersion', versionId);
    res
      .setHeader('Content-Type', contentType)
      .setHeader(
        'Content-Disposition',
        `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      )
      .send(body);
  }
}
