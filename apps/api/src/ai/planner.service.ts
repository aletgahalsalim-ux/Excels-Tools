import { Injectable, Logger } from '@nestjs/common';
import type { AnalysisResult } from '@afdip/shared';
import { PrismaService } from '../prisma/prisma.service';

/**
 * AI Planner (doc 5.4, MVP subset) — decides which ACTIVE agents actually run
 * for a given workbook, based on the deterministic AnalysisResult. Agents
 * whose input would be empty are skipped (cost policy), and registry
 * dependency order is respected.
 */
@Injectable()
export class PlannerService {
  private readonly logger = new Logger(PlannerService.name);

  constructor(private readonly prisma: PrismaService) {}

  async plan(analysis: AnalysisResult): Promise<string[]> {
    const active = await this.prisma.agentDefinition.findMany({ where: { active: true } });
    const activeKeys = new Set(active.map((a) => a.key));

    const hasTables = analysis.sheets.some((s) => s.detectedTables.length > 0);
    const hasNumericTables = analysis.sheets.some((s) =>
      s.detectedTables.some((t) => t.numericRatio > 0.1),
    );
    const hasAnomalies = analysis.anomalies.length > 0;

    const wanted: string[] = [];
    if (hasTables) wanted.push('semantic-financial-analyzer');
    if (hasNumericTables) wanted.push('financial-validation-engine');
    if (hasAnomalies) wanted.push('error-anomaly-detector');
    if (hasTables) wanted.push('executive-summary-generator');

    const selected = wanted.filter((k) => activeKeys.has(k));

    // dependency order from the registry (topological, registry order as tiebreak)
    const byKey = new Map(active.map((a) => [a.key, a]));
    const ordered: string[] = [];
    const visit = (key: string, seen: Set<string>): void => {
      if (ordered.includes(key) || !selected.includes(key)) return;
      if (seen.has(key)) return; // defensive: registry cycles must not hang the planner
      seen.add(key);
      const deps = (byKey.get(key)?.dependencies as string[]) ?? [];
      for (const dep of deps) visit(dep, seen);
      ordered.push(key);
    };
    for (const key of selected) visit(key, new Set());

    this.logger.log(`Planner selected agents: [${ordered.join(', ')}]`);
    return ordered;
  }
}
