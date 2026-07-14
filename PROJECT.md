# Dilli Blocks

Dilli Blocks turns real Delhi-NCR map data into an editable voxel world. The
repository combines a chunked block engine, cached OpenStreetMap presets and
handcrafted landmark builders in a Netlify-ready Vite application.

## Current capabilities

- Chunked `Uint8Array` voxel storage and exposed-face meshing
- AABB movement, jumping, sprinting, flying and block-accurate raycasting
- Mine/place any visible block
- Cached OSM import for India Gate, Old Delhi, Connaught Place, Cyber Hub and Cyber City
- Generic roads, parks, water, parking and hollow building extrusion
- Per-preset voxel scale, multipolygon buildings, footpaths, zebra crossings,
  road markings, kerbside pavements, mapped trees, hedges, fences, fountains,
  street lamps, metro entrances, flagpoles and the elevated metro
- Per-building height/material enrichment (`buildingDetails`) and preset-wide
  restyling (`buildingStyle`)
- Fine-grained Connaught Place (2 m/block): white colonnaded circles, Central
  Park amphitheatre and the 63 m flag
- Fine-grained DLF Cyber Hub (1.5 m/block): plaza, skywalk, real DLF towers and
  the Rapid Metro
- Mineable India Gate, Qutub Minar and DLF Cyber Hub landmark builders
- Guest naming, district selection, touch controls and day/night mode
- TypeScript, unit tests, production build and Netlify configuration

## Honest boundaries

- Multiplayer and server-side persistence are not implemented yet.
- Qutub Minar currently uses a handcrafted landmark lab rather than a cached OSM preset.
- Jama Masjid, Masters' Union and 32nd Avenue still need dedicated landmark builders.
- Building heights fall back to sensible defaults when OSM has no level data.

The full design and extension contracts live in `docs/ARCHITECTURE.md` and
`docs/ADDING_CONTENT.md`.
