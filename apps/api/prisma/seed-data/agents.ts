/**
 * Agent Registry seed — all 12 agents from the approved list (context pack §3).
 * Only the 4 MVP agents are active; the rest are registered as [Phase 2/3]
 * so activating them later is a config change, not a code change.
 */

interface AgentSeed {
  key: string;
  version: string;
  name: string;
  description: string;
  scopeTag: string;
  active: boolean;
  dependencies: string[];
  capabilities: string[];
  modelConfig: { provider: string; model: string; maxTokens: number; temperature: number };
}

const DEFAULT_MODEL = { provider: 'anthropic', model: 'claude-sonnet-5', maxTokens: 4096, temperature: 0 };

export const AGENTS: AgentSeed[] = [
  {
    key: 'excel-structure-analyzer',
    version: '1.0.0',
    name: 'Excel Structure Analyzer',
    description:
      'Understands sheets, ranges and workbook layout. MVP: fully covered deterministically by the Excel Analysis Engine, so no LLM run is needed.',
    scopeTag: '[MVP]',
    active: false,
    dependencies: [],
    capabilities: ['structure', 'sheets', 'ranges'],
    modelConfig: DEFAULT_MODEL,
  },
  {
    key: 'smart-data-recognition',
    version: '1.0.0',
    name: 'Smart Data Recognition Engine',
    description:
      'Detects tables, pivots, dashboards, financial statements, charts, named ranges and hidden logic. MVP: table/named-range detection is deterministic in the engine; statement classification is delegated to semantic-financial-analyzer.',
    scopeTag: '[MVP]',
    active: false,
    dependencies: ['excel-structure-analyzer'],
    capabilities: ['table-detection', 'statement-detection'],
    modelConfig: DEFAULT_MODEL,
  },
  {
    key: 'formula-dependency-analyzer',
    version: '1.0.0',
    name: 'Formula & Dependency Analyzer',
    description:
      'Builds the dependency graph between cells and sheets. MVP: deterministic in the Excel Analysis Engine.',
    scopeTag: '[MVP]',
    active: false,
    dependencies: ['excel-structure-analyzer'],
    capabilities: ['dependency-graph', 'cross-sheet-refs'],
    modelConfig: DEFAULT_MODEL,
  },
  {
    key: 'semantic-financial-analyzer',
    version: '1.0.0',
    name: 'Semantic Financial Analyzer',
    description:
      'Classifies detected tables as financial statements (balance sheet / income statement / cash flow / budget / tax / invoice) and maps headers to canonical financial concepts (AR/EN).',
    scopeTag: '[MVP]',
    active: true,
    dependencies: ['smart-data-recognition'],
    capabilities: ['statement-classification', 'concept-mapping', 'ar-en'],
    modelConfig: DEFAULT_MODEL,
  },
  {
    key: 'financial-validation-engine',
    version: '1.0.0',
    name: 'Financial Validation Engine',
    description:
      'Validates balance-sheet balance, cash-flow coherence and ratio sanity using active Rules Engine rules. Produces ValidationResults with numeric evidence.',
    scopeTag: '[MVP]',
    active: true,
    dependencies: ['semantic-financial-analyzer'],
    capabilities: ['balance-check', 'ratio-check', 'rules-engine'],
    modelConfig: DEFAULT_MODEL,
  },
  {
    key: 'error-anomaly-detector',
    version: '1.0.0',
    name: 'Error & Anomaly Detector',
    description:
      'Explains engine-detected anomalies (circular references, hardcoded numbers, broken references, dead formulas) and assigns severity, in Arabic and English.',
    scopeTag: '[MVP]',
    active: true,
    dependencies: ['formula-dependency-analyzer'],
    capabilities: ['anomaly-explanation', 'severity-assignment'],
    modelConfig: DEFAULT_MODEL,
  },
  {
    key: 'consistency-checker',
    version: '1.0.0',
    name: 'Consistency Checker',
    description: 'Checks data consistency across multiple sheets.',
    scopeTag: '[Phase 2]',
    active: false,
    dependencies: ['semantic-financial-analyzer'],
    capabilities: ['cross-sheet-consistency'],
    modelConfig: DEFAULT_MODEL,
  },
  {
    key: 'formula-explainer',
    version: '1.0.0',
    name: 'Formula Explainer',
    description: 'Translates complex formulas into human-readable explanations.',
    scopeTag: '[Phase 2]',
    active: false,
    dependencies: ['formula-dependency-analyzer'],
    capabilities: ['formula-explanation'],
    modelConfig: DEFAULT_MODEL,
  },
  {
    key: 'document-generator',
    version: '1.0.0',
    name: 'Document/Word Generator',
    description:
      'Builds the final document. MVP: deterministic Document Generation Engine consumes agent outputs directly; LLM-driven narrative composition is Phase 2.',
    scopeTag: '[MVP]',
    active: false,
    dependencies: ['executive-summary-generator'],
    capabilities: ['docx', 'html'],
    modelConfig: DEFAULT_MODEL,
  },
  {
    key: 'document-reviewer',
    version: '1.0.0',
    name: 'Document Reviewer',
    description: 'Reviews generated document quality before delivery.',
    scopeTag: '[Phase 2]',
    active: false,
    dependencies: ['document-generator'],
    capabilities: ['quality-review'],
    modelConfig: DEFAULT_MODEL,
  },
  {
    key: 'translation-agent',
    version: '1.0.0',
    name: 'Translation Agent (AR/EN)',
    description:
      'Dedicated AR/EN translation. MVP: active agents return bilingual output directly; a dedicated pass is Phase 2.',
    scopeTag: '[Phase 2]',
    active: false,
    dependencies: [],
    capabilities: ['translation-ar-en'],
    modelConfig: DEFAULT_MODEL,
  },
  {
    key: 'executive-summary-generator',
    version: '1.0.0',
    name: 'Executive Summary Generator',
    description:
      'Summarizes the entire financial model (AR/EN) with key figures backed by source numbers.',
    scopeTag: '[MVP]',
    active: true,
    dependencies: ['semantic-financial-analyzer', 'financial-validation-engine'],
    capabilities: ['executive-summary', 'ar-en'],
    modelConfig: { ...DEFAULT_MODEL, maxTokens: 8192 },
  },
];
