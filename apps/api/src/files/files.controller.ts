import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  UploadedFile as UploadedFileParam,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as path from 'path';
import { randomUUID } from 'crypto';
import type { UploadedFileDto, ValidationResultDto, FileStatus } from '@afdip/shared';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { AppConfigService } from '../config/app-config.service';
import { AuditService } from '../audit/audit.service';
import { PipelineService } from './pipeline.service';
import { RequireAction, AuthedRequest } from '../auth/jwt-auth.guard';

@Controller()
export class FilesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly config: AppConfigService,
    private readonly audit: AuditService,
    private readonly pipeline: PipelineService,
  ) {}

  @Post('projects/:projectId/files')
  @RequireAction('file:upload')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @Param('projectId') projectId: string,
    @UploadedFileParam() file: Express.Multer.File,
    @Req() req: AuthedRequest,
  ): Promise<UploadedFileDto> {
    if (!file) throw new BadRequestException('No file provided (multipart field name: "file")');

    const allowed = await this.config.get<string[]>('allowedExtensions', ['.xlsx', '.xlsm']);
    const maxMb = await this.config.get<number>('maxFileSizeMb', 50);
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowed.includes(ext)) {
      throw new BadRequestException(`Extension ${ext} not allowed (allowed: ${allowed.join(', ')})`);
    }
    if (file.size > maxMb * 1024 * 1024) {
      throw new BadRequestException(`File exceeds the ${maxMb}MB limit`);
    }

    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId: req.user.orgId },
    });
    if (!project) throw new NotFoundException('Project not found');

    const storageKey = `workbooks/${projectId}/${randomUUID()}${ext}`;
    await this.storage.put(storageKey, file.buffer, file.mimetype);

    const record = await this.prisma.uploadedFile.create({
      data: {
        projectId,
        uploadedById: req.user.sub,
        fileName: file.originalname,
        storageKey,
        sizeBytes: file.size,
      },
    });
    await this.audit.log(req.user.sub, 'upload', 'file', record.id, {
      fileName: file.originalname,
      sizeBytes: file.size,
    });
    await this.pipeline.enqueue(record.id);

    return this.toDto(record);
  }

  @Get('projects/:projectId/files')
  @RequireAction('file:read')
  async list(
    @Param('projectId') projectId: string,
    @Req() req: AuthedRequest,
  ): Promise<UploadedFileDto[]> {
    const files = await this.prisma.uploadedFile.findMany({
      where: { projectId, project: { organizationId: req.user.orgId } },
      orderBy: { createdAt: 'desc' },
    });
    return files.map((f) => this.toDto(f));
  }

  @Get('files/:id/status')
  @RequireAction('file:read')
  async status(@Param('id') id: string, @Req() req: AuthedRequest): Promise<UploadedFileDto> {
    const file = await this.findOwned(id, req.user.orgId);
    return this.toDto(file);
  }

  @Get('files/:id')
  @RequireAction('file:read')
  async details(@Param('id') id: string, @Req() req: AuthedRequest) {
    const file = await this.prisma.uploadedFile.findFirst({
      where: { id, project: { organizationId: req.user.orgId } },
      include: {
        sheets: { include: { detectedTables: true }, orderBy: { index: 'asc' } },
        namedRanges: true,
      },
    });
    if (!file) throw new NotFoundException('File not found');
    const { analysisResult: _raw, ...rest } = file;
    return rest;
  }

  @Get('files/:id/results')
  @RequireAction('file:read')
  async results(
    @Param('id') id: string,
    @Req() req: AuthedRequest,
  ): Promise<ValidationResultDto[]> {
    await this.findOwned(id, req.user.orgId);
    const results = await this.prisma.validationResult.findMany({
      where: { fileId: id },
      orderBy: [{ severity: 'asc' }, { createdAt: 'asc' }],
    });
    return results.map((r) => ({
      id: r.id,
      severity: r.severity,
      ruleKey: r.ruleKey,
      sheetName: r.sheetName,
      cell: r.cell,
      message: r.message,
      messageAr: r.messageAr,
      source: r.source,
      needsReview: r.needsReview,
    }));
  }

  private async findOwned(id: string, orgId: string) {
    const file = await this.prisma.uploadedFile.findFirst({
      where: { id, project: { organizationId: orgId } },
    });
    if (!file) throw new NotFoundException('File not found');
    return file;
  }

  private toDto(f: {
    id: string;
    projectId: string;
    fileName: string;
    sizeBytes: number;
    status: string;
    errorMessage: string | null;
    createdAt: Date;
  }): UploadedFileDto {
    return {
      id: f.id,
      projectId: f.projectId,
      fileName: f.fileName,
      sizeBytes: f.sizeBytes,
      status: f.status as FileStatus,
      errorMessage: f.errorMessage,
      createdAt: f.createdAt.toISOString(),
    };
  }
}
