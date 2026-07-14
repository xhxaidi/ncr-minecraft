import type { CityDefinition, PresetDefinition } from "./types/catalog";
import { delhi } from "./cities/delhi";
import { gurugram } from "./cities/gurugram";

export const CITY_CATALOG: CityDefinition[] = [delhi, gurugram];

export function getPreset(presetId: string): PresetDefinition {
  for (const city of CITY_CATALOG) {
    const preset = city.presets.find((candidate) => candidate.id === presetId);
    if (preset) return preset;
  }
  throw new Error(`Unknown preset: ${presetId}`);
}

export function allPresets(): PresetDefinition[] {
  return CITY_CATALOG.flatMap((city) => city.presets);
}
