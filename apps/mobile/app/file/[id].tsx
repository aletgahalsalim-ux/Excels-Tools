import { useEffect, useState } from 'react';
import { ScrollView, View, Text, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { ValidationResultDto } from '@afdip/shared';
import { api, API_BASE, getToken } from '@/api';
import { t, getLocale } from '@/i18n';
import { s, severityColor } from '@/theme';

type Details = Awaited<ReturnType<typeof api.fileDetails>>;

export default function FileScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const st = s();
  const L = t();
  const [details, setDetails] = useState<Details | null>(null);
  const [results, setResults] = useState<ValidationResultDto[]>([]);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    api.fileDetails(id).then(setDetails).catch(() => undefined);
    api.fileResults(id).then(setResults).catch(() => undefined);
  }, [id]);

  const generateAndShare = async () => {
    setGenerating(true);
    try {
      const doc = await api.generateDocument(id, 'docx', getLocale());
      const token = await getToken();
      const target = `${FileSystem.cacheDirectory}report-${id}.docx`;
      const dl = await FileSystem.downloadAsync(`${API_BASE}${doc.downloadUrl}`, target, {
        headers: { Authorization: `Bearer ${token ?? ''}` },
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(dl.uri, {
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          dialogTitle: L.shareReport,
        });
      }
    } finally {
      setGenerating(false);
    }
  };

  return (
    <ScrollView style={st.screen} contentContainerStyle={st.container}>
      <Stack.Screen options={{ title: name ?? '' }} />

      <View style={st.card}>
        <Text style={st.h2}>{L.tables}</Text>
        {details?.sheets.flatMap((sheet) =>
          sheet.detectedTables.map((table) => (
            <View key={table.id} style={st.row}>
              <Text style={st.text}>
                {sheet.name} — {table.range}
              </Text>
              <Text style={st.muted}>{table.statementType ?? '—'}</Text>
            </View>
          )),
        )}
      </View>

      <View style={st.card}>
        <Text style={st.h2}>{L.results}</Text>
        {results.length === 0 ? (
          <Text style={st.muted}>{L.noResults}</Text>
        ) : (
          results.map((r) => (
            <View key={r.id} style={{ gap: 4, paddingVertical: 6 }}>
              <View style={st.row}>
                <View style={[st.badge, { backgroundColor: severityColor[r.severity] }]}>
                  <Text style={st.badgeText}>{L.severity[r.severity]}</Text>
                </View>
                <Text style={st.muted}>{[r.sheetName, r.cell].filter(Boolean).join(' / ')}</Text>
              </View>
              <Text style={st.text}>{getLocale() === 'ar' ? r.messageAr : r.message}</Text>
            </View>
          ))
        )}
      </View>

      <TouchableOpacity style={st.button} onPress={generateAndShare} disabled={generating}>
        <Text style={st.buttonText}>{generating ? L.generating : L.generateDocx}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
