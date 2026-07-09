import { Injectable } from '@nestjs/common';
import {
  AiCompletionRequest,
  AiCompletionResponse,
  AiProvider,
} from './ai-provider.interface';

interface MockTable {
  tableId: string;
  sheetName: string;
  headers: string[];
  rows: (string | number | boolean | null)[][];
  statementType?: string;
}

interface MockPayload {
  fileName?: string;
  tables?: MockTable[];
  anomalies?: Array<{ type: string; sheetName: string; cell: string; detail: string }>;
}

const STATEMENT_KEYWORDS: Array<{ type: string; words: string[] }> = [
  { type: 'balance_sheet', words: ['asset', 'liabilit', 'equity', 'أصول', 'خصوم', 'ميزانية', 'حقوق الملكية'] },
  { type: 'cash_flow', words: ['cash flow', 'تدفق'] },
  { type: 'income_statement', words: ['revenue', 'income', 'cogs', 'profit', 'إيراد', 'دخل', 'ربح'] },
  { type: 'tax', words: ['tax', 'vat', 'ضريب'] },
  { type: 'invoice', words: ['invoice', 'فاتورة'] },
  { type: 'budget', words: ['budget', 'ميزانية تقديرية', 'موازنة'] },
];

const CONCEPTS: Record<string, string[]> = {
  revenue: ['revenue', 'sales', 'إيراد', 'مبيعات'],
  cogs: ['cogs', 'cost of goods', 'تكلفة المبيعات'],
  gross_profit: ['gross profit', 'الربح الإجمالي', 'مجمل الربح'],
  opex: ['opex', 'operating expense', 'مصاريف تشغيل'],
  net_income: ['net income', 'net profit', 'صافي الدخل', 'صافي الربح'],
  total_assets: ['total assets', 'إجمالي الأصول', 'مجموع الأصول'],
  total_liabilities: ['total liabilities', 'إجمالي الخصوم', 'مجموع الخصوم', 'إجمالي الالتزامات'],
  equity: ['equity', 'حقوق الملكية', 'حقوق المساهمين'],
  costs: ['costs', 'total costs', 'التكاليف', 'إجمالي التكاليف'],
};

function classify(table: MockTable): string {
  const haystack = [table.sheetName, ...table.headers, ...table.rows.map((r) => String(r[0] ?? ''))]
    .join(' ')
    .toLowerCase();
  for (const { type, words } of STATEMENT_KEYWORDS) {
    if (words.some((w) => haystack.includes(w))) return type;
  }
  return 'other';
}

function conceptOf(label: string): string | null {
  const l = label.toLowerCase().trim();
  for (const [concept, words] of Object.entries(CONCEPTS)) {
    if (words.some((w) => l.includes(w))) return concept;
  }
  return null;
}

/** Locate rows by concept and return their first numeric value per column set. */
function conceptValues(table: MockTable): Map<string, number> {
  const values = new Map<string, number>();
  for (const row of table.rows) {
    const concept = conceptOf(String(row[0] ?? ''));
    if (!concept) continue;
    const num = row.find((v): v is number => typeof v === 'number');
    if (num !== undefined && !values.has(concept)) values.set(concept, num);
  }
  return values;
}

/**
 * MockProvider — deterministic agent responses derived ONLY from the input
 * payload, so they always survive the Output Validator's hallucination check.
 * Used in tests and whenever AI_PROVIDER=mock (e.g. no API key configured).
 */
@Injectable()
export class MockProvider implements AiProvider {
  readonly name = 'mock';

  async complete(request: AiCompletionRequest): Promise<AiCompletionResponse> {
    const agentKey = request.metadata?.agentKey ?? '';
    const payload = (request.metadata?.payload ?? {}) as MockPayload;

    let result: unknown;
    switch (agentKey) {
      case 'semantic-financial-analyzer':
        result = this.semantic(payload);
        break;
      case 'financial-validation-engine':
        result = this.validate(payload);
        break;
      case 'error-anomaly-detector':
        result = this.anomalies(payload);
        break;
      case 'executive-summary-generator':
        result = this.summary(payload);
        break;
      default:
        result = {};
    }

    const text = JSON.stringify(result);
    return { text, inputTokens: 0, outputTokens: 0 };
  }

  private semantic(payload: MockPayload) {
    return {
      tables: (payload.tables ?? []).map((t) => ({
        tableId: t.tableId,
        statementType: classify(t),
        confidence: 0.9,
        conceptMap: t.rows
          .map((r) => String(r[0] ?? ''))
          .map((header) => ({ header, concept: conceptOf(header) }))
          .filter((m): m is { header: string; concept: string } => m.concept !== null),
        summary: `Table with ${t.rows.length} rows on sheet ${t.sheetName}.`,
      })),
    };
  }

  private validate(payload: MockPayload) {
    const findings: object[] = [];
    for (const t of payload.tables ?? []) {
      const type = t.statementType ?? classify(t);
      const v = conceptValues(t);
      if (type === 'balance_sheet') {
        const assets = v.get('total_assets');
        const liabilities = v.get('total_liabilities');
        const equity = v.get('equity');
        if (
          assets !== undefined &&
          liabilities !== undefined &&
          equity !== undefined &&
          Math.abs(assets - (liabilities + equity)) > 0.01
        ) {
          findings.push({
            ruleKey: 'balance_sheet_balance',
            severity: 'error',
            tableId: t.tableId,
            sheetName: t.sheetName,
            cell: null,
            message: `Balance sheet does not balance: assets ${assets} != liabilities ${liabilities} + equity ${equity}.`,
            messageAr: `الميزانية العمومية غير متوازنة: الأصول ${assets} لا تساوي الخصوم ${liabilities} زائد حقوق الملكية ${equity}.`,
            evidence: [assets, liabilities, equity],
          });
        }
      }
      if (type === 'income_statement') {
        const revenue = v.get('revenue');
        if (revenue !== undefined && revenue < 0) {
          findings.push({
            ruleKey: 'negative_revenue',
            severity: 'warning',
            tableId: t.tableId,
            sheetName: t.sheetName,
            cell: null,
            message: `Revenue is negative: ${revenue}.`,
            messageAr: `الإيرادات سالبة: ${revenue}.`,
            evidence: [revenue],
          });
        }
        const netIncome = v.get('net_income');
        const costs = v.get('costs');
        if (
          revenue !== undefined &&
          costs !== undefined &&
          netIncome !== undefined &&
          Math.abs(netIncome - (revenue - costs)) > 0.01
        ) {
          findings.push({
            ruleKey: 'net_income_consistency',
            severity: 'error',
            tableId: t.tableId,
            sheetName: t.sheetName,
            cell: null,
            message: `Net income ${netIncome} does not equal revenue ${revenue} minus costs ${costs}.`,
            messageAr: `صافي الدخل ${netIncome} لا يساوي الإيرادات ${revenue} ناقص التكاليف ${costs}.`,
            evidence: [netIncome, revenue, costs],
          });
        }
      }
    }
    return { findings };
  }

  private anomalies(payload: MockPayload) {
    const severity: Record<string, string> = {
      circular_reference: 'error',
      broken_reference: 'error',
      hardcoded_number: 'warning',
      dead_formula: 'info',
    };
    return {
      anomalies: (payload.anomalies ?? []).map((a) => ({
        type: a.type,
        sheetName: a.sheetName,
        cell: a.cell,
        severity: severity[a.type] ?? 'info',
        explanation: `${a.detail}. This can distort financial results.`,
        explanationAr: `تم رصد مشكلة (${a.type}) في الخلية ${a.cell}: قد تؤثر على دقة النموذج المالي.`,
      })),
    };
  }

  private summary(payload: MockPayload) {
    const figures: Array<{ label: string; labelAr: string; value: number }> = [];
    for (const t of payload.tables ?? []) {
      for (const [concept, value] of conceptValues(t)) {
        if (figures.length >= 6) break;
        figures.push({ label: concept.replace(/_/g, ' '), labelAr: concept, value });
      }
    }
    return {
      title: `Financial Analysis Report — ${payload.fileName ?? 'Workbook'}`,
      titleAr: `تقرير التحليل المالي — ${payload.fileName ?? 'ملف'}`,
      paragraphs: [
        `This report analyzes the uploaded workbook ${payload.fileName ?? ''} containing ${payload.tables?.length ?? 0} detected table(s).`,
        'The analysis covers structure detection, financial validation and anomaly review.',
      ],
      paragraphsAr: [
        `يحلل هذا التقرير ملف العمل المرفوع ${payload.fileName ?? ''} والذي يحتوي على ${payload.tables?.length ?? 0} جدولاً مكتشفاً.`,
        'يغطي التحليل اكتشاف البنية والتحقق المالي ومراجعة الحالات الشاذة.',
      ],
      keyFigures: figures,
    };
  }
}
