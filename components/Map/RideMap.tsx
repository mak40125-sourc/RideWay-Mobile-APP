import { useEffect, useMemo, useRef, useState } from "react";
import MapView, { Marker, Polyline } from "react-native-maps";
import type { Coordinates } from "../home/types";
import { buildMapEdgePadding, buildMapRegion } from "../../utils/map-region";

type Props = {
  location: Coordinates;
  destinationCoords: Coordinates | null;
  routePath?: Coordinates[];
};

export function RideMap({ location, destinationCoords, routePath: providedRoutePath }: Props) {
  const mapRef = useRef<MapView>(null);
  const [mapReady, setMapReady] = useState(false);

  const region = useMemo(() => buildMapRegion(location, destinationCoords), [destinationCoords, location]);

  const routePath = useMemo(() => {
    if (providedRoutePath?.length) return providedRoutePath;
    return destinationCoords ? [location, destinationCoords] : [location];
  }, [destinationCoords, location, providedRoutePath]);

  useEffect(() => {
    if (!mapRef.current || !mapReady) return;
    const timeout = setTimeout(() => {
      if (destinationCoords) {
        mapRef.current?.fitToCoordinates(routePath, {
          edgePadding: buildMapEdgePadding(320),
          animated: true,
        });
      } else {
        mapRef.current?.animateToRegion(region, 500);
      }
    }, 160);
    return () => clearTimeout(timeout);
  }, [destinationCoords, mapReady, region, routePath]);

  return (
    <MapView
      ref={mapRef}
      style={{ flex: 1 }}
      initialRegion={region}
      onMapReady={() => setMapReady(true)}
      scrollEnabled
      zoomEnabled
      rotateEnabled
      pitchEnabled
    >
      <Marker coordinate={location} title="Pickup" pinColor="#111827" />
      {destinationCoords && (
        <Polyline coordinates={routePath} strokeColor="#111111" strokeWidth={3} />
      )}
      {destinationCoords && (
        <Marker coordinate={destinationCoords} title="Drop-off" pinColor="#111111" />
      )}
    </MapView>
  );
}
