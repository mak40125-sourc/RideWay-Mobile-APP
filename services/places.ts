import type { SearchResult } from "../components/home/types";

export async function searchDestinations(query: string): Promise<SearchResult[]> {
  const response = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=6`);
  const data = await response.json();

  return data.features ?? [];
}
