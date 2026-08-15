import { useEffect, useMemo, useRef, useState } from "react";
import { Text, View } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";

import { buildMapEdgePadding } from "../../utils/map-region";
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
  driverLocation?: Coordinates | null;
  driverLabel?: string;
  edgePaddingBottom?: number;
};

export function RideMap({
  pickup,
  dropoff,
  region,
  routePath: providedRoutePath,
  driverLocation,
  driverLabel,
  edgePaddingBottom = 260,
}: Props) {
  const mapRef = useRef<MapView | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const fittedOnceRef = useRef(false);
  const hadDriverRef = useRef(false);

  const routePath = useMemo(() => {
    if (providedRoutePath?.length) {
      return providedRoutePath;
    }

    return dropoff ? [pickup, dropoff] : [pickup];
  }, [dropoff, pickup, providedRoutePath]);

  const fitPoints = useMemo(() => {
    if (driverLocation) {
      return [driverLocation, ...routePath];
    }
    return routePath;
  }, [driverLocation, routePath]);

  useEffect(() => {
    if (!mapRef.current || !mapReady) {
      return;
    }

    const hasDriver = !!driverLocation;
    const driverAppeared = hasDriver && !hadDriverRef.current;
    hadDriverRef.current = hasDriver;

    if (fittedOnceRef.current && !driverAppeared) {
      return;
    }

    const runFit = () => {
      if (!mapRef.current) {
        return;
      }

      fittedOnceRef.current = true;

      if (dropoff || hasDriver) {
        mapRef.current.fitToCoordinates(fitPoints, {
          edgePadding: buildMapEdgePadding(edgePaddingBottom),
          animated: true,
        });
        return;
      }

      mapRef.current.animateToRegion(region, 500);
    };

    const timeout = setTimeout(runFit, 160);

    return () => clearTimeout(timeout);
  }, [dropoff, driverLocation, edgePaddingBottom, fitPoints, mapReady, region]);

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
        {dropoff ? <Marker coordinate={dropoff} title="Drop-off" pinColor="#ef4444" /> : null}
        {driverLocation ? (
          <>
            <Polyline coordinates={[driverLocation, pickup]} strokeColor="#374151" strokeWidth={3} lineDashPattern={[2, 4]} />
            <Marker coordinate={driverLocation} anchor={{ x: 0.5, y: 0.5 }}>
              <View style={styles.driverMarker}>
                <View style={styles.driverPulse} />
                <View style={styles.driverMarkerCore}>
                  <Text style={styles.driverMarkerGlyph}>{driverLabel?.[0]?.toUpperCase() ?? "V"}</Text>
                </View>
              </View>
            </Marker>
            {driverLabel ? (
              <Marker coordinate={driverLocation} anchor={{ x: 0.5, y: 0 }}>
                <View style={styles.driverBubble}>
                  <Text style={styles.driverBubbleText}>{driverLabel}</Text>
                </View>
              </Marker>
            ) : null}
          </>
        ) : null}
      </MapView>
      <View pointerEvents="none" style={styles.mapShade} />
    </>
  );
}
