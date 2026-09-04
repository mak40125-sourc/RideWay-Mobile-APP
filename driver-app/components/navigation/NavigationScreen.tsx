import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import NavigationMap from './NavigationMap';
import ManeuverCard from './ManeuverCard';
import TripPanel from './TripPanel';
import { useNavigationEngine } from '../../hooks/useNavigationEngine';
import { diagLogger } from '../../utils/diagLog';
import type { Coordinate } from '../../types/navigation';

let navScreenMountCount = 0;

interface NavigationScreenProps {
  destination: Coordinate | null;
  destinationKey: string;
  destinationLabel: string;
  actionLabel: string;
  actionLoading?: boolean;
  onAction: () => void;
  onCancel?: () => void;
  cancelLabel?: string;
  cancelDisabled?: boolean;
  statusText?: string;
}

export default function NavigationScreen({
  destination,
  destinationKey,
  destinationLabel,
  actionLabel,
  actionLoading,
  onAction,
  onCancel,
  cancelLabel,
  cancelDisabled,
  statusText,
}: NavigationScreenProps) {
  const isFocused = useIsFocused();
  const mountIdRef = useRef<number>(0);

  useEffect(() => {
    navScreenMountCount += 1;
    mountIdRef.current = navScreenMountCount;
    diagLogger.log('NAV_SCREEN_MOUNT', `count=${mountIdRef.current} key=${destinationKey} focused=${isFocused}`);
    // eslint-disable-next-line no-console
    console.log('[RIDEWAY-DIAG] NAV_SCREEN_MOUNT', JSON.stringify({ count: mountIdRef.current, key: destinationKey }));
    return () => {
      diagLogger.log('NAV_SCREEN_UNMOUNT', `count=${mountIdRef.current} key=${destinationKey}`);
      // eslint-disable-next-line no-console
      console.log('[RIDEWAY-DIAG] NAV_SCREEN_UNMOUNT', JSON.stringify({ count: mountIdRef.current, key: destinationKey }));
    };
    // mount only — destinationKey in dep would spam, we want remount counter
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useNavigationEngine(destination, destinationKey, destinationLabel, isFocused && !!destination);

  return (
    <View style={styles.container}>
      <NavigationMap />
      <ManeuverCard />
      <TripPanel
        destinationLabel={destinationLabel}
        actionLabel={actionLabel}
        actionLoading={actionLoading}
        onAction={onAction}
        onCancel={onCancel}
        cancelLabel={cancelLabel}
        cancelDisabled={cancelDisabled}
        statusText={statusText}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
});
