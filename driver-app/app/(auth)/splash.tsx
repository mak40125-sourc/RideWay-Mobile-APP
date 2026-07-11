import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';

export default function SplashScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.logo}>RideWay</Text>
      <Text style={styles.tagline}>Driver App</Text>
      <ActivityIndicator size="large" color="#FFFFFF" style={styles.loader} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111111',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    fontSize: 48,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -1,
    fontFamily: 'NeueMontreal-Bold',
  },
  tagline: {
    fontSize: 18,
    color: '#9CA3AF',
    marginTop: 8,
    fontFamily: 'NeueMontreal-Regular',
  },
  loader: {
    marginTop: 32,
  },
});
