import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";

import type { Coordinates } from "../components/home/types";
import type { RouteData, Maneuver } from "./navigationState";

type Props = {
  route: RouteData | null;
  driverLocation: Coordinates | null;
  currentManeuver: Maneuver | null;
  isRerouting?: boolean;
};

function interpolatePoint(start: Coordinates, end: Coordinates, progress: number): Coordinates {
  return {
    latitude: start.latitude + (end.latitude - start.latitude) * progress,
    longitude: start.longitude + (end.longitude - start.longitude) * progress,
  };
}

function getPointAlongPath(path: Coordinates[], progress: number): Coordinates | null {
  if (path.length === 0) return null;
  if (path.length === 1) return path[0];

  const clampedProgress = Math.max(0, Math.min(1, progress));
  const pathProgress = clampedProgress * (path.length - 1);
  const startIndex = Math.min(path.length - 2, Math.floor(pathProgress));
  const localProgress = pathProgress - startIndex;

  return interpolatePoint(path[startIndex], path[startIndex + 1], localProgress);
}

function getRouteHeading(path: Coordinates[], progress: number): number {
  if (path.length < 2) return 0;

  const clampedProgress = Math.max(0, Math.min(1, progress));
  const pathProgress = clampedProgress * (path.length - 1);
  const startIndex = Math.min(path.length - 2, Math.floor(pathProgress));
  const current = path[startIndex];
  const next = path[startIndex + 1];

  return (Math.atan2(next.longitude - current.longitude, next.latitude - current.latitude) * 180) / Math.PI;
}

export function DriverNavigationMap({
  route,
  driverLocation,
  currentManeuver,
  isRerouting = false,
}: Props) {
  const mapRef = useRef<MapView | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [driverProgress, setDriverProgress] = useState(0);
  const [followDriver, setFollowDriver] = useState(true);

  const routePath = useMemo(() => route?.path || [], [route?.path]);

  useEffect(() => {
    if (!mapRef.current || !mapReady || !routePath.length) return;

    const pointsToFit = [...routePath];
    if (driverLocation) pointsToFit.push(driverLocation);

    mapRef.current.fitToCoordinates(pointsToFit, {
      edgePadding: { top: 100, right: 50, bottom: 250, left: 50 },
      animated: true,
    });
  }, [mapReady, routePath, driverLocation]);

  useEffect(() => {
    if (!driverLocation || !routePath.length) return;

    let closestDistance = Infinity;
    let closestProgress = 0;

    for (let i = 0; i < routePath.length - 1; i++) {
      const segmentStart = routePath[i];
      const segmentEnd = routePath[i + 1];

      const pointOnSegment = closestPointOnSegment(
        driverLocation,
        segmentStart,
        segmentEnd
      );

      const distance = calculateDistance(driverLocation, pointOnSegment);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestProgress = i / (routePath.length - 1);
      }
    }

    setDriverProgress(closestProgress);
  }, [driverLocation, routePath]);

  useEffect(() => {
    if (followDriver && driverLocation && mapReady) {
      mapRef.current?.animateToRegion(
        {
          latitude: driverLocation.latitude,
          longitude: driverLocation.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        },
        500
      );
    }
  }, [driverLocation, mapReady, followDriver]);

  useEffect(() => {
    if (currentManeuver && mapRef.current && mapReady) {
      mapRef.current.animateToRegion(
        {
          latitude: currentManeuver.coordinate.latitude,
          longitude: currentManeuver.coordinate.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        500
      );
      setFollowDriver(false);

      const timer = setTimeout(() => setFollowDriver(true), 5000);
      return () => clearTimeout(timer);
    }
  }, [currentManeuver?.coordinate, mapReady]);

  const driverPoint = driverLocation || (routePath.length ? getPointAlongPath(routePath, driverProgress) : null);
  const driverHeading = routePath.length ? getRouteHeading(routePath, driverProgress) : 0;

  const traveledPath = routePath.length > 1
    ? routePath.filter((_, index) => index / Math.max(routePath.length - 1, 1) <= driverProgress)
    : [];

  const initialRegion = routePath.length > 0
    ? {
        latitude: routePath[Math.floor(routePath.length / 2)].latitude,
        longitude: routePath[Math.floor(routePath.length / 2)].longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }
    : driverLocation
    ? {
        latitude: driverLocation.latitude,
        longitude: driverLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }
    : {
        latitude: 12.9716,
        longitude: 77.5946,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      };

  return (
    <>
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        initialRegion={initialRegion}
        onMapReady={() => setMapReady(true)}
        showsUserLocation={false}
        showsMyLocationButton={false}
        scrollEnabled
        zoomEnabled
        rotateEnabled
        pitchEnabled
        showsCompass>
        {routePath.length > 1 && (
          <Polyline coordinates={routePath} strokeColor="#94a3b8" strokeWidth={4} lineDashPattern={[1]} />
        )}
        {traveledPath.length > 1 && (
          <Polyline coordinates={traveledPath} strokeColor="#f59e0b" strokeWidth={5} />
        )}
        {routePath.length > 1 && (
          <>
            <Marker
              coordinate={routePath[0]}
              title="Start"
              pinColor="#22c55e" />
            <Marker
              coordinate={routePath[routePath.length - 1]}
              title="Destination"
              pinColor="#ef4444" />
          </>
        )}
        {currentManeuver && (
          <Marker
            coordinate={currentManeuver.coordinate}
            title={currentManeuver.instruction}
            anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.maneuverMarker}>
              <MaterialCommunityIcons name="navigation" size={24} color="#fff" />
            </View>
          </Marker>
        )}
        {driverPoint && (
          <Marker
            coordinate={driverPoint}
            anchor={{ x: 0.5, y: 0.5 }}
            rotation={driverHeading}
            flat
            tracksViewChanges>
            <View style={styles.driverMarker}>
              <View style={styles.driverPulse} />
              <View style={styles.driverMarkerCore}>
                <MaterialCommunityIcons name="car" size={20} color="#fff" />
              </View>
            </View>
          </Marker>
        )}
      </MapView>
      {isRerouting && (
        <View style={styles.rerouteOverlay}>
          <Text style={styles.rerouteText}>Rerouting...</Text>
        </View>
      )}
    </>
  );
}

function closestPointOnSegment(point: Coordinates, lineStart: Coordinates, lineEnd: Coordinates): Coordinates {
  const dx = lineEnd.longitude - lineStart.longitude;
  const dy = lineEnd.latitude - lineStart.latitude;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) return lineStart;

  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.longitude - lineStart.longitude) * dx + (point.latitude - lineStart.latitude) * dy) / lengthSquared
    )
  );

  return {
    latitude: lineStart.latitude + t * dy,
    longitude: lineStart.longitude + t * dx,
  };
}

function calculateDistance(from: Coordinates, to: Coordinates): number {
  const R = 6371e3;
  const φ1 = (from.latitude * Math.PI) / 180;
  const φ2 = (to.latitude * Math.PI) / 180;
  const Δφ = ((to.latitude - from.latitude) * Math.PI) / 180;
  const Δλ = ((to.longitude - from.longitude) * Math.PI) / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

const styles = {
  driverMarker: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  } as const,
  driverPulse: {
    position: "absolute" as const,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(245, 158, 11, 0.3)",
  } as const,
  driverMarkerCore: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f59e0b",
    alignItems: "center" as const,
    justifyContent: "center" as const,
    borderWidth: 2,
    borderColor: "#fff",
  } as const,
  maneuverMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#3b82f6",
    alignItems: "center" as const,
    justifyContent: "center" as const,
    borderWidth: 2,
    borderColor: "#fff",
  } as const,
  rerouteOverlay: {
    position: "absolute" as const,
    top: 60,
    alignSelf: "center",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  } as const,
  rerouteText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  } as const,
};