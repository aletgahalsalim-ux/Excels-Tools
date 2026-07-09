import { StyleSheet } from 'react-native';
import { isRTL } from './i18n';

export const colors = {
  brand: '#1F4E79',
  brandLight: '#2E6DA4',
  bg: '#F5F7FA',
  card: '#FFFFFF',
  text: '#1A2733',
  muted: '#64748B',
  error: '#C0392B',
  warning: '#B9770E',
  info: '#2471A3',
  success: '#1E8449',
  border: '#D4DCE5',
};

export const severityColor: Record<string, string> = {
  error: colors.error,
  warning: colors.warning,
  info: colors.info,
};

export const statusColor: Record<string, string> = {
  completed: colors.success,
  failed: colors.error,
  uploaded: colors.brandLight,
  analyzing: colors.brandLight,
  analyzed: colors.brandLight,
  agents_running: colors.brandLight,
};

export const s = () =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    container: { padding: 16, gap: 12 },
    card: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      shadowColor: '#0F2846',
      shadowOpacity: 0.08,
      shadowRadius: 3,
      elevation: 2,
      gap: 8,
    },
    h1: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.brand,
      textAlign: isRTL() ? 'right' : 'left',
    },
    h2: { fontSize: 16, fontWeight: '600', color: colors.brand, textAlign: isRTL() ? 'right' : 'left' },
    text: { fontSize: 14, color: colors.text, textAlign: isRTL() ? 'right' : 'left', lineHeight: 21 },
    muted: { fontSize: 13, color: colors.muted, textAlign: isRTL() ? 'right' : 'left' },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
      backgroundColor: '#fff',
      textAlign: isRTL() ? 'right' : 'left',
      color: colors.text,
    },
    button: {
      backgroundColor: colors.brand,
      borderRadius: 8,
      paddingVertical: 12,
      alignItems: 'center',
    },
    buttonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
    badge: {
      alignSelf: isRTL() ? 'flex-end' : 'flex-start',
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 3,
    },
    badgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
    row: {
      flexDirection: isRTL() ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    link: { color: colors.brandLight, fontSize: 14 },
  });
