import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import type { AuthResponseDto } from '@afdip/shared';
import { api, API_BASE, getToken, setSession } from '@/api';
import { t, getLocale, setLocale } from '@/i18n';
import { s, colors } from '@/theme';

WebBrowser.maybeCompleteAuthSession();

export default function AuthScreen() {
  const router = useRouter();
  const st = s();
  const L = t();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [providers, setProviders] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState({ email: '', password: '', name: '', organizationName: '' });
  const [, force] = useState(0);

  useEffect(() => {
    getToken().then((tok) => tok && router.replace('/projects'));
    api.providers().then(setProviders).catch(() => undefined);
  }, [router]);

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const auth =
        mode === 'login'
          ? await api.login({ email: form.email, password: form.password })
          : await api.register(form);
      await setSession(auth);
      router.replace('/projects');
    } catch {
      setError(L.authError);
    } finally {
      setBusy(false);
    }
  };

  const social = async (provider: string) => {
    const redirect = Linking.createURL('auth');
    const result = await WebBrowser.openAuthSessionAsync(
      `${API_BASE}/api/v1/auth/oauth/${provider}?locale=${getLocale()}&client=mobile`,
      redirect,
    );
    if (result.type === 'success' && result.url.includes('session=')) {
      const encoded = /session=([^&]+)/.exec(result.url)?.[1] ?? '';
      const json = decodeURIComponent(encoded).replace(/-/g, '+').replace(/_/g, '/');
      const auth = JSON.parse(
        typeof atob === 'function' ? atob(json) : Buffer.from(json, 'base64').toString('utf8'),
      ) as AuthResponseDto;
      await setSession(auth);
      router.replace('/projects');
    }
  };

  const enabled = ['google', 'microsoft', 'apple'].filter((p) => providers[p]);

  return (
    <ScrollView style={st.screen} contentContainerStyle={[st.container, { paddingTop: 48 }]}>
      <Stack.Screen options={{ title: L.appName }} />
      <View style={st.card}>
        <Text style={st.h1}>{mode === 'login' ? L.login : L.register}</Text>
        <Text style={st.muted}>{L.tagline}</Text>

        {mode === 'register' && (
          <>
            <TextInput
              style={st.input}
              placeholder={L.name}
              value={form.name}
              onChangeText={(v) => setForm({ ...form, name: v })}
            />
            <TextInput
              style={st.input}
              placeholder={L.organization}
              value={form.organizationName}
              onChangeText={(v) => setForm({ ...form, organizationName: v })}
            />
          </>
        )}
        <TextInput
          style={st.input}
          placeholder={L.email}
          autoCapitalize="none"
          keyboardType="email-address"
          value={form.email}
          onChangeText={(v) => setForm({ ...form, email: v })}
        />
        <TextInput
          style={st.input}
          placeholder={L.password}
          secureTextEntry
          value={form.password}
          onChangeText={(v) => setForm({ ...form, password: v })}
        />
        {error ? <Text style={[st.muted, { color: colors.error }]}>{error}</Text> : null}
        <TouchableOpacity style={st.button} onPress={submit} disabled={busy}>
          <Text style={st.buttonText}>{mode === 'login' ? L.login : L.register}</Text>
        </TouchableOpacity>

        {enabled.length > 0 && (
          <>
            <Text style={[st.muted, { textAlign: 'center', marginTop: 8 }]}>{L.continueWith}</Text>
            {enabled.map((p) => (
              <TouchableOpacity
                key={p}
                style={[st.button, { backgroundColor: p === 'apple' ? '#000' : '#fff', borderWidth: 1, borderColor: colors.border }]}
                onPress={() => social(p)}
              >
                <Text style={[st.buttonText, { color: p === 'apple' ? '#fff' : colors.text }]}>
                  {p === 'google' ? 'Google' : p === 'microsoft' ? 'Microsoft' : 'Apple'}
                </Text>
              </TouchableOpacity>
            ))}
          </>
        )}

        <TouchableOpacity onPress={() => setMode(mode === 'login' ? 'register' : 'login')}>
          <Text style={[st.link, { textAlign: 'center', marginTop: 8 }]}>
            {mode === 'login' ? `${L.noAccount} ${L.register}` : `${L.haveAccount} ${L.login}`}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            setLocale(getLocale() === 'ar' ? 'en' : 'ar');
            force((n) => n + 1);
          }}
        >
          <Text style={[st.link, { textAlign: 'center' }]}>{L.language}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
