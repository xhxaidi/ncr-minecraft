import type { CityDefinition } from "../../types/catalog";

export const gurugram: CityDefinition = {
  id: "gurugram",
  name: "Gurugram",
  region: "Haryana",
  description: "High-rise business districts and the future home of local campus landmarks.",
  presets: [
    {
      id: "cyber-city",
      cityId: "gurugram",
      name: "Gurugram Cyber City",
      shortName: "Cyber City",
      description: "Real roads and building footprints around DLF Cyber City.",
      origin: { lat: 28.495, lon: 77.088 },
      dataUrl: "/data/cities/gurugram/presets/cyber-city.overpass.json",
      radiusChunks: 12,
      spawn: { x: 0, y: 12, z: 20, yaw: Math.PI },
      landmarks: [],
    },
  ],
};
