import { PlannerService } from './planner.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { AnalysisResult } from '@afdip/shared';

const ACTIVE_AGENTS = [
  { key: 'semantic-financial-analyzer', dependencies: [] },
  { key: 'financial-validation-engine', dependencies: ['semantic-financial-analyzer'] },
  { key: 'error-anomaly-detector', dependencies: [] },
  {
    key: 'executive-summary-generator',
    dependencies: ['semantic-financial-analyzer', 'financial-validation-engine'],
  },
];

const prismaStub = {
  agentDefinition: { findMany: jest.fn().mockResolvedValue(ACTIVE_AGENTS) },
} as unknown as PrismaService;

const analysisWith = (opts: { tables?: boolean; numeric?: boolean; anomalies?: boolean }) =>
  ({
    engineVersion: '0.1.0',
    workbook: { fileName: 'f.xlsx', sheetCount: 1, namedRanges: [] },
    sheets: [
      {
        name: 'S1',
        index: 0,
        visible: true,
        maxRow: 5,
        maxColumn: 5,
        mergedCells: [],
        detectedTables: opts.tables
          ? [
              {
                id: 'S1!A1:B2',
                sheetName: 'S1',
                range: 'A1:B2',
                headerRow: 1,
                headers: ['a'],
                rowCount: 1,
                columnCount: 2,
                numericRatio: opts.numeric ? 0.5 : 0,
                rows: [['x', 1]],
                truncated: false,
              },
            ]
          : [],
      },
    ],
    formulas: [],
    anomalies: opts.anomalies
      ? [{ type: 'circular_reference', sheetName: 'S1', cell: 'A1', detail: 'd' }]
      : [],
    stats: { totalCells: 1, totalFormulas: 0, totalDetectedTables: opts.tables ? 1 : 0 },
  }) as AnalysisResult;

describe('PlannerService', () => {
  const planner = new PlannerService(prismaStub);

  it('runs the full pipeline for a numeric workbook with anomalies, in dependency order', async () => {
    const plan = await planner.plan(analysisWith({ tables: true, numeric: true, anomalies: true }));
    expect(plan).toEqual([
      'semantic-financial-analyzer',
      'financial-validation-engine',
      'error-anomaly-detector',
      'executive-summary-generator',
    ]);
    expect(plan.indexOf('semantic-financial-analyzer')).toBeLessThan(
      plan.indexOf('financial-validation-engine'),
    );
  });

  it('skips the validation engine when tables are not numeric', async () => {
    const plan = await planner.plan(analysisWith({ tables: true, numeric: false }));
    expect(plan).not.toContain('financial-validation-engine');
    expect(plan).toContain('semantic-financial-analyzer');
  });

  it('skips the anomaly agent when the engine found no anomalies', async () => {
    const plan = await planner.plan(analysisWith({ tables: true, numeric: true }));
    expect(plan).not.toContain('error-anomaly-detector');
  });

  it('plans nothing for a workbook with no tables', async () => {
    const plan = await planner.plan(analysisWith({}));
    expect(plan).toEqual([]);
  });
});
