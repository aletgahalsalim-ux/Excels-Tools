import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Queue, Worker, ConnectionOptions } from 'bullmq';
import type { AnalysisResult } from '@afdip/shared';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { AppConfigService } from '../config/app-config.service';
import { AgentsOrchestratorService } from '../ai/agents-orchestrator.service';

export const ANALYSIS_QUEUE = 'analysis-pipeline';

/**
 * Async analysis pipeline (BullMQ):
 * uploaded → analyzing (Excel Analysis Engine) → analyzed (persist) →
 * agents_running (Planner + agents) → completed | failed
 */
@Injectable()
export class PipelineService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PipelineService.name);
  private queue!: Queue;
  private worker!: Worker;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly config: AppConfigService,
    private readonly orchestrator: AgentsOrchestratorService,
  ) {}

  onModuleInit(): void {
    const url = new URL(process.env.REDIS_URL ?? 'redis://localhost:6379');
    const connection: ConnectionOptions = {
      host: url.hostname,
      port: Number(url.port || 6379),
      password: url.password || undefined,
      maxRetriesPerRequest: null,
    };
    this.queue = new Queue(ANALYSIS_QUEUE, { connection });
    this.worker = new Worker(
      ANALYSIS_QUEUE,
      async (job) => this.process(job.data.fileId as string),
      { connection },
    );
    this.worker.on('failed', (job, err) =>
      this.logger.error(`Pipeline job ${job?.id} failed: ${err.message}`),
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
  }

  async enqueue(fileId: string): Promise<void> {
    await this.queue.add('analyze', { fileId });
  }

  async process(fileId: string): Promise<void> {
    try {
      await this.setStatus(fileId, 'analyzing');
      const file = await this.prisma.uploadedFile.findUniqueOrThrow({ where: { id: fileId } });

      const analysis = await this.callAnalyzer(file.storageKey, file.fileName);
      await this.persistAnalysis(fileId, analysis);
      await this.setStatus(fileId, 'analyzed');

      await this.setStatus(fileId, 'agents_running');
      await this.orchestrator.processAnalyzedFile(fileId);

      await this.setStatus(fileId, 'completed');
      this.logger.log(`Pipeline completed for file ${fileId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.prisma.uploadedFile.update({
        where: { id: fileId },
        data: { status: 'failed', errorMessage: message.slice(0, 1000) },
      });
      throw error;
    }
  }

  private async setStatus(
    fileId: string,
    status: 'analyzing' | 'analyzed' | 'agents_running' | 'completed',
  ): Promise<void> {
    await this.prisma.uploadedFile.update({ where: { id: fileId }, data: { status } });
  }

  private async callAnalyzer(storageKey: string, fileName: string): Promise<AnalysisResult> {
    const buffer = await this.storage.get(storageKey);
    const maxRows = await this.config.get<number>('analyzerMaxRowsPerTable', 200);
    const analyzerUrl = process.env.EXCEL_ANALYZER_URL ?? 'http://localhost:8100';

    const form = new FormData();
    form.append(
      'file',
      new Blob([new Uint8Array(buffer)], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
      fileName,
    );

    const res = await fetch(`${analyzerUrl}/analyze?max_rows_per_table=${maxRows}`, {
      method: 'POST',
      body: form,
    });
    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`Excel Analysis Engine returned ${res.status}: ${detail}`);
    }
    return (await res.json()) as AnalysisResult;
  }

  /** Persist raw AnalysisResult plus normalized rows for querying. */
  private async persistAnalysis(fileId: string, analysis: AnalysisResult): Promise<void> {
    await this.prisma.uploadedFile.update({
      where: { id: fileId },
      data: { analysisResult: analysis as unknown as object },
    });

    // idempotent re-run: clear previous normalized rows
    await this.prisma.sheet.deleteMany({ where: { fileId } });
    await this.prisma.namedRange.deleteMany({ where: { fileId } });
    await this.prisma.formula.deleteMany({ where: { fileId } });
    await this.prisma.validationResult.deleteMany({ where: { fileId } });

    for (const sheet of analysis.sheets) {
      await this.prisma.sheet.create({
        data: {
          fileId,
          name: sheet.name,
          index: sheet.index,
          visible: sheet.visible,
          maxRow: sheet.maxRow,
          maxColumn: sheet.maxColumn,
          mergedCells: sheet.mergedCells,
          detectedTables: {
            create: sheet.detectedTables.map((t) => ({
              engineId: t.id,
              range: t.range,
              headerRow: t.headerRow,
              headers: t.headers,
              rowCount: t.rowCount,
              columnCount: t.columnCount,
              numericRatio: t.numericRatio,
              rows: t.rows,
              truncated: t.truncated,
            })),
          },
        },
      });
    }

    if (analysis.workbook.namedRanges.length) {
      await this.prisma.namedRange.createMany({
        data: analysis.workbook.namedRanges.map((n) => ({
          fileId,
          name: n.name,
          target: n.target,
        })),
      });
    }

    if (analysis.formulas.length) {
      await this.prisma.formula.createMany({
        data: analysis.formulas.map((f) => ({
          fileId,
          sheetName: f.sheetName,
          cell: f.cell,
          formula: f.formula,
          localRefs: f.localRefs,
          crossSheetRefs: f.crossSheetRefs,
        })),
      });
    }
  }
}
