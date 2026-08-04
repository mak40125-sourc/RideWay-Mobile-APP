import type { RideOption } from "../home/types";

export const rideOptions: RideOption[] = [
  { label: "Dash", description: "Quick city rides", baseFare: 42, perKm: 12, perMin: 2, vehicleType: "mini" },
  { label: "Comfort", description: "More room, smoother trip", baseFare: 64, perKm: 15, perMin: 3, vehicleType: "sedan" },
  { label: "Mega", description: "Best for groups", baseFare: 88, perKm: 18, perMin: 4, vehicleType: "shuttle" },
  { label: "Bike", description: "Fast pickup for short hops", baseFare: 26, perKm: 8, perMin: 1, vehicleType: "bike" },
];
