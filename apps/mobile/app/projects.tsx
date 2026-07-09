import { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, RefreshControl } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import type { ProjectDto } from '@afdip/shared';
import { api, clearSession } from '@/api';
import { t } from '@/i18n';
import { s, colors } from '@/theme';

export default function ProjectsScreen() {
  const router = useRouter();
  const st = s();
  const L = t();
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [name, setName] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      setProjects(await api.listProjects());
    } catch {
      router.replace('/');
    } finally {
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    if (!name.trim()) return;
    const project = await api.createProject(name.trim());
    setName('');
    setProjects((prev) => [project, ...prev]);
  };

  return (
    <View style={st.screen}>
      <Stack.Screen
        options={{
          title: L.projects,
          headerRight: () => (
            <TouchableOpacity
              onPress={async () => {
                await clearSession();
                router.replace('/');
              }}
            >
              <Text style={{ color: '#fff' }}>{L.logout}</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <View style={st.container}>
        <View style={st.card}>
          <Text style={st.h2}>{L.newProject}</Text>
          <TextInput style={st.input} placeholder={L.projectName} value={name} onChangeText={setName} />
          <TouchableOpacity style={st.button} onPress={create}>
            <Text style={st.buttonText}>{L.create}</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={projects}
          keyExtractor={(p) => p.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
          ListEmptyComponent={<Text style={[st.muted, { textAlign: 'center', padding: 24 }]}>{L.noProjects}</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[st.card, { marginTop: 10 }]}
              onPress={() => router.push({ pathname: '/project/[id]', params: { id: item.id, name: item.name } })}
            >
              <View style={st.row}>
                <Text style={st.h2}>{item.name}</Text>
                <Text style={[st.muted, { color: colors.brandLight }]}>›</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      </View>
    </View>
  );
}
