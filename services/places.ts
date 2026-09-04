import type { Coordinates, SearchResult } from "../components/home/types";

export async function searchDestinations(query: string): Promise<SearchResult[]> {
  const response = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=6`);
  const data = await response.json();

  return data.features ?? [];
}

// Build a human-readable single-line label from a Photon feature's properties.
export function formatSearchResult(item: SearchResult): { title: string; subtitle: string } {
  const p = item.properties ?? {};
  const title = p.name || "Selected location";
  const subtitle = [p.city || p.state, p.country].filter(Boolean).join(", ");
  return { title, subtitle };
}

// Reverse geocode a coordinate pair into a display address. Returns null when
// the service is unreachable or returns nothing, so callers must handle the
// failure gracefully (the selected coordinates remain valid).
export async function reverseGeocode(coords: Coordinates): Promise<string | null> {
  try {
    const response = await fetch(
      `https://photon.komoot.io/reverse?lat=${coords.latitude}&lon=${coords.longitude}&limit=1`
    );
    if (!response.ok) return null;
    const data = await response.json();
    const feature = data.features?.[0];
    if (!feature) return null;
    const p = feature.properties ?? {};
    const parts = [p.name, p.street, p.city || p.state, p.country].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : null;
  } catch {
    return null;
  }
}
