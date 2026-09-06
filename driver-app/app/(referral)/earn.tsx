import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Share, TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ReferralQR } from '../../components/referral/ReferralQR';
import { referralAPI, ReferralStats } from '../../services/referralAPI';

export default function ReferEarnScreen() {
  const insets = useSafeAreaInsets();
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const s = await referralAPI.getStats();
      setStats(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onShare = async () => {
    if (!stats) return;
    const message = `Ride with Velos.\n\nDownload Velos and book your next ride:\n${stats.referralUrl}`;
    try { await Share.share({ message }); } catch {}
  };

  if (loading && !stats) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#111" /></View>;
  }
  if (error && !stats) {
    return <View style={styles.center}><Text style={styles.error}>{error}</Text><Text style={styles.retry} onPress={load}>Tap to retry</Text></View>;
  }

  const code = stats?.referralCode ?? '---';
  const url = stats?.referralUrl ?? `https://velos.app/r/${code}`;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
      <TouchableOpacity onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={22} color="#111" /></TouchableOpacity>
      <Text style={styles.header}>REFER & EARN</Text>
      <Text style={styles.sub}>Bring riders to Velos. Earn when they ride.</Text>

      <View style={styles.qrWrap}>
        <ReferralQR value={url} size={260} />
        <Text style={styles.code}>{code}</Text>
        <Text style={styles.url}>{url}</Text>
      </View>

      <TouchableOpacity style={styles.shareBtn} onPress={onShare} activeOpacity={0.85}>
        <Ionicons name="share-social-outline" size={18} color="#FFF" />
        <Text style={styles.shareText}>Share Invite Link</Text>
      </TouchableOpacity>

      <View style={styles.divider} />
      <View style={styles.statsBox}>
        <Text style={styles.statsTitle}>Your Referrals</Text>
        <View style={styles.statsRow}>
          <Stat label="Referred" value={String(stats?.referred ?? 0)} />
          <Stat label="First ride" value={String(stats?.completedFirstRide ?? stats?.rewarded ?? 0)} />
          <Stat label="Earned" value={`₹${stats?.earned ?? 0}`} />
        </View>
        {stats?.pending ? <Text style={styles.pending}>{stats.pending} pending</Text> : null}
      </View>

      <View style={styles.divider} />
      <View style={styles.how}>
        <Text style={styles.howTitle}>How it works</Text>
        <Text style={styles.howText}>1. Show your QR to a customer</Text>
        <Text style={styles.howText}>2. They join Velos</Text>
        <Text style={styles.howText}>3. They complete their first ride</Text>
        <Text style={styles.howText}>4. You earn ₹{stats?.rewardAmount ?? 100}</Text>
      </View>
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFF' },
  content: { paddingHorizontal: 20, paddingBottom: 40, alignItems: 'center' },
  back: { alignSelf: 'flex-start', padding: 8, marginBottom: 8 },
  header: { fontSize: 22, fontFamily: 'NeueMontreal-Bold', color: '#111', letterSpacing: 1 },
  sub: { fontSize: 14, color: '#6B7280', fontFamily: 'NeueMontreal-Regular', marginTop: 6, textAlign: 'center' },
  qrWrap: { marginTop: 20, alignItems: 'center', gap: 10 },
  code: { fontSize: 18, fontFamily: 'NeueMontreal-Bold', color: '#111', letterSpacing: 2, marginTop: 8 },
  url: { fontSize: 12, color: '#6B7280', fontFamily: 'NeueMontreal-Regular' },
  shareBtn: { marginTop: 16, backgroundColor: '#111', borderRadius: 14, paddingHorizontal: 20, height: 48, flexDirection: 'row', alignItems: 'center', gap: 8 },
  shareText: { color: '#FFF', fontFamily: 'NeueMontreal-Bold', fontSize: 14 },
  divider: { height: 1, backgroundColor: '#E5E7EB', width: '100%', marginVertical: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF', padding: 20 },
  error: { color: '#6B7280', textAlign: 'center' },
  retry: { color: '#111', marginTop: 8 },
  statsBox: { width: '100%', backgroundColor: '#F9FAFB', borderRadius: 16, padding: 16 },
  statsTitle: { fontFamily: 'NeueMontreal-Bold', fontSize: 14, color: '#111' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  stat: { alignItems: 'center' },
  statValue: { fontFamily: 'NeueMontreal-Bold', fontSize: 18, color: '#111' },
  statLabel: { fontFamily: 'NeueMontreal-Regular', fontSize: 12, color: '#6B7280', marginTop: 2 },
  pending: { fontFamily: 'NeueMontreal-Regular', fontSize: 12, color: '#9CA3AF', marginTop: 8 },
  how: { width: '100%' },
  howTitle: { fontFamily: 'NeueMontreal-Bold', fontSize: 14, color: '#111', marginBottom: 8 },
  howText: { fontFamily: 'NeueMontreal-Regular', fontSize: 14, color: '#374151', marginTop: 4 },
});
