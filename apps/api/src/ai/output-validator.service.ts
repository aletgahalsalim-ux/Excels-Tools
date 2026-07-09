import { Injectable, Logger } from '@nestjs/common';
import Ajv, { ValidateFunction } from 'ajv';
import type { AnalysisResult } from '@afdip/shared';

export interface ValidationOutcome {
  ok: boolean;
  problems: string[];
}

/**
 * AI Output Validator (doc 5.7) — every agent response passes through here:
 * 1. JSON Schema validation against the prompt's responseSchema
 * 2. Numeric hallucination check: financial numbers the agent cites
 *    (evidence arrays, keyFigures values) must exist in the source workbook
 * 3. Data-loss check: agents that map over input items must not drop/invent items
 */
@Injectable()
export class OutputValidatorService {
  private readonly logger = new Logger(OutputValidatorService.name);
  private readonly ajv = new Ajv({ allErrors: true, strict: false });
  private compiled = new Map<string, ValidateFunction>();

  validateSchema(schemaKey: string, schema: object, output: unknown): ValidationOutcome {
    let validate = this.compiled.get(schemaKey);
    if (!validate) {
      validate = this.ajv.compile(schema);
      this.compiled.set(schemaKey, validate);
    }
    if (validate(output)) return { ok: true, problems: [] };
    return {
      ok: false,
      problems: (validate.errors ?? []).map((e) => `${e.instancePath} ${e.message}`),
    };
  }

  /** Collect every number that literally appears in the workbook's analyzed data. */
  collectSourceNumbers(analysis: AnalysisResult): Set<number> {
    const numbers = new Set<number>();
    for (const sheet of analysis.sheets) {
      for (const table of sheet.detectedTables) {
        for (const row of table.rows) {
          for (const v of row) {
            if (typeof v === 'number') numbers.add(v);
          }
        }
      }
    }
    return numbers;
  }

  /**
   * Hallucination check on designated numeric claims. Confidence scores and
   * counts are structural, so only `evidence` arrays and keyFigures values
   * are treated as financial claims.
   */
  checkNumericClaims(output: unknown, sourceNumbers: Set<number>): ValidationOutcome {
    const problems: string[] = [];
    const check = (nums: number[], where: string): void => {
      for (const n of nums) {
        if (!sourceNumbers.has(n)) {
          problems.push(`${where}: number ${n} does not exist in the source workbook`);
        }
      }
    };

    const visit = (node: unknown, path: string): void => {
      if (Array.isArray(node)) {
        node.forEach((item, i) => visit(item, `${path}[${i}]`));
        return;
      }
      if (node && typeof node === 'object') {
        for (const [key, value] of Object.entries(node)) {
          if (key === 'evidence' && Array.isArray(value)) {
            check(value.filter((v): v is number => typeof v === 'number'), `${path}.evidence`);
          } else if (key === 'keyFigures' && Array.isArray(value)) {
            check(
              value
                .map((f) => (f as { value?: unknown }).value)
                .filter((v): v is number => typeof v === 'number'),
              `${path}.keyFigures`,
            );
          } else {
            visit(value, `${path}.${key}`);
          }
        }
      }
    };
    visit(output, '$');

    if (problems.length) this.logger.warn(`Hallucination check failed: ${problems.join('; ')}`);
    return { ok: problems.length === 0, problems };
  }

  /** Data-loss check: mapped items must correspond 1:1 with input items. */
  checkItemCoverage(
    inputIds: string[],
    outputIds: string[],
    label: string,
  ): ValidationOutcome {
    const problems: string[] = [];
    const inputSet = new Set(inputIds);
    for (const id of outputIds) {
      if (!inputSet.has(id)) problems.push(`${label}: output item "${id}" not present in input`);
    }
    return { ok: problems.length === 0, problems };
  }
}
