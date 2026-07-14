# Architecture

The project separates reusable engine code from geographic data and authored
content. That boundary is what allows many cities and landmarks to coexist
without turning the renderer into a collection of special cases.

```text
ncr-minecraft/
├── public/
│   ├── data/
│   │   └── cities/
│   │       ├── delhi/presets/*.overpass.json
│   │       └── gurugram/presets/*.overpass.json
│   └── og.png
├── src/
│   ├── app/
│   │   └── GameApp.ts               # runtime orchestration and DOM UI
│   ├── engine/
│   │   ├── physics/
│   │   │   ├── PlayerController.ts  # movement and AABB collision
│   │   │   └── raycast.ts           # voxel DDA raycast
│   │   ├── rendering/
│   │   │   ├── ChunkMesher.ts       # exposed-face chunk geometry
│   │   │   └── textureAtlas.ts      # generated pixel textures
│   │   └── world/
│   │       ├── blocks.ts            # block IDs and properties
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
│   │       │   └── landmarks/       # Delhi landmark builders
│   │       └── gurugram/
│   │           └── index.ts         # Gurugram presets
│   ├── main.ts
│   └── styles.css
├── tests/unit/
├── index.html
├── netlify.toml
└── vite.config.ts
```

## Dependency direction

```text
UI / GameApp
    ↓
City catalog + generic OSM generator
    ↓
Voxel world + physics + renderer
```

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
