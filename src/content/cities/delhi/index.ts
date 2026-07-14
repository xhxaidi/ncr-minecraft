import { BlockId } from "../../../engine/world/blocks";
import type { BuildingStyleHook, CityDefinition } from "../../types/catalog";
import { centralPark } from "./landmarks/centralPark";
import { indiaGate } from "./landmarks/indiaGate";
import { qutubMinar } from "./landmarks/qutubMinar";

// the georgian blocks of the inner, middle and outer circles are white
// colonnaded facades; restyle osm footprints near the centre accordingly
const connaughtPlaceStyle: BuildingStyleHook = (tags, centreMetres, suggestion) => {
  const distance = Math.hypot(centreMetres.x, centreMetres.z);
  const colour = (tags["building:colour"] ?? "").toLowerCase();
  const white = colour === "" || colour.includes("white") || colour.includes("cream");
  if (distance > 420 || !white) return suggestion;
  return {
    block: BlockId.PLASTER,
    heightMetres: tags.height || tags["building:levels"] ? suggestion.heightMetres : 13,
    arcade: true,
  };
};

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
      description: "Fine-grained CP: white colonnaded circles, Central Park, the giant flag, metro gates, real footpaths and trees.",
      origin: { lat: 28.6328, lon: 77.2197 },
      dataUrl: "/data/cities/delhi/presets/connaught-place.overpass.json",
      radiusChunks: 18,
      blockMetres: 2,
      spawn: { x: -2, y: 12, z: 64, yaw: 0 },
      landmarks: [centralPark],
      buildingStyle: connaughtPlaceStyle,
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
