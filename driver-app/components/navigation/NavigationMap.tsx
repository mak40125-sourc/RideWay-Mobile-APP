import { useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useIsFocused } from '@react-navigation/native';
import { useNavigationStore } from '../../store/navigationStore';
import { useDriverStore } from '../../store/driverStore';
import { useVehicleMotion } from '../../hooks/useVehiclePosition';
import { angleDiff, coordDistanceM } from '../../services/geoMotion';
import { diagLogger } from '../../utils/diagLog';
import type { Coordinate } from '../../types/navigation';

let navMapMountCount = 0;

const DESTINATION_COLOR = '#EF4444';
const AHEAD_OFFSET_M = 360; // camera looks this far ahead of the vehicle
const CAMERA_ZOOM = 16;
const CAMERA_PITCH = 50;
const CAMERA_ALTITUDE = 5000;
const CAMERA_DURATION_MS = 1750;
const CAMERA_HEADING_EPSILON = 1.5; // degrees

function pointAhead(position: Coordinate, headingDeg: number, meters: number): Coordinate {
  const rad = (headingDeg * Math.PI) / 180;
  const dLat = (meters * Math.cos(rad)) / 111320;
  const dLng =
    (meters * Math.sin(rad)) / (111320 * Math.cos((position.latitude * Math.PI) / 180));
  return {
    latitude: position.latitude + dLat,
    longitude: position.longitude + dLng,
  };
}

export default function NavigationMap() {
  const mapRef = useRef<MapView>(null);
  const [following, setFollowing] = useState(true);
  const isFocused = useIsFocused();
  const lastCameraRef = useRef<{ lat: number; lng: number; hdg: number; ts: number } | null>(null);
  const lastAnimateAtRef = useRef<number | null>(null);
  const attemptedAnimateRef = useRef(false);

  const destination = useNavigationStore((s) => s.destination);
  const routeGeometry = useNavigationStore((s) => s.route?.geometry);
  const status = useNavigationStore((s) => s.status);
  const active = useNavigationStore((s) => s.active);
  const destinationKey = useNavigationStore((s) => s.destinationKey);
  const isRerouting = useNavigationStore((s) => s.isRerouting);
  const navPosition = useNavigationStore((s) => s.position);
  const route = useNavigationStore((s) => s.route);
  const driverLocation = useDriverStore((s) => s.location);

  // Smoothed vehicle display position + heading.
  const { displayPos, headingDeg, rawPos } = useVehicleMotion();

  const visibleRoute = routeGeometry && routeGeometry.length >= 2 ? routeGeometry : null;

  // DIAG: mount/unmount counter — proves remount during navigation
  useEffect(() => {
    navMapMountCount += 1;
    const id = navMapMountCount;
    diagLogger.log('NAV_MAP_MOUNT', `count=${id} isFocused=${isFocused}`);
    // eslint-disable-next-line no-console
    console.log('[RIDEWAY-DIAG] NAV_MAP_MOUNT', JSON.stringify({ count: id, isFocused }));
    return () => {
      diagLogger.log('NAV_MAP_UNMOUNT', `count=${id}`);
      // eslint-disable-next-line no-console
      console.log('[RIDEWAY-DIAG] NAV_MAP_UNMOUNT', JSON.stringify({ count: id }));
    };
  }, []);

  // DIAG: what NavigationMap is actually rendering - stale vs fresh OSRM
  useEffect(() => {
    const pts = routeGeometry?.length ?? 0;
    const src = pts > 0 ? (useNavigationStore.getState().status === 'active' ? 'FRESH_OSRM' : 'STALE_STORE') : 'NONE';
    diagLogger.log(
      'NAV_MAP_READ',
      `pts=${pts} visible=${!!visibleRoute} status=${status} displayPos=${displayPos ? `${displayPos.latitude.toFixed(5)},${displayPos.longitude.toFixed(5)}` : 'null'} src=${src}`
    );
  }, [routeGeometry, visibleRoute, status, displayPos]);

  const cameraTo = (position: Coordinate, h: number) => ({
    center: pointAhead(position, h, AHEAD_OFFSET_M),
    heading: h,
    pitch: CAMERA_PITCH,
    zoom: CAMERA_ZOOM,
    altitude: CAMERA_ALTITUDE,
  });

  const handleRecenter = () => {
    diagLogger.log('NAV_RECENTER', `displayPos=${displayPos ? `${displayPos.latitude.toFixed(5)},${displayPos.longitude.toFixed(5)}` : 'null'} h=${displayPos ? headingDeg.value.toFixed(1) : '-'}`);
    setFollowing(true);
    if (displayPos) {
      const h = headingDeg.value;
      mapRef.current?.animateCamera(cameraTo(displayPos, h), { duration: 700 });
    }
  };

  // Camera follow: coalesce updates to avoid fighting every GPS tick. The
  // smoothed display position (state) drives re-evaluation; heading is read
  // from the shared value at that point. Animate only when the camera target
  // meaningfully moves or the heading shifts.
  useEffect(() => {
    if (!isFocused) {
      diagLogger.log('NAV_CAMERA_SKIP', `reason=notFocused displayPos=${!!displayPos} following=${following}`);
      attemptedAnimateRef.current = false;
      return;
    }
    if (!following || !displayPos) {
      diagLogger.log('NAV_CAMERA_SKIP', `reason=${!following ? 'notFollowing' : 'noDisplayPos'} displayPos=${displayPos ? `${displayPos.latitude.toFixed(5)},${displayPos.longitude.toFixed(5)}` : 'null'} following=${following}`);
      attemptedAnimateRef.current = false;
      return;
    }
    const h = headingDeg.value;
    const center = pointAhead(displayPos, h, AHEAD_OFFSET_M);
    const prev = lastCameraRef.current;
    if (prev) {
      const moved =
        coordDistanceM({ latitude: prev.lat, longitude: prev.lng }, center) > 2;
      const turned = Math.abs(angleDiff(prev.hdg, h)) > CAMERA_HEADING_EPSILON;
      if (!moved && !turned) {
        attemptedAnimateRef.current = false;
        return;
      }
    }
    lastCameraRef.current = { lat: center.latitude, lng: center.longitude, hdg: h, ts: Date.now() };
    lastAnimateAtRef.current = Date.now();
    attemptedAnimateRef.current = true;
    diagLogger.log('NAV_CAMERA_ANIMATE', `center=${center.latitude.toFixed(5)},${center.longitude.toFixed(5)} h=${h.toFixed(1)}`);
    mapRef.current?.animateCamera(cameraTo(displayPos, h), { duration: CAMERA_DURATION_MS });
  }, [isFocused, following, displayPos, headingDeg.value]);

  // Pause following when the screen loses focus.
  useEffect(() => {
    if (!isFocused) {
      diagLogger.log('NAV_CAMERA_FOCUS_LOST', 'following=false');
      setFollowing(false);
    }
  }, [isFocused]);

  const initialRegion = destination
    ? {
        latitude: destination.latitude,
        longitude: destination.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }
    : undefined;

  const vehicleStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${headingDeg.value}deg` }],
  }));

  // ── SINGLE STRUCTURED SNAPSHOT 1/s while navigation active ──
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      const now = Date.now();
      const gpsAge = driverLocation?.timestamp ? now - driverLocation.timestamp : null;
      const snap = {
        SCREEN: {
          navigationScreenMounted: true,
          screenFocused: isFocused,
          mapViewMounted: true,
          mapViewRefAvailable: !!mapRef.current,
        },
        NAVIGATION: {
          active,
          status,
          destinationKey,
          following,
          isRerouting,
        },
        GPS: {
          driverLocation: driverLocation ? { lat: driverLocation.latitude, lng: driverLocation.longitude } : null,
          timestamp: driverLocation?.timestamp ?? null,
          ageMs: gpsAge,
          heading: (driverLocation as any)?.heading ?? null,
        },
        NAV_POSITION: {
          position: navPosition ? { lat: navPosition.latitude, lng: navPosition.longitude } : null,
          // navigationStore.position has no timestamp — age N/A
          ageMs: null as number | null,
        },
        VEHICLE: {
          rawPos: rawPos ? { lat: rawPos.latitude, lng: rawPos.longitude } : null,
          displayPos: displayPos ? { lat: displayPos.latitude, lng: displayPos.longitude } : null,
          headingDeg: headingDeg.value,
        },
        ROUTE: {
          exists: !!route,
          pointCount: route?.geometry?.length ?? 0,
          first: route?.geometry?.[0] ? { lat: route.geometry[0].latitude, lng: route.geometry[0].longitude } : null,
          last: route?.geometry?.[route.geometry.length - 1] ? { lat: route.geometry[route.geometry.length - 1].latitude, lng: route.geometry[route.geometry.length - 1].longitude } : null,
        },
        CAMERA: {
          enabled: isFocused && following && !!displayPos,
          lastTarget: lastCameraRef.current ? { lat: lastCameraRef.current.lat, lng: lastCameraRef.current.lng, hdg: lastCameraRef.current.hdg, ageMs: now - lastCameraRef.current.ts } : null,
          lastAnimateAt: lastAnimateAtRef.current,
          lastAnimateAgeMs: lastAnimateAtRef.current ? now - lastAnimateAtRef.current : null,
          attemptedAnimate: attemptedAnimateRef.current,
        },
        RENDER: {
          markerShouldRender: !!displayPos,
          polylineShouldRender: !!visibleRoute,
          polylinePoints: visibleRoute?.length ?? 0,
        },
        // classification helper
        CLASS: (() => {
          if (!driverLocation) return 'A_GPS_MISSING';
          if (!navPosition) return 'B_NAV_POS_MISSING';
          if (!displayPos) return 'C_DISPLAYPOS_MISSING';
          // displayPos exists but marker hidden would be D; we render marker when displayPos exists so D = displayPos but POLYLINE_RENDER hidden (handled above)
          // For snapshot, D is covered by C
          if (isFocused && following && displayPos && attemptedAnimateRef.current) {
            // check if map actually moved would be E — needs manual observation, we log attempted
            return displayPos ? 'E_CAMERA_ATTEMPTED' : 'C';
          }
          if (!rawPos && !displayPos) return 'C_DISPLAYPOS_MISSING';
          return 'F_STATE_VALID';
        })(),
      };
      diagLogger.log('NAV_STATE_SNAPSHOT', JSON.stringify(snap));
      // eslint-disable-next-line no-console
      console.log('[RIDEWAY-DIAG] NAV_STATE_SNAPSHOT', JSON.stringify(snap));
    }, 1000);
    return () => clearInterval(id);
  }, [active, isFocused, following, isRerouting, status, destinationKey, driverLocation, navPosition, rawPos, displayPos, route, visibleRoute]);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_GOOGLE}
        initialRegion={initialRegion}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        loadingEnabled
        onPanDrag={() => setFollowing(false)}
      >
        {visibleRoute
          ? (() => {
              // UNIQUE DIAG: identifies which Polyline is actually rendered
              diagLogger.log(
                'POLYLINE_RENDER',
                `source=navigationStore.route.geometry (NavigationMap.tsx:136) points=${visibleRoute.length} width=14 color=#FF00FF first=${visibleRoute[0].latitude.toFixed(5)},${visibleRoute[0].longitude.toFixed(5)} last=${visibleRoute[visibleRoute.length - 1].latitude.toFixed(5)},${visibleRoute[visibleRoute.length - 1].longitude.toFixed(5)}`
              );
              // eslint-disable-next-line no-console
              console.log('[RIDEWAY-DIAG] POLYLINE_RENDER', `NavigationMap visibleRoute points=${visibleRoute.length}`);
              return (
                <Polyline
                  coordinates={visibleRoute}
                  strokeWidth={14}
                  strokeColor="#FF00FF"
                />
              );
            })()
          : (() => {
              diagLogger.log('POLYLINE_RENDER', 'source=NONE (NavigationMap.tsx:136) points=0 — no Polyline rendered');
              return null;
            })()}

        {displayPos ? (
          <Marker coordinate={displayPos}>
            <View style={{ width: 85, height: 85 }}>
              <Image
                source={require('../../assets/images/PolyLine-car.png')}
                style={{ width: 85, height: 85 }}
                resizeMode="contain"
              />
            </View>
          </Marker>
        ) : null}

        {destination ? (
          <Marker coordinate={destination} anchor={{ x: 0.5, y: 0.5 }}>
            <Ionicons name="location-sharp" size={38} color={DESTINATION_COLOR} />
          </Marker>
        ) : null}
      </MapView>

      {status === 'fetching' && !routeGeometry ? (
        <View style={styles.fetchingBadge} pointerEvents="none">
          <Ionicons name="sync-outline" size={14} color="#FFFFFF" />
        </View>
      ) : null}

      {!following ? (
        <TouchableOpacity style={styles.recenterButton} onPress={handleRecenter} activeOpacity={0.8}>
          <Ionicons name="locate-outline" size={22} color="#111111" />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  driverMarker: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  carImage: {
    width: 60,
    height: 60,
    resizeMode: 'contain',
  },
  fetchingBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    borderRadius: 14,
    padding: 8,
  },
  recenterButton: {
    position: 'absolute',
    right: 16,
    bottom: 24,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
});