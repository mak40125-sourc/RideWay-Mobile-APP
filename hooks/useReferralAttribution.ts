import { useEffect } from 'react';
import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/auth-context';
import { api } from '../services/api';

const PENDING_KEY = 'velos_pending_referral_code';

function extractCode(url: string | null): string | null {
  if (!url) return null;
  // Match /r/VEL-XXXXX in https://velos.app/r/VEL-XXXXX or ridewayrider://r/VEL-XXXXX or velos://r/VEL...
  const m = url.match(/\/r\/(VEL-[A-Z0-9]{5})/i);
  return m ? m[1].toUpperCase() : null;
}

export function useReferralAttribution() {
  const { isAuthenticated, user } = useAuth();

  useEffect(() => {
    const handleUrl = async (url: string | null) => {
      const code = extractCode(url);
      if (code) {
        await AsyncStorage.setItem(PENDING_KEY, code);
      }
    };
    Linking.getInitialURL().then(handleUrl);
    const sub = Linking.addEventListener('url', (e) => handleUrl(e.url));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !user) return;
    (async () => {
      const code = await AsyncStorage.getItem(PENDING_KEY);
      if (!code) return;
      try {
        await api.post('/referrals/apply', { referralCode: code });
        await AsyncStorage.removeItem(PENDING_KEY);
      } catch (e) {
        const status = (e as any)?.status;
        // 409 already has referral, 404 invalid — clear to avoid retry loop
        if (status === 409 || status === 404 || status === 400) {
          await AsyncStorage.removeItem(PENDING_KEY);
        }
      }
    })();
  }, [isAuthenticated, user]);
}
