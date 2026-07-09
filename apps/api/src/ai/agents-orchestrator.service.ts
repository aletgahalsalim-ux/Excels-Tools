import { Injectable, Logger } from '@nestjs/common';
import type {
  AnalysisResult,
  AnomalyReport,
  DetectedTable,
  FinancialValidation,
  SemanticAnalysis,
} from '@afdip/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfigService } from '../config/app-config.service';
import { PlannerService } from './planner.service';
import { AgentRunnerService } from './agent-runner.service';

interface TablePayload {
  tableId: string;
  sheetName: string;
  headers: string[];
  rows: DetectedTable['rows'];
  statementType?: string;
}

/**
 * Runs the Planner's agent pipeline over an analyzed workbook and persists
 * each agent's validated output (ValidationResults, semantic table info,
 * executive summary in AgentRun.output for the Document Engine).
 */
@Injectable()
export class AgentsOrchestratorService {
  private readonly logger = new Logger(AgentsOrchestratorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly planner: PlannerService,
    private readonly runner: AgentRunnerService,
  ) {}

  async processAnalyzedFile(fileId: string): Promise<void> {
    const file = await this.prisma.uploadedFile.findUniqueOrThrow({ where: { id: fileId } });
    const analysis = file.analysisResult as unknown as AnalysisResult;
    if (!analysis) throw new Error(`File ${fileId} has no analysis result`);

    const agentKeys = await this.planner.plan(analysis);
    const maxRows = await this.config.get<number>('analyzerMaxRowsPerTable', 200);

    let tables: TablePayload[] = analysis.sheets.flatMap((s) =>
      s.detectedTables.map((t) => ({
        tableId: t.id,
        sheetName: t.sheetName,
        headers: t.headers,
        rows: t.rows.slice(0, maxRows),
      })),
    );

    for (const agentKey of agentKeys) {
      const payload = await this.buildPayload(agentKey, file.fileName, tables, analysis);
      const result = await this.runner.run(agentKey, fileId, payload, analysis);

      if (result.status === 'failed') {
        this.logger.warn(`Agent ${agentKey} failed for file ${fileId}; continuing pipeline`);
        continue;
      }
      const needsReview = result.status === 'needs_review';

      switch (agentKey) {
        case 'semantic-financial-analyzer':
          tables = await this.applySemantic(result.output as SemanticAnalysis, tables);
          break;
        case 'financial-validation-engine':
          await this.storeValidationFindings(
            fileId,
            result.runId,
            result.output as FinancialValidation,
            needsReview,
          );
          break;
        case 'error-anomaly-detector':
          await this.storeAnomalyFindings(
            fileId,
            result.runId,
            result.output as AnomalyReport,
            needsReview,
          );
          break;
        case 'executive-summary-generator':
          break; // kept in AgentRun.output; Document Engine reads the latest run
      }
    }

    // Engine anomalies not covered by the agent (agent inactive or failed)
    // still become engine-source ValidationResults so nothing is lost.
    const agentAnomalies = await this.prisma.validationResult.count({
      where: { fileId, ruleKey: { startsWith: 'anomaly:' } },
    });
    if (agentAnomalies === 0 && analysis.anomalies.length > 0) {
      await this.storeEngineAnomalies(fileId, analysis);
    }
  }

  private async buildPayload(
    agentKey: string,
    fileName: string,
    tables: TablePayload[],
    analysis: AnalysisResult,
  ): Promise<Record<string, unknown>> {
    switch (agentKey) {
      case 'financial-validation-engine': {
        const rules = await this.prisma.rule.findMany({
          where: { ruleType: 'validation', active: true },
        });
        return {
          fileName,
          tables,
          rules: rules.map((r) => ({
            ruleKey: r.ruleKey,
            severity: r.severity,
            definition: r.definition,
          })),
        };
      }
      case 'error-anomaly-detector':
        return { fileName, anomalies: analysis.anomalies };
      case 'executive-summary-generator':
        return { fileName, tables, anomalies: analysis.anomalies };
      default:
        return { fileName, tables };
    }
  }

  private async applySemantic(
    output: SemanticAnalysis,
    tables: TablePayload[],
  ): Promise<TablePayload[]> {
    const byId = new Map(output.tables.map((t) => [t.tableId, t]));
    for (const [tableId, semantic] of byId) {
      await this.prisma.detectedTable.updateMany({
        where: { engineId: tableId },
        data: {
          statementType: semantic.statementType,
          semanticInfo: {
            confidence: semantic.confidence,
            conceptMap: semantic.conceptMap,
            summary: semantic.summary,
          },
        },
      });
    }
    return tables.map((t) => ({
      ...t,
      statementType: byId.get(t.tableId)?.statementType ?? 'other',
    }));
  }

  private async storeValidationFindings(
    fileId: string,
    runId: string,
    output: FinancialValidation,
    needsReview: boolean,
  ): Promise<void> {
    for (const f of output.findings) {
      await this.prisma.validationResult.create({
        data: {
          fileId,
          ruleKey: f.ruleKey,
          severity: f.severity,
          sheetName: f.sheetName,
          cell: f.cell,
          message: f.message,
          messageAr: f.messageAr,
          source: 'agent',
          needsReview,
          agentRunId: runId,
        },
      });
    }
  }

  private async storeAnomalyFindings(
    fileId: string,
    runId: string,
    output: AnomalyReport,
    needsReview: boolean,
  ): Promise<void> {
    for (const a of output.anomalies) {
      await this.prisma.validationResult.create({
        data: {
          fileId,
          ruleKey: `anomaly:${a.type}`,
          severity: a.severity,
          sheetName: a.sheetName,
          cell: a.cell,
          message: a.explanation,
          messageAr: a.explanationAr,
          source: 'agent',
          needsReview,
          agentRunId: runId,
        },
      });
    }
  }

  private async storeEngineAnomalies(fileId: string, analysis: AnalysisResult): Promise<void> {
    const severity: Record<string, 'error' | 'warning' | 'info'> = {
      circular_reference: 'error',
      broken_reference: 'error',
      hardcoded_number: 'warning',
      dead_formula: 'info',
    };
    for (const a of analysis.anomalies) {
      await this.prisma.validationResult.create({
        data: {
          fileId,
          ruleKey: `anomaly:${a.type}`,
          severity: severity[a.type] ?? 'info',
          sheetName: a.sheetName,
          cell: a.cell,
          message: a.detail,
          messageAr: a.detail,
          source: 'engine',
        },
      });
    }
  }
}
