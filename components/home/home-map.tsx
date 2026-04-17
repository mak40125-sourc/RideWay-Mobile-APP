import { useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";

import { buildMapEdgePadding } from "../../utils/map-region";
import { buildMockRoutePath } from "../../utils/mock-route";
import { homeStyles as styles } from "./home-styles";
import type { Coordinates } from "./types";

type Props = {
  location: Coordinates;
  destinationCoords: Coordinates | null;
  region: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
  routePath?: Coordinates[];
};

export function HomeMap({ location, destinationCoords, region, routePath: providedRoutePath }: Props) {
  const mapRef = useRef<MapView | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const routePath = useMemo(() => {
    if (providedRoutePath?.length) {
      return providedRoutePath;
    }

    return buildMockRoutePath(location, destinationCoords);
  }, [destinationCoords, location, providedRoutePath]);

  useEffect(() => {
    if (!mapRef.current || !mapReady) {
      return;
    }

    const runFit = () => {
      if (!mapRef.current) {
        return;
      }

      if (destinationCoords) {
        mapRef.current.fitToCoordinates(routePath, {
          edgePadding: buildMapEdgePadding(320),
          animated: true,
        });
        return;
      }

      mapRef.current.animateToRegion(region, 500);
    };

    const timeout = setTimeout(runFit, 160);

    return () => clearTimeout(timeout);
  }, [destinationCoords, mapReady, region, routePath]);

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
        <Marker coordinate={location} title="Pickup" pinColor="#111827" />
        {destinationCoords ? <Polyline coordinates={routePath} strokeColor="#f7c948" strokeWidth={5} /> : null}
        {destinationCoords ? <Marker coordinate={destinationCoords} title="Drop-off" pinColor="#ef4444" /> : null}
      </MapView>
      <View pointerEvents="none" style={styles.mapShade} />
    </>
  );
}
