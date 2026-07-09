# Context Pack — v1 (بعد بناء الشريحة العمودية الأولى)
> تُحدَّث هذه الحزمة بعد كل بوابة جودة. الحد الأقصى: صفحتان.

## 1. تعريف المشروع (سطران)
منصة SaaS باسم **AI Financial Document Intelligence Platform**: تستقبل ملفات Excel لنماذج مالية معقدة (دراسات جدوى، ميزانيات، قوائم مالية، حسابات ضريبية، فواتير)، تفهم بنيتها بالكامل، تتحقق منها مالياً ومنطقياً، وتولّد مستندات احترافية — عبر طبقة AI Agents متخصصة.

## 2. المنصات الفرعية الخمس
1. Document Intelligence — فهم وتحليل Excel ✅ (محرك Python مبني)
2. Financial Intelligence — تحقق مالي، كشف مخاطر وأخطاء ✅ (وكلاء + Rules Engine)
3. AI Authoring — توليد مستندات بمحتوى ذكي ✅ (DOCX/HTML ثنائي اللغة)
4. Collaboration & Workflow — مراجعات، موافقات، RBAC، تدقيق ◐ (RBAC + Audit فقط)
5. Integration Hub — ERP/CRM/Power BI + تخزين سحابي ✗ [Phase 2]

## 3. الوكلاء الاثنا عشر (المسجلون في Agent Registry)
| # | الوكيل | الحالة |
|---|---|---|
| 1-3 | Excel Structure Analyzer · Smart Data Recognition · Formula & Dependency Analyzer | مغطاة حتمياً بمحرك التحليل (بلا LLM) |
| 4 | Semantic Financial Analyzer | ✅ مفعّل [MVP] |
| 5 | Financial Validation Engine | ✅ مفعّل [MVP] |
| 6 | Error & Anomaly Detector | ✅ مفعّل [MVP] |
| 12 | Executive Summary Generator | ✅ مفعّل [MVP] |
| 7-11 | Consistency Checker · Formula Explainer · Document Generator (LLM) · Document Reviewer · Translation Agent | مسجلون inactive [Phase 2] |

## 4. القرارات المعتمدة — انظر `decision-log.md` (D-001 → D-012)

## 5. القاموس الموحد
- **Workbook** = ملف Excel المرفوع (`UploadedFile`) · **Sheet** = ورقة داخله
- **Detected Table** = جدول اكتشفه المحرك تلقائياً (flood fill + header heuristics)
- **Financial Statement** = balance_sheet / income_statement / cash_flow / budget / tax / invoice
- **Validation Result** = ناتج التحقق بمستوياته (error/warning/info) ومصدره (engine/agent)
- **Generated Document** = المستند المولَّد (docx/html × ar/en) بنسخ `DocumentVersion`
- **Agent** = وكيل مسجل في `AgentDefinition` · **Planner** = يقرر أي الوكلاء تُفعَّل لكل ملف
- **AnalysisResult** = عقد JSON بين محرك Python وطبقة الوكلاء (`packages/shared/schemas`)

## 6. أوسمة النطاق
[MVP] ✅ مبني · [Phase 2] مصمَّم ومسجَّل، غير منفَّذ · [Phase 3] Knowledge Graph

## 7. الحالة الحالية
▶ **الشريحة العمودية الأولى مكتملة وموثّقة بالاختبارات**: رفع → تحليل → وكلاء → تحقق → DOCX/HTML.
التالي المقترح: تفعيل مزود Anthropic فعلياً (مفتاح API) ثم Consistency Checker وFormula Explainer، أو Workflow/Approvals.
