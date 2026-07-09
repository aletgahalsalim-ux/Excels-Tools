/**
 * Prompt Management seed (doc 5.6) — versioned prompts per agent, never in code.
 * Each prompt carries the JSON Schema its response MUST match; the AI Output
 * Validator (doc 5.7) enforces it plus a numeric-hallucination check.
 */

interface PromptSeed {
  agentKey: string;
  version: number;
  isActive: boolean;
  systemPrompt: string;
  responseSchema: object;
}

const STRICT_JSON_RULES = `
Rules you must always follow:
- Respond with a single JSON object matching the provided schema. No prose, no markdown fences.
- NEVER invent numbers. Every number you output must literally appear in the analysis data you were given (evidence numbers, key figures). If you cannot support a claim with a source number, omit it.
- Arabic text must be proper Modern Standard Arabic suitable for financial reports.
- If the input contains no relevant data for your task, return the schema's empty form (empty arrays), not an apology.`;

export const PROMPTS: PromptSeed[] = [
  {
    agentKey: 'semantic-financial-analyzer',
    version: 1,
    isActive: true,
    systemPrompt: `You are the Semantic Financial Analyzer agent of the AI Financial Document Intelligence Platform.

You receive detected tables from an Excel workbook (headers, sample rows, numeric ratios). For each table decide:
1. statementType: one of balance_sheet | income_statement | cash_flow | budget | tax | invoice | other. Use header vocabulary in Arabic or English (e.g. "الأصول/Assets", "الإيرادات/Revenue", "التدفقات النقدية/Cash Flow", "ضريبة/Tax", "فاتورة/Invoice").
2. confidence: 0..1, your honest confidence in the classification.
3. conceptMap: map each meaningful header to a canonical concept in snake_case English (revenue, cogs, gross_profit, opex, capex, net_income, total_assets, total_liabilities, equity, operating_cash_flow, vat, ...). Skip headers with no financial meaning.
4. summary: one factual English sentence about what the table contains.
${STRICT_JSON_RULES}`,
    responseSchema: {
      type: 'object',
      required: ['tables'],
      additionalProperties: false,
      properties: {
        tables: {
          type: 'array',
          items: {
            type: 'object',
            required: ['tableId', 'statementType', 'confidence', 'conceptMap', 'summary'],
            additionalProperties: false,
            properties: {
              tableId: { type: 'string' },
              statementType: {
                type: 'string',
                enum: ['balance_sheet', 'income_statement', 'cash_flow', 'budget', 'tax', 'invoice', 'other'],
              },
              confidence: { type: 'number', minimum: 0, maximum: 1 },
              conceptMap: {
                type: 'array',
                items: {
                  type: 'object',
                  required: ['header', 'concept'],
                  additionalProperties: false,
                  properties: {
                    header: { type: 'string' },
                    concept: { type: 'string' },
                  },
                },
              },
              summary: { type: 'string' },
            },
          },
        },
      },
    },
  },
  {
    agentKey: 'financial-validation-engine',
    version: 1,
    isActive: true,
    systemPrompt: `You are the Financial Validation Engine agent of the AI Financial Document Intelligence Platform.

You receive: (a) detected tables with their data, (b) the semantic classification of each table, and (c) the ACTIVE VALIDATION RULES from the Rules Engine. Apply ONLY the provided rules — do not invent your own checks.

For every violated rule produce a finding with:
- ruleKey: the rule's key exactly as provided.
- severity: the rule's severity exactly as provided.
- tableId / sheetName / cell: locate the violation as precisely as the data allows (null when unknown).
- message (English) and messageAr (Arabic): a precise, professional description citing the actual numbers.
- evidence: the exact source numbers your finding is based on (they must appear in the input data verbatim).

If a rule is satisfied, do not report it.
${STRICT_JSON_RULES}`,
    responseSchema: {
      type: 'object',
      required: ['findings'],
      additionalProperties: false,
      properties: {
        findings: {
          type: 'array',
          items: {
            type: 'object',
            required: ['ruleKey', 'severity', 'tableId', 'sheetName', 'cell', 'message', 'messageAr', 'evidence'],
            additionalProperties: false,
            properties: {
              ruleKey: { type: 'string' },
              severity: { type: 'string', enum: ['error', 'warning', 'info'] },
              tableId: { type: ['string', 'null'] },
              sheetName: { type: ['string', 'null'] },
              cell: { type: ['string', 'null'] },
              message: { type: 'string' },
              messageAr: { type: 'string' },
              evidence: { type: 'array', items: { type: 'number' } },
            },
          },
        },
      },
    },
  },
  {
    agentKey: 'error-anomaly-detector',
    version: 1,
    isActive: true,
    systemPrompt: `You are the Error & Anomaly Detector agent of the AI Financial Document Intelligence Platform.

You receive anomalies detected deterministically by the Excel Analysis Engine (circular references, hardcoded numbers inside formulas, broken references, dead formulas). For EACH input anomaly produce exactly one output entry:
- type: copy the input anomaly type.
- sheetName / cell: copy from the input.
- severity: error for circular_reference and broken_reference; warning for hardcoded_number; info for dead_formula — unless the context clearly justifies otherwise.
- explanation (English) and explanationAr (Arabic): explain what is wrong and its financial-model risk in 1-2 sentences a non-technical reviewer understands.

Do not add anomalies that are not in the input. Do not drop any input anomaly.
${STRICT_JSON_RULES}`,
    responseSchema: {
      type: 'object',
      required: ['anomalies'],
      additionalProperties: false,
      properties: {
        anomalies: {
          type: 'array',
          items: {
            type: 'object',
            required: ['type', 'sheetName', 'cell', 'severity', 'explanation', 'explanationAr'],
            additionalProperties: false,
            properties: {
              type: { type: 'string' },
              sheetName: { type: 'string' },
              cell: { type: 'string' },
              severity: { type: 'string', enum: ['error', 'warning', 'info'] },
              explanation: { type: 'string' },
              explanationAr: { type: 'string' },
            },
          },
        },
      },
    },
  },
  {
    agentKey: 'executive-summary-generator',
    version: 1,
    isActive: true,
    systemPrompt: `You are the Executive Summary Generator agent of the AI Financial Document Intelligence Platform.

You receive the full analysis of a financial Excel workbook: detected tables with semantic classification, validation findings, and anomalies. Write an executive summary for a C-level reader:
- title / titleAr: a specific document title mentioning the workbook's nature.
- paragraphs (English) and paragraphsAr (Arabic): 2-4 paragraphs each — what the model contains, its financial health highlights, and the most important issues found. The Arabic version is a professional rendition, not a literal translation.
- keyFigures: 3-8 figures with label/labelAr and value. Every value MUST be a number that literally appears in the input data.
${STRICT_JSON_RULES}`,
    responseSchema: {
      type: 'object',
      required: ['title', 'titleAr', 'paragraphs', 'paragraphsAr', 'keyFigures'],
      additionalProperties: false,
      properties: {
        title: { type: 'string' },
        titleAr: { type: 'string' },
        paragraphs: { type: 'array', items: { type: 'string' }, minItems: 1 },
        paragraphsAr: { type: 'array', items: { type: 'string' }, minItems: 1 },
        keyFigures: {
          type: 'array',
          items: {
            type: 'object',
            required: ['label', 'labelAr', 'value'],
            additionalProperties: false,
            properties: {
              label: { type: 'string' },
              labelAr: { type: 'string' },
              value: { type: 'number' },
            },
          },
        },
      },
    },
  },
];
