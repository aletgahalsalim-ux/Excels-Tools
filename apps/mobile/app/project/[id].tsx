import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, RefreshControl } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import type { UploadedFileDto } from '@afdip/shared';
import { api } from '@/api';
import { t } from '@/i18n';
import { s, statusColor, colors } from '@/theme';

const ACTIVE = ['uploaded', 'analyzing', 'analyzed', 'agents_running'];

export default function ProjectScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const router = useRouter();
  const st = s();
  const L = t();
  const [files, setFiles] = useState<UploadedFileDto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      setFiles(await api.listFiles(id));
    } catch {
      router.replace('/');
    }
  }, [id, router]);

  useEffect(() => {
    void load();
  }, [load]);

  // poll while any file is still in the pipeline
  useEffect(() => {
    if (timer.current) clearInterval(timer.current);
    if (files.some((f) => ACTIVE.includes(f.status))) {
      timer.current = setInterval(load, 3000);
    }
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [files, load]);

  const upload = async () => {
    const picked = await DocumentPicker.getDocumentAsync({
      type: [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel.sheet.macroEnabled.12',
      ],
      copyToCacheDirectory: true,
    });
    if (picked.canceled || !picked.assets[0]) return;
    setUploading(true);
    try {
      const a = picked.assets[0];
      await api.uploadFile(id, { uri: a.uri, name: a.name, mimeType: a.mimeType });
      await load();
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={st.screen}>
      <Stack.Screen options={{ title: name ?? L.files }} />
      <View style={st.container}>
        <TouchableOpacity style={st.button} onPress={upload} disabled={uploading}>
          <Text style={st.buttonText}>{uploading ? L.uploading : L.upload}</Text>
        </TouchableOpacity>

        <FlatList
          data={files}
          keyExtractor={(f) => f.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
          ListEmptyComponent={<Text style={[st.muted, { textAlign: 'center', padding: 24 }]}>{L.noFiles}</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[st.card, { marginTop: 10 }]}
              disabled={item.status !== 'completed'}
              onPress={() => router.push({ pathname: '/file/[id]', params: { id: item.id, name: item.fileName } })}
            >
              <View style={st.row}>
                <Text style={[st.text, { flex: 1 }]} numberOfLines={1}>
                  {item.fileName}
                </Text>
                <View style={[st.badge, { backgroundColor: statusColor[item.status] ?? colors.brandLight }]}>
                  <Text style={st.badgeText}>{L.status[item.status] ?? item.status}</Text>
                </View>
              </View>
              {item.errorMessage ? <Text style={[st.muted, { color: colors.error }]}>{item.errorMessage}</Text> : null}
            </TouchableOpacity>
          )}
        />
      </View>
    </View>
  );
}
