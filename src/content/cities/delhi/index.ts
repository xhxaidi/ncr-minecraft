import type { CityDefinition } from "../../types/catalog";
import { jamaMasjid } from "./landmarks/jamaMasjid";

// Focus override (Phase 2.7): the registry ships with exactly one landmark —
// Jama Masjid. Other presets are instant-load OSM extras with no landmark
// work. The India Gate source-model pipeline stays in the repo unregistered.
export const delhi: CityDefinition = {
  id: "delhi",
  name: "Delhi",
  region: "National Capital Territory",
  description: "Dense historic lanes around the great Friday mosque.",
  presets: [
    {
      id: "jama-masjid",
      cityId: "delhi",
      name: "Old Delhi & Jama Masjid",
      shortName: "Old Delhi",
      description: "The bazaar approach and hand-built Jama Masjid — the hero demo.",
      origin: jamaMasjid.anchor,
      dataUrl: "/data/cities/delhi/presets/jama-masjid.overpass.json",
      radiusChunks: 12,
      spawn: { x: 46, y: 12, z: 2, yaw: Math.PI / 2 },
      landmarks: [jamaMasjid],
    },
    {
      id: "india-gate",
      cityId: "delhi",
      name: "India Gate & Kartavya Path",
      shortName: "India Gate",
      description: "OSM roads, lawns and buildings around the ceremonial axis.",
      origin: { lat: 28.6129, lon: 77.2295 },
      dataUrl: "/data/cities/delhi/presets/india-gate.overpass.json",
      radiusChunks: 12,
      spawn: { x: 0, y: 12, z: 42, yaw: Math.PI },
      landmarks: [],
    },
    {
      id: "connaught-place",
      cityId: "delhi",
      name: "Connaught Place",
      shortName: "Connaught Place",
      description: "The radial road system and colonnaded urban blocks of central Delhi.",
      origin: { lat: 28.6315, lon: 77.2167 },
      dataUrl: "/data/cities/delhi/presets/connaught-place.overpass.json",
      radiusChunks: 12,
      spawn: { x: 0, y: 12, z: 20, yaw: Math.PI },
      landmarks: [],
    },
  ],
};
