import type { CityDefinition } from "../../types/catalog";
import { indiaGate } from "./landmarks/indiaGate";
import { qutubMinar } from "./landmarks/qutubMinar";

export const delhi: CityDefinition = {
  id: "delhi",
  name: "Delhi",
  region: "National Capital Territory",
  description: "Ceremonial avenues, dense historic lanes and hand-built monuments.",
  presets: [
    {
      id: "india-gate",
      cityId: "delhi",
      name: "India Gate & Kartavya Path",
      shortName: "India Gate",
      description: "OSM roads, lawns and buildings with a mineable India Gate at the centre.",
      origin: indiaGate.anchor,
      dataUrl: "/data/cities/delhi/presets/india-gate.overpass.json",
      radiusChunks: 12,
      spawn: { x: 0, y: 12, z: 42, yaw: Math.PI },
      landmarks: [indiaGate],
    },
    {
      id: "jama-masjid",
      cityId: "delhi",
      name: "Old Delhi & Jama Masjid",
      shortName: "Old Delhi",
      description: "Dense lanes and real building footprints around Jama Masjid.",
      origin: { lat: 28.6507, lon: 77.2334 },
      dataUrl: "/data/cities/delhi/presets/jama-masjid.overpass.json",
      radiusChunks: 12,
      spawn: { x: 8, y: 12, z: 35, yaw: Math.PI },
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
    {
      id: "qutub-minar-lab",
      cityId: "delhi",
      name: "Qutub Minar Landmark Lab",
      shortName: "Qutub Minar",
      description: "A handcrafted landmark zone demonstrating how new monuments plug in.",
      origin: qutubMinar.anchor,
      radiusChunks: 8,
      spawn: { x: 0, y: 12, z: 35, yaw: Math.PI },
      landmarks: [qutubMinar],
    },
  ],
};
