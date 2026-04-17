import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import { Text, View } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";

import { buildMapEdgePadding } from "../../utils/map-region";
import { buildMockRoutePath } from "../../utils/mock-route";
import type { Coordinates } from "../home/types";
import { rideStyles as styles } from "./ride-styles";

type Props = {
  pickup: Coordinates;
  dropoff?: Coordinates | null;
  region: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
  routePath?: Coordinates[];
  showDriverMotion?: boolean;
};

function interpolatePoint(start: Coordinates, end: Coordinates, progress: number): Coordinates {
  return {
    latitude: start.latitude + (end.latitude - start.latitude) * progress,
    longitude: start.longitude + (end.longitude - start.longitude) * progress,
  };
}

function getPointAlongRoute(routePath: Coordinates[], progress: number) {
  if (routePath.length === 0) {
    return null;
  }

  if (routePath.length === 1) {
    return routePath[0];
  }

  const clampedProgress = Math.max(0, Math.min(1, progress));
  const routeProgress = clampedProgress * (routePath.length - 1);
  const startIndex = Math.min(routePath.length - 2, Math.floor(routeProgress));
  const localProgress = routeProgress - startIndex;

  return interpolatePoint(routePath[startIndex], routePath[startIndex + 1], localProgress);
}

function getRouteHeading(routePath: Coordinates[], progress: number) {
  if (routePath.length < 2) {
    return 0;
  }

  const clampedProgress = Math.max(0, Math.min(1, progress));
  const routeProgress = clampedProgress * (routePath.length - 1);
  const startIndex = Math.min(routePath.length - 2, Math.floor(routeProgress));
  const current = routePath[startIndex];
  const next = routePath[startIndex + 1];

  return (Math.atan2(next.longitude - current.longitude, next.latitude - current.latitude) * 180) / Math.PI;
}

export function RideMap({
  pickup,
  dropoff,
  region,
  routePath: providedRoutePath,
  showDriverMotion = false,
}: Props) {
  const mapRef = useRef<MapView | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [driverProgress, setDriverProgress] = useState(showDriverMotion ? 0 : 1);

  const routePath = useMemo(() => {
    if (providedRoutePath?.length) {
      return providedRoutePath;
    }

    return buildMockRoutePath(pickup, dropoff);
  }, [dropoff, pickup, providedRoutePath]);

  useEffect(() => {
    if (!mapRef.current || !mapReady) {
      return;
    }

    const runFit = () => {
      if (!mapRef.current) {
        return;
      }

      if (dropoff || (showDriverMotion && driverPoint)) {
        const pointsToFit = [...routePath];
        if (driverPoint) pointsToFit.push(driverPoint);
        
        mapRef.current.fitToCoordinates(pointsToFit, {
          edgePadding: buildMapEdgePadding(340),
          animated: true,
        });
        return;
      }

      mapRef.current.animateToRegion(region, 500);
    };

  }, [dropoff, mapReady, region, routePath]);

  useEffect(() => {
    if (!showDriverMotion || routePath.length < 2) {
      setDriverProgress(1);
      return;
    }

    setDriverProgress(0.08);

    const durationMs = 13000;
    const frameMs = 80;
    const totalSteps = durationMs / frameMs;
    const stepSize = 0.84 / totalSteps;

    const timer = setInterval(() => {
      setDriverProgress((current) => {
        const next = Math.min(0.92, current + stepSize);

        if (next >= 0.92) {
          clearInterval(timer);
        }

        return next;
      });
    }, frameMs);

    return () => clearInterval(timer);
  }, [routePath, showDriverMotion]);

  const driverPoint = showDriverMotion ? getPointAlongRoute(routePath, driverProgress) : null;
  const driverHeading = showDriverMotion ? getRouteHeading(routePath, driverProgress) : 0;
  const traveledPath =
    showDriverMotion && driverPoint
      ? routePath.filter((_, index) => index / Math.max(routePath.length - 1, 1) <= driverProgress)
      : [];

  return (
    <>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={region}
        onMapReady={() => setMapReady(true)}
        scrollEnabled
        zoomEnabled
        rotateEnabled
        pitchEnabled>
        <Marker coordinate={pickup} title="Pickup" pinColor="#111827" />
        {dropoff ? <Polyline coordinates={routePath} strokeColor="#f7c948" strokeWidth={5} /> : null}
        {traveledPath.length > 1 ? <Polyline coordinates={traveledPath} strokeColor="#111827" strokeWidth={6} /> : null}
        {dropoff ? <Marker coordinate={dropoff} title="Drop-off" pinColor="#ef4444" /> : null}
        {driverPoint ? (
          <Marker
            coordinate={driverPoint}
            anchor={{ x: 0.5, y: 0.5 }}
            rotation={driverHeading}
            flat
            tracksViewChanges={showDriverMotion}>
            <View style={styles.driverMarker}>
              <View style={styles.driverPulse} />
              <View style={styles.driverMarkerCore}>
                <MaterialCommunityIcons name="car" size={18} color="#f8f4ee" />
              </View>
              <View style={styles.driverBubble}>
                <Text style={styles.driverBubbleText}>Driver</Text>
              </View>
            </View>
          </Marker>
        ) : null}
      </MapView>
      <View pointerEvents="none" style={styles.mapShade} />
    </>
  );
}
