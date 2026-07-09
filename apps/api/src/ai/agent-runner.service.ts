import { Inject, Injectable, Logger } from '@nestjs/common';
import type { AnalysisResult } from '@afdip/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfigService } from '../config/app-config.service';
import { OutputValidatorService } from './output-validator.service';
import { AI_PROVIDER, AiProvider } from './providers/ai-provider.interface';

export interface AgentRunResult {
  agentKey: string;
  status: 'succeeded' | 'failed' | 'needs_review';
  output: unknown;
  runId: string;
}

interface Pricing {
  [model: string]: { inputPerMTok: number; outputPerMTok: number };
}

/**
 * Executes a single agent run (doc 5.x pipeline):
 * prompt from Prompt Management → provider call → Output Validator
 * (schema + hallucination + coverage) → retry once → AgentRun record with
 * tokens/cost/latency (doc 5.3 observability).
 */
@Injectable()
export class AgentRunnerService {
  private readonly logger = new Logger(AgentRunnerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly validator: OutputValidatorService,
    @Inject(AI_PROVIDER) private readonly provider: AiProvider,
  ) {}

  async run(
    agentKey: string,
    fileId: string,
    payload: Record<string, unknown>,
    analysis: AnalysisResult,
  ): Promise<AgentRunResult> {
    const agent = await this.prisma.agentDefinition.findUniqueOrThrow({
      where: { key: agentKey },
    });
    const prompt = await this.prisma.promptTemplate.findFirstOrThrow({
      where: { agentId: agent.id, isActive: true },
      orderBy: { version: 'desc' },
    });
    const modelConfig = agent.modelConfig as {
      model: string;
      maxTokens: number;
    };

    const run = await this.prisma.agentRun.create({
      data: {
        agentId: agent.id,
        fileId,
        status: 'running',
        promptVersion: prompt.version,
        provider: this.provider.name,
        model: this.provider.name === 'mock' ? 'mock' : modelConfig.model,
      },
    });

    const maxRetries = await this.config.get<number>('agentMaxRetries', 1);
    const started = Date.now();
    let inputTokens = 0;
    let outputTokens = 0;
    let retries = 0;
    let parsed: unknown = null;
    let problems: string[] = [];
    let status: AgentRunResult['status'] = 'failed';

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      retries = attempt;
      try {
        // Fallback prompt (doc 5.6): a retry carries the validator's feedback
        // instead of resending the identical request verbatim.
        const feedback =
          attempt > 0 && problems.length
            ? `\n\nYour previous response was rejected by the output validator for these reasons: ${problems.join('; ')}. Correct these issues and respond again, strictly following the schema and citing only numbers that appear in the input data.`
            : '';
        const response = await this.provider.complete({
          model: modelConfig.model,
          system: prompt.systemPrompt,
          userMessage: JSON.stringify(payload) + feedback,
          maxTokens: modelConfig.maxTokens,
          responseSchema: prompt.responseSchema as object,
          metadata: { agentKey, payload },
        });
        inputTokens += response.inputTokens;
        outputTokens += response.outputTokens;

        parsed = this.parseJson(response.text);
        if (parsed === null) {
          problems = ['response is not valid JSON'];
          continue;
        }

        const schemaCheck = this.validator.validateSchema(
          `${agentKey}:v${prompt.version}`,
          prompt.responseSchema as object,
          parsed,
        );
        if (!schemaCheck.ok) {
          problems = schemaCheck.problems;
          continue;
        }

        const sourceNumbers = this.validator.collectSourceNumbers(analysis);
        const numericCheck = this.validator.checkNumericClaims(parsed, sourceNumbers);
        const coverageCheck = this.coverageCheck(agentKey, payload, parsed);
        problems = [...numericCheck.problems, ...coverageCheck.problems];

        status = problems.length === 0 ? 'succeeded' : 'needs_review';
        break;
      } catch (error) {
        problems = [error instanceof Error ? error.message : String(error)];
        this.logger.error(`Agent ${agentKey} attempt ${attempt + 1} failed: ${problems[0]}`);
      }
    }

    const latencyMs = Date.now() - started;
    const pricing = await this.config.get<Pricing>('aiPricing', {});
    const price = pricing[this.provider.name === 'mock' ? 'mock' : modelConfig.model];
    const costUsd = price
      ? (inputTokens * price.inputPerMTok + outputTokens * price.outputPerMTok) / 1_000_000
      : 0;

    await this.prisma.agentRun.update({
      where: { id: run.id },
      data: {
        status,
        inputTokens,
        outputTokens,
        costUsd,
        latencyMs,
        retries,
        output: parsed === null ? undefined : (parsed as object),
        errorMessage: problems.length ? problems.join('; ').slice(0, 2000) : null,
      },
    });

    return { agentKey, status, output: parsed, runId: run.id };
  }

  private parseJson(text: string): unknown {
    const trimmed = text
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '');
    try {
      return JSON.parse(trimmed);
    } catch {
      return null;
    }
  }

  /** Data-loss checks per agent type (doc 5.7 §3). */
  private coverageCheck(
    agentKey: string,
    payload: Record<string, unknown>,
    output: unknown,
  ): { ok: boolean; problems: string[] } {
    if (agentKey === 'semantic-financial-analyzer') {
      const inputIds = ((payload.tables as Array<{ tableId: string }>) ?? []).map(
        (t) => t.tableId,
      );
      const outputIds = (
        ((output as { tables?: Array<{ tableId: string }> }).tables ?? [])
      ).map((t) => t.tableId);
      return this.validator.checkItemCoverage(inputIds, outputIds, 'semantic tables');
    }
    if (agentKey === 'error-anomaly-detector') {
      const inputCount = ((payload.anomalies as unknown[]) ?? []).length;
      const outputCount = ((output as { anomalies?: unknown[] }).anomalies ?? []).length;
      if (inputCount !== outputCount) {
        return {
          ok: false,
          problems: [`anomaly coverage mismatch: ${inputCount} in, ${outputCount} out`],
        };
      }
    }
    return { ok: true, problems: [] };
  }
}
