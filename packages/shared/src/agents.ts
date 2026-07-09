/**
 * Agent output contracts — every AI agent MUST return JSON matching its
 * schema (enforced by the AI Output Validator). The JSON Schemas used at
 * runtime live in the PromptTemplate table (seeded from
 * schemas/agent-outputs/), these types mirror them for compile-time safety.
 */

export type AgentKey =
  | 'excel-structure-analyzer'
  | 'smart-data-recognition'
  | 'formula-dependency-analyzer'
  | 'semantic-financial-analyzer'
  | 'financial-validation-engine'
  | 'error-anomaly-detector'
  | 'consistency-checker'
  | 'formula-explainer'
  | 'document-generator'
  | 'document-reviewer'
  | 'translation-agent'
  | 'executive-summary-generator';

export type ValidationSeverity = 'error' | 'warning' | 'info';

export type FinancialStatementType =
  | 'balance_sheet'
  | 'income_statement'
  | 'cash_flow'
  | 'budget'
  | 'tax'
  | 'invoice'
  | 'other';

/** semantic-financial-analyzer output */
export interface SemanticAnalysis {
  tables: Array<{
    tableId: string;
    statementType: FinancialStatementType;
    confidence: number;
    /** header → canonical financial concept, e.g. "الإيرادات" → "revenue" */
    conceptMap: Array<{ header: string; concept: string }>;
    summary: string;
  }>;
}

/** financial-validation-engine output */
export interface FinancialValidation {
  findings: Array<{
    ruleKey: string;
    severity: ValidationSeverity;
    tableId: string | null;
    sheetName: string | null;
    cell: string | null;
    message: string;
    messageAr: string;
    /** Numbers the finding is based on — each must exist in the source AnalysisResult */
    evidence: number[];
  }>;
}

/** error-anomaly-detector output */
export interface AnomalyReport {
  anomalies: Array<{
    type: string;
    sheetName: string;
    cell: string;
    severity: ValidationSeverity;
    explanation: string;
    explanationAr: string;
  }>;
}

/** executive-summary-generator output */
export interface ExecutiveSummary {
  title: string;
  titleAr: string;
  paragraphs: string[];
  paragraphsAr: string[];
  keyFigures: Array<{ label: string; labelAr: string; value: number }>;
}
