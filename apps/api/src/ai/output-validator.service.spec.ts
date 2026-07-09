import { OutputValidatorService } from './output-validator.service';
import type { AnalysisResult } from '@afdip/shared';

const analysis: AnalysisResult = {
  engineVersion: '0.1.0',
  workbook: { fileName: 'test.xlsx', sheetCount: 1, namedRanges: [] },
  sheets: [
    {
      name: 'S1',
      index: 0,
      visible: true,
      maxRow: 3,
      maxColumn: 2,
      mergedCells: [],
      detectedTables: [
        {
          id: 'S1!A1:B3',
          sheetName: 'S1',
          range: 'A1:B3',
          headerRow: 1,
          headers: ['Item', 'Value'],
          rowCount: 2,
          columnCount: 2,
          numericRatio: 0.5,
          rows: [
            ['Revenue', 1000],
            ['Costs', 400],
          ],
          truncated: false,
        },
      ],
    },
  ],
  formulas: [],
  anomalies: [],
  stats: { totalCells: 6, totalFormulas: 0, totalDetectedTables: 1 },
};

describe('OutputValidatorService', () => {
  const validator = new OutputValidatorService();

  it('accepts output matching the schema', () => {
    const schema = {
      type: 'object',
      required: ['findings'],
      properties: { findings: { type: 'array' } },
    };
    expect(validator.validateSchema('k1', schema, { findings: [] }).ok).toBe(true);
  });

  it('rejects output violating the schema', () => {
    const schema = {
      type: 'object',
      required: ['findings'],
      properties: { findings: { type: 'array' } },
    };
    const result = validator.validateSchema('k2', schema, { findings: 'nope' });
    expect(result.ok).toBe(false);
    expect(result.problems.length).toBeGreaterThan(0);
  });

  it('passes numeric claims that exist in the source workbook', () => {
    const source = validator.collectSourceNumbers(analysis);
    const output = {
      findings: [{ evidence: [1000, 400] }],
      keyFigures: [{ label: 'Revenue', value: 1000 }],
    };
    expect(validator.checkNumericClaims(output, source).ok).toBe(true);
  });

  it('flags hallucinated numbers (the core anti-hallucination guarantee)', () => {
    const source = validator.collectSourceNumbers(analysis);
    const output = { findings: [{ evidence: [999999] }] };
    const result = validator.checkNumericClaims(output, source);
    expect(result.ok).toBe(false);
    expect(result.problems[0]).toContain('999999');
  });

  it('flags output items that do not correspond to input items', () => {
    const result = validator.checkItemCoverage(['S1!A1:B3'], ['S1!A1:B3', 'FAKE!X1:Y2'], 'tables');
    expect(result.ok).toBe(false);
  });
});
