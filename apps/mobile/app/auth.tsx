import { useEffect } from 'react';
import { Text } from 'react-native';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import type { AuthResponseDto } from '@afdip/shared';
import { setSession } from '@/api';
import { s } from '@/theme';

/** Deep-link target for the OAuth redirect: afdip://auth#session=<base64url> */
export default function OAuthCallback() {
  const router = useRouter();
  const st = s();

  useEffect(() => {
    (async () => {
      const url = await Linking.getInitialURL();
      const match = url && /session=([^&]+)/.exec(url);
      if (match) {
        const json = match[1].replace(/-/g, '+').replace(/_/g, '/');
        const decoded =
          typeof atob === 'function' ? atob(json) : Buffer.from(json, 'base64').toString('utf8');
        await setSession(JSON.parse(decoded) as AuthResponseDto);
        router.replace('/projects');
      } else {
        router.replace('/');
      }
    })();
  }, [router]);

  return <Text style={[st.muted, { textAlign: 'center', marginTop: 60 }]}>…</Text>;
}
