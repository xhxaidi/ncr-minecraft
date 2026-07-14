# Architecture

The project separates reusable engine code from geographic data and authored
content. That boundary is what allows many cities and landmarks to coexist
without turning the renderer into a collection of special cases.

```text
ncr-minecraft/
├── assets/source/                    # licensed source meshes + attribution
│   └── india-gate/
├── scripts/
│   └── voxelize-obj.mjs              # OBJ → compact mineable voxel spans
├── public/
│   ├── data/
│   │   └── cities/
│   │       ├── delhi/presets/*.overpass.json
│   │       └── gurugram/presets/*.overpass.json
│   └── og.png
├── src/
│   ├── engine/                      # plain TS, zero React imports
│   │   ├── game.ts                  # facade: init, loop, loadPreset, searchPlace,
│   │   │                            #   setTimeOfDay, execCommand, on(event)
│   │   ├── lighting.ts              # day/night rig, shadows, sky, fog, bloom
│   │   ├── physics/
│   │   │   ├── PlayerController.ts  # movement and AABB collision
│   │   │   └── raycast.ts           # voxel DDA raycast
│   │   ├── rendering/
│   │   │   └── ChunkMesher.ts       # culled chunk geometry, vertex-colour
│   │   │                            #   palette, per-vertex AO, face shading
│   │   └── world/
│   │       ├── blocks.ts            # block IDs, names and palette colours
│   │       └── VoxelWorld.ts        # chunks, reads, writes and dirty state
│   ├── geo/
│   │   └── osm/
│   │       ├── generateWorld.ts     # generic OSM → voxel pipeline
│   │       ├── projection.ts        # latitude/longitude → block coordinates
│   │       ├── raster.ts            # lines and polygon rasterization
│   │       └── types.ts             # Overpass response types
│   ├── content/
│   │   ├── catalog.ts               # global city registry
│   │   ├── types/                   # city, preset and landmark contracts
│   │   └── cities/
│   │       ├── delhi/
│   │       │   ├── index.ts         # Delhi presets
│   │       │   └── landmarks/       # builders + generated voxel datasets
│   │       └── gurugram/
│   │           └── index.ts         # Gurugram presets
│   ├── ui/                          # React components only
│   │   ├── store.ts                 # zustand store bridging engine → UI
│   │   ├── App.tsx                  # canvas mount, welcome/pause overlays
│   │   ├── TopBar.tsx               # preset dropdown, search, time toggle
│   │   ├── HUD.tsx                  # crosshair, FPS, hotbar, touch controls
│   │   ├── CommandBar.tsx           # T-key command overlay
│   │   └── LoadingOverlay.tsx
│   ├── main.tsx
│   └── styles.css
├── tests/unit/
├── index.html
├── netlify.toml
└── vite.config.ts
```

## Dependency direction

```text
React UI (src/ui) ── zustand store ──▶ engine events
    ↓ calls public API
Game facade (engine/game.ts)
    ↓
City catalog + generic OSM generator
    ↓
Voxel world + physics + renderer + lighting
```

The UI never touches scene objects. The engine pushes state through
`game.on(event)` listeners that write to the zustand store; components call
the facade's public API (`loadPreset`, `searchPlace`, `setTimeOfDay`,
`execCommand`).

The engine never imports a city or landmark. City packages may import the
engine's public block/world types. This one-way dependency makes the engine
reusable for Mumbai, Bengaluru or any other future city.

## Core contracts

### City

A city is metadata plus a list of presets. It does not render anything.

### Preset

A preset defines an origin, cached data URL, world radius, spawn and landmark
registrations. It is the smallest selectable world in the UI.

### Landmark

A landmark owns its geographic anchor, suppression radius and a builder. The
generic OSM generator skips ordinary building extrusion near that anchor and
then executes the builder. Builders write ordinary block IDs into `VoxelWorld`,
so mining, placement, collision and rendering work automatically.

Landmarks can be authored directly or generated from an attributed source mesh.
The India Gate pipeline stores its licensed OBJ separately, converts it into
compact horizontal spans at build time and commits the deterministic output.
This keeps runtime loading fast while preserving provenance and reproducibility.

### Engine

`VoxelWorld` owns authoritative block state. Rendering is a derived cache:
changing a block marks the affected chunk and its boundary neighbours dirty;
`ChunkMesher` rebuilds a limited number each frame.

## Scaling path

1. Add more cached presets and landmark builders.
2. Move OSM rasterization into Web Workers when worlds become larger.
3. Persist only block edits relative to the generated base world.
4. Add room-authoritative multiplayer using compact block-edit messages.
5. Stream chunks around the player instead of keeping the full district loaded.
