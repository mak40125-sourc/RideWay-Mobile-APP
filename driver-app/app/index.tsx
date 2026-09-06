import { Redirect } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';

export default function Index() {
  const { authState } = useAuth();
  if (authState === 'BOOTSTRAPPING') return null;
  if (authState === 'AUTHENTICATED') return <Redirect href="/(driver)/home" />;
  return <Redirect href="/(auth)/onboarding" />;
}
