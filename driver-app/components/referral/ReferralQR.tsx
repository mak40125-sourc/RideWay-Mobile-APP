import * as React from 'react';
import { View, StyleSheet } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

type Props = { value: string; size?: number };

export function ReferralQR({ value, size = 240 }: Props) {
  return (
    <View style={[styles.container, { width: size, height: size }]} >
      <QRCode value={value} size={size - 16} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
});
