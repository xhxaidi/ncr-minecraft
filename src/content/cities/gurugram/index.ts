// gurugram city definition: cyber city district and the fine-grained cyber hub preset
import type { CityDefinition } from "../../types/catalog";
import { cyberHub } from "./landmarks/cyberHub";

export const gurugram: CityDefinition = {
  id: "gurugram",
  name: "Gurugram",
  region: "Haryana",
  description: "High-rise business districts and the future home of local campus landmarks.",
  presets: [
    {
      id: "cyber-hub",
      cityId: "gurugram",
      name: "DLF Cyber Hub",
      shortName: "Cyber Hub",
      description: "Fine-grained Cyber Hub plaza with real DLF towers, the Rapid Metro and 40+ mapped restaurants.",
      origin: cyberHub.anchor,
      dataUrl: "/data/cities/gurugram/presets/cyber-hub.overpass.json",
      radiusChunks: 16,
      blockMetres: 1.5,
      spawn: { x: 4, y: 12, z: 4, yaw: Math.PI / 2 },
      landmarks: [cyberHub],
      // real-world heights and facades for towers osm leaves untagged
      buildingDetails: {
        121362984: { heightMetres: 60, material: "glass" }, // dlf gateway tower
        225718573: { levels: 17, material: "glass" }, // building 14
        40102985: { levels: 8, material: "glass" }, // royal bank of scotland
        40102986: { levels: 7, material: "glass" }, // building 7a
        40102988: { levels: 12, material: "glass" }, // building 9b
        40102989: { levels: 12, material: "glass" }, // building 9a
        127237413: { levels: 12, material: "glass" }, // epitome
        127237436: { levels: 10, material: "glass" }, // building 8c
        127237443: { levels: 10, material: "glass" }, // building 8b
        127237457: { levels: 10, material: "glass" }, // building 8a
        142907958: { levels: 12, material: "glass" }, // infinity tower
        143008988: { levels: 10, material: "glass" }, // cyber greens
        143008989: { levels: 10, material: "glass" },
        143008990: { levels: 10, material: "glass" },
        143008991: { levels: 10, material: "glass" },
        151988108: { levels: 8, material: "glass" }, // dlf atria
        152020346: { levels: 8, material: "glass" }, // asf towers
        350506244: { levels: 8, material: "concrete" }, // udyog minar
        487391634: { levels: 3, material: "metal" }, // cyber city rapid metro station
      },
    },
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
