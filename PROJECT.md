# DILLI BLOCKS

**A Minecraft-style voxel game where the world is *real Delhi*** — generated from live OpenStreetMap data, with hand-crafted voxel landmarks — so you can walk out of Chandni Chowk's lanes, climb the steps of Jama Masjid, and mine a block out of its minaret.

## What it does

- Full voxel game core: break/place blocks, gravity, jumping, sprinting, flying, AABB collision, hotbar of 9+ block types — all at 60fps.
- Real-city world generation: OpenStreetMap buildings, roads, parks, and water rasterized into mineable blocks. Buildings are hollow with real floors you can stand on.
- Hand-crafted landmark system: procedural builders (Jama Masjid with striped onion domes and minarets, India Gate) replace generic extrusion near registered anchors. Every landmark block is normal, mineable block data.
- 4 preset Delhi-NCR areas load instantly from local JSON — the demo works fully offline.
- Location search: type any place on Earth → Nominatim geocode → live Overpass fetch → walkable voxel city in ~30 seconds.
- AI command bar (press T): natural language → world commands (teleport, day/night, weather, spawn landmarks) via LLM with strict-JSON output, with an offline rule-based fallback.

## How it's built

- ONE self-contained `index.html`. Three.js via ES-module importmap from a CDN. No build step, no bundler, no image assets.
- World = `Map` of 16×16×64 chunks keyed by chunk coords, one `Uint8Array` per chunk. Everything — city, roads, landmarks — is plain block data.
- Rendering: culled face meshing per chunk (only faces exposed to air), per-face brightness for cheap AO; a chunk's mesh rebuilds when a block in it changes.
- Textures: 16×16-per-tile pixel-art atlas generated procedurally on a hidden canvas.
- OSM pipeline: Overpass JSON → lat/lon → meters (`x=(lon−lon0)·111320·cos(lat0)`, `z=−(lat−lat0)·110540`) → ÷3 (1 block = 3 m) → point-in-polygon rasterizer → hollow building shells, buffered road polylines, parks with voxel trees, water.
- Landmark registry `[{name, lat, lon, builder}]`: generic extrusion suppressed within 80 m of an anchor; the builder writes blocks directly into chunks.
- Geocoding via Nominatim, live city data via Overpass API; presets are cached Overpass responses committed to `data/`.
- Command bar sends input to an LLM API with a system prompt that returns strict JSON `{action, params}`; parsed and executed by the game.

## The AI story

- An AI coding agent built the entire engine and OSM pipeline — chunk system, mesher, physics, rasterizer — phase by phase against acceptance criteria.
- The LLM acts in-game as (a) the command interpreter behind the T bar and (b) the "architect" that designed the landmark builder blueprints from real dimensions (Jama Masjid's 99 m courtyard, 40 m minarets → 1 block = 3 m voxel plans).

## Locations shipped

| Preset | Area | BBox (S,W,N,E) | Landmark anchor |
|---|---|---|---|
| 1 HERO | Old Delhi — Jama Masjid, Red Fort, Chandni Chowk | 28.6470, 77.2290, 28.6600, 77.2430 | Jama Masjid @ 28.6507, 77.2334 |
| 2 | India Gate / Kartavya Path | 28.6065, 77.2215, 28.6195, 77.2375 | India Gate @ 28.6129, 77.2295 |
| 3 | Connaught Place | 28.6250, 77.2080, 28.6380, 77.2250 | — |
| 4 | Gurgaon Cyber City | 28.4890, 77.0800, 28.5010, 77.0960 | — |

## Controls

- **WASD** move, **mouse** look, **Space** jump, **Shift** sprint, **F** toggle fly
- **Left-click** break block, **Right-click** place block, **1–9** select hotbar slot
- **T** open the AI command bar

## Run instructions

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

No build step. The 4 presets load from local JSON in `data/` and work fully offline. Search and live fetch need internet; the command bar uses an LLM API key (set via the ⚙ in the command bar) and falls back to a built-in parser without one.

## Demo script

1. Open on Preset 4: "This is Cyber City — the area we're sitting in — as real, mineable blocks, generated from OpenStreetMap."
2. Swap to Preset 1: spawn in Chandni Chowk's dense lanes → walk to Jama Masjid → climb the eastern steps → courtyard reveal with striped domes, Red Fort walls visible NE.
3. Mine one block out of a minaret, place it back: "Every monument is real voxels."
4. `T → "make it night"` — live GPT-5.6 world command.
5. Close: "A week-long autonomous build gave the internet one voxel city. This generates any city on Earth in 30 seconds — and you can play it."

## Roadmap

- Multiplayer
- More cities (preset packs per metro)
- Height-data terrain (SRTM) under the city
- Export worlds to actual Minecraft (.mca)

## Status

- [x] Step 0 — PROJECT.md
- [ ] Data cached (4 presets)
- [ ] Phase 1 — voxel game core
- [ ] Phase 2 — OSM → city world-gen
- [ ] Phase 3 — Jama Masjid landmark
- [ ] Phase 4 — search + AI command bar
- [ ] Phase 5 — polish + backup
