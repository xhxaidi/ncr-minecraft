# Dilli Blocks

Dilli Blocks turns real Delhi-NCR map data into an editable voxel world. The
repository combines a chunked block engine, cached OpenStreetMap presets and
handcrafted landmark builders in a Netlify-ready Vite application.

## Current capabilities

- Chunked `Uint8Array` voxel storage and exposed-face meshing with per-vertex
  AO, directional face shading and a vertex-colour palette
- React + zustand UI over a plain-TS engine facade (`engine/game.ts`)
- Day-first lighting: sun/hemisphere rig, soft shadows with an FPS kill
  switch, bloom; `T` command bar ("make it night") flips windows and neon
  to emissive night mode
- AABB movement, jumping, sprinting, flying and block-accurate raycasting
- Mine/place any visible block
- Cached OSM import for India Gate, Old Delhi, Connaught Place and Cyber City
- Generic roads, parks, water and hollow building extrusion
- Mineable India Gate and Qutub Minar landmark builders
- Guest naming, district selection, touch controls and day/night mode
- TypeScript, unit tests, production build and Netlify configuration

## Honest boundaries

- Multiplayer and server-side persistence are not implemented yet.
- Qutub Minar currently uses a handcrafted landmark lab rather than a cached OSM preset.
- Jama Masjid, Masters' Union and 32nd Avenue still need dedicated landmark builders.
- Building heights fall back to sensible defaults when OSM has no level data.

The full design and extension contracts live in `docs/ARCHITECTURE.md` and
`docs/ADDING_CONTENT.md`.
