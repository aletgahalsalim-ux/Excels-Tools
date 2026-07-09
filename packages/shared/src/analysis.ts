/**
 * AnalysisResult — the contract produced by the Excel Analysis Engine
 * (services/excel-analyzer) and consumed by the AI Agents layer and the
 * Document Generation Engine. Mirrors schemas/analysis-result.schema.json.
 *
 * Ubiquitous language: Workbook, Sheet, DetectedTable, NamedRange, Formula.
 */

export interface NamedRange {
  name: string;
  target: string;
}

export interface MergedRange {
  range: string;
}

export type CellValue = string | number | boolean | null;

export interface DetectedTable {
  /** Stable id: `${sheetName}!${range}` */
  id: string;
  sheetName: string;
  /** A1-style range, e.g. "B2:F40" */
  range: string;
  /** 1-based row index of the detected header row inside the sheet, null if headless */
  headerRow: number | null;
  headers: string[];
  rowCount: number;
  columnCount: number;
  /** Ratio (0..1) of numeric data cells — used by the Planner to route financial tables */
  numericRatio: number;
  /** Table data rows (values only, header excluded), capped by engine config */
  rows: CellValue[][];
  /** True when rows were truncated at the engine's max_rows cap */
  truncated: boolean;
}

export interface SheetAnalysis {
  name: string;
  index: number;
  visible: boolean;
  maxRow: number;
  maxColumn: number;
  mergedCells: string[];
  detectedTables: DetectedTable[];
}

export interface FormulaInfo {
  sheetName: string;
  /** A1-style cell address */
  cell: string;
  formula: string;
  /** Cells/ranges referenced within the same sheet */
  localRefs: string[];
  /** References that cross into other sheets, e.g. "Assumptions!B4" */
  crossSheetRefs: string[];
}

export type EngineAnomalyType =
  | 'circular_reference'
  | 'hardcoded_number'
  | 'broken_reference'
  | 'dead_formula';

export interface EngineAnomaly {
  type: EngineAnomalyType;
  sheetName: string;
  cell: string;
  detail: string;
}

export interface AnalysisResult {
  engineVersion: string;
  workbook: {
    fileName: string;
    sheetCount: number;
    namedRanges: NamedRange[];
  };
  sheets: SheetAnalysis[];
  formulas: FormulaInfo[];
  anomalies: EngineAnomaly[];
  stats: {
    totalCells: number;
    totalFormulas: number;
    totalDetectedTables: number;
  };
}
