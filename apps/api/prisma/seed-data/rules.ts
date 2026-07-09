/**
 * Rules Engine seed (doc 5.9) — financial validation rules live in the DB,
 * never buried in code. Admins can edit them without a deploy.
 */

interface RuleSeed {
  ruleKey: string;
  ruleType: string;
  name: string;
  nameAr: string;
  severity: 'error' | 'warning' | 'info';
  definition: object;
}

export const RULES: RuleSeed[] = [
  {
    ruleKey: 'balance_sheet_balance',
    ruleType: 'validation',
    name: 'Balance sheet must balance',
    nameAr: 'يجب أن تتوازن الميزانية العمومية',
    severity: 'error',
    definition: {
      appliesTo: 'balance_sheet',
      check: 'total_assets == total_liabilities + equity',
      tolerance: 0.01,
      description:
        'Total assets must equal total liabilities plus equity within tolerance. Uses conceptMap to locate the three totals.',
    },
  },
  {
    ruleKey: 'negative_revenue',
    ruleType: 'validation',
    name: 'Revenue should not be negative',
    nameAr: 'الإيرادات لا يجوز أن تكون سالبة',
    severity: 'warning',
    definition: {
      appliesTo: 'income_statement',
      check: 'revenue >= 0',
      description: 'Negative revenue usually indicates a sign error or misclassified refunds.',
    },
  },
  {
    ruleKey: 'net_income_consistency',
    ruleType: 'validation',
    name: 'Net income should equal revenue minus total costs',
    nameAr: 'صافي الدخل يجب أن يساوي الإيرادات ناقص إجمالي التكاليف',
    severity: 'error',
    definition: {
      appliesTo: 'income_statement',
      check: 'net_income == revenue - total_costs',
      tolerance: 0.01,
      description: 'When revenue, total costs and net income are all present, they must reconcile.',
    },
  },
  {
    ruleKey: 'gross_margin_sanity',
    ruleType: 'validation',
    name: 'Gross margin must be between -100% and 100%',
    nameAr: 'هامش الربح الإجمالي يجب أن يكون بين -100% و 100%',
    severity: 'warning',
    definition: {
      appliesTo: 'income_statement',
      check: '-1 <= (gross_profit / revenue) <= 1',
      description: 'A gross margin outside this band almost always indicates a data or formula error.',
    },
  },
  {
    ruleKey: 'cash_flow_reconciliation',
    ruleType: 'validation',
    name: 'Cash flow sections must sum to net change in cash',
    nameAr: 'أقسام التدفق النقدي يجب أن تساوي صافي التغير في النقد',
    severity: 'error',
    definition: {
      appliesTo: 'cash_flow',
      check: 'operating_cash_flow + investing_cash_flow + financing_cash_flow == net_change_in_cash',
      tolerance: 0.01,
      description: 'The three cash-flow sections must reconcile to the reported net change in cash.',
    },
  },
  {
    ruleKey: 'export_default_style',
    ruleType: 'export',
    name: 'Default export style',
    nameAr: 'نمط التصدير الافتراضي',
    severity: 'info',
    definition: {
      appliesTo: 'document',
      style: 'professional',
      brandColor: '1F4E79',
      fontLatin: 'Calibri',
      fontArabic: 'Traditional Arabic',
      includeCover: true,
      includeValidationReport: true,
    },
  },
];
