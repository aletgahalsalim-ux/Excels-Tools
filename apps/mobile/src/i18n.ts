import { I18nManager } from 'react-native';

export type Locale = 'ar' | 'en';

const dict = {
  ar: {
    appName: 'منصة تحليل المستندات المالية',
    tagline: 'ارفع نماذجك المالية في Excel — نفهمها، نتحقق منها، ونولّد تقارير احترافية.',
    login: 'تسجيل الدخول',
    register: 'إنشاء حساب',
    logout: 'تسجيل الخروج',
    email: 'البريد الإلكتروني',
    password: 'كلمة المرور',
    name: 'الاسم',
    organization: 'اسم المنشأة',
    noAccount: 'ليس لديك حساب؟',
    haveAccount: 'لديك حساب بالفعل؟',
    authError: 'فشل التحقق — تأكد من البيانات',
    continueWith: 'أو تابع باستخدام',
    projects: 'المشاريع',
    newProject: 'مشروع جديد',
    projectName: 'اسم المشروع',
    create: 'إنشاء',
    noProjects: 'لا مشاريع بعد — أنشئ مشروعك الأول',
    files: 'الملفات',
    upload: 'رفع ملف Excel',
    uploading: 'جارٍ الرفع...',
    noFiles: 'لا ملفات بعد — ارفع أول نموذج مالي',
    status: {
      uploaded: 'بانتظار المعالجة',
      analyzing: 'جارٍ التحليل',
      analyzed: 'اكتمل التحليل',
      agents_running: 'وكلاء الذكاء يعملون',
      completed: 'مكتمل',
      failed: 'فشل',
    } as Record<string, string>,
    results: 'نتائج التحقق',
    noResults: 'لم تُرصد أي ملاحظات — النموذج سليم.',
    severity: { error: 'خطأ', warning: 'تحذير', info: 'معلومة' } as Record<string, string>,
    tables: 'الجداول المكتشفة',
    generateDocx: 'توليد تقرير DOCX',
    generating: 'جارٍ التوليد...',
    shareReport: 'مشاركة التقرير',
    language: 'English',
  },
  en: {
    appName: 'AI Financial Document Intelligence',
    tagline: 'Upload your Excel financial models — we understand, validate, and generate professional reports.',
    login: 'Log in',
    register: 'Create account',
    logout: 'Log out',
    email: 'Email',
    password: 'Password',
    name: 'Name',
    organization: 'Organization name',
    noAccount: 'No account yet?',
    haveAccount: 'Already have an account?',
    authError: 'Authentication failed — check your details',
    continueWith: 'or continue with',
    projects: 'Projects',
    newProject: 'New project',
    projectName: 'Project name',
    create: 'Create',
    noProjects: 'No projects yet — create your first one',
    files: 'Files',
    upload: 'Upload Excel file',
    uploading: 'Uploading...',
    noFiles: 'No files yet — upload your first model',
    status: {
      uploaded: 'Queued',
      analyzing: 'Analyzing',
      analyzed: 'Analyzed',
      agents_running: 'AI agents running',
      completed: 'Completed',
      failed: 'Failed',
    } as Record<string, string>,
    results: 'Validation results',
    noResults: 'No findings — the model is clean.',
    severity: { error: 'Error', warning: 'Warning', info: 'Info' } as Record<string, string>,
    tables: 'Detected tables',
    generateDocx: 'Generate DOCX report',
    generating: 'Generating...',
    shareReport: 'Share report',
    language: 'العربية',
  },
};

let current: Locale = 'ar';

export function setLocale(locale: Locale): void {
  current = locale;
  // Full RTL flip requires an app reload; alignment styles below handle text direction.
  I18nManager.allowRTL(locale === 'ar');
}

export function getLocale(): Locale {
  return current;
}

export function t(): (typeof dict)['ar'] {
  return dict[current];
}

export const isRTL = (): boolean => current === 'ar';
