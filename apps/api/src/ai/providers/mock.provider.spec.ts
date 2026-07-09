import { MockProvider } from './mock.provider';

const request = (agentKey: string, payload: unknown) => ({
  model: 'mock',
  system: '',
  userMessage: JSON.stringify(payload),
  maxTokens: 1024,
  temperature: 0,
  metadata: { agentKey, payload },
});

describe('MockProvider (deterministic agent behavior)', () => {
  const provider = new MockProvider();

  const balanceTable = {
    tableId: 'BS!A1:C4',
    sheetName: 'Balance Sheet',
    headers: ['Item', '2024'],
    rows: [
      ['Total Assets', 1000000],
      ['Total Liabilities', 400000],
      ['Equity', 500000], // deliberately unbalanced: 400k + 500k != 1000k
    ],
  };

  it('classifies a balance sheet and maps concepts', async () => {
    const res = await provider.complete(
      request('semantic-financial-analyzer', { tables: [balanceTable] }),
    );
    const out = JSON.parse(res.text);
    expect(out.tables[0].statementType).toBe('balance_sheet');
    const concepts = out.tables[0].conceptMap.map((c: { concept: string }) => c.concept);
    expect(concepts).toEqual(
      expect.arrayContaining(['total_assets', 'total_liabilities', 'equity']),
    );
  });

  it('detects an unbalanced balance sheet with evidence from the source', async () => {
    const res = await provider.complete(
      request('financial-validation-engine', {
        tables: [{ ...balanceTable, statementType: 'balance_sheet' }],
      }),
    );
    const out = JSON.parse(res.text);
    expect(out.findings).toHaveLength(1);
    expect(out.findings[0].ruleKey).toBe('balance_sheet_balance');
    expect(out.findings[0].severity).toBe('error');
    expect(out.findings[0].evidence).toEqual([1000000, 400000, 500000]);
    expect(out.findings[0].messageAr).toContain('الميزانية');
  });

  it('reports no findings for a balanced sheet', async () => {
    const balanced = {
      ...balanceTable,
      statementType: 'balance_sheet',
      rows: [
        ['Total Assets', 900000],
        ['Total Liabilities', 400000],
        ['Equity', 500000],
      ],
    };
    const res = await provider.complete(
      request('financial-validation-engine', { tables: [balanced] }),
    );
    expect(JSON.parse(res.text).findings).toHaveLength(0);
  });

  it('covers every input anomaly exactly once with bilingual explanations', async () => {
    const anomalies = [
      { type: 'circular_reference', sheetName: 'M', cell: 'C3', detail: 'C3->C4->C3' },
      { type: 'hardcoded_number', sheetName: 'M', cell: 'B5', detail: '12345 in formula' },
    ];
    const res = await provider.complete(request('error-anomaly-detector', { anomalies }));
    const out = JSON.parse(res.text);
    expect(out.anomalies).toHaveLength(2);
    expect(out.anomalies[0].severity).toBe('error');
    expect(out.anomalies[1].severity).toBe('warning');
    expect(out.anomalies[0].explanationAr).toBeTruthy();
  });

  it('builds an executive summary whose key figures come from the source data', async () => {
    const res = await provider.complete(
      request('executive-summary-generator', {
        fileName: 'model.xlsx',
        tables: [balanceTable],
      }),
    );
    const out = JSON.parse(res.text);
    expect(out.titleAr).toContain('تقرير');
    for (const fig of out.keyFigures) {
      expect([1000000, 400000, 500000]).toContain(fig.value);
    }
  });
});
