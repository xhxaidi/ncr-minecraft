# Adding cities and landmarks

## Add a city

1. Create `src/content/cities/<city-id>/index.ts`.
2. Add cached Overpass files beneath `public/data/cities/<city-id>/presets/`.
3. Export a `CityDefinition` containing one or more presets.
4. Register the city once in `src/content/catalog.ts`.

Example:

```ts
export const mumbai: CityDefinition = {
  id: "mumbai",
  name: "Mumbai",
  region: "Maharashtra",
  description: "Island-city districts and waterfront landmarks.",
  presets: [{
    id: "gateway-of-india",
    cityId: "mumbai",
    name: "Gateway of India",
    shortName: "Gateway of India",
    description: "Colaba roads and a mineable waterfront arch.",
    origin: { lat: 18.9219, lon: 72.8347 },
    dataUrl: "/data/cities/mumbai/presets/gateway.overpass.json",
    radiusChunks: 12,
    spawn: { x: 0, y: 12, z: 36, yaw: Math.PI },
    landmarks: [gatewayOfIndia],
  }],
};
```

## Fine-grained presets

Presets default to 3 metres per block. Set `blockMetres` (for example `1.5`)
for finer detail, and `buildingDetails` to enrich specific OSM ways with real
heights and materials the map data lacks:

```ts
blockMetres: 1.5,
buildingDetails: {
  121362984: { heightMetres: 60, material: "glass" },
},
```

Landmark builders registered in a fine-grained preset should author geometry
at that preset's scale.

## Add a landmark

1. Create a builder in the owning city's `landmarks/` directory.
2. Give it an anchor and a suppression radius.
3. Write blocks relative to the supplied `originX`, `originZ` and `groundY`.
4. Register it in one or more presets.

```ts
export const exampleLandmark: LandmarkDefinition = {
  id: "example",
  name: "Example Landmark",
  description: "A fully mineable example.",
  anchor: { lat: 0, lon: 0 },
  suppressRadiusMetres: 80,
  build: ({ world, originX, originZ, groundY, block }) => {
    world.setBlockRaw(originX, groundY + 1, originZ, block.BRICK);
  },
};
```

Do not add landmark checks to the renderer, collision system or OSM parser.
Registration is the extension mechanism.

## Add a block

1. Add its ID to `engine/world/blocks.ts`.
2. Paint its atlas tile in `engine/rendering/textureAtlas.ts`.
3. Add it to the hotbar only if players should place it directly.

Block IDs are serialized into `Uint8Array`; keep values between 0 and 255 and
never reuse an ID once persisted multiplayer worlds exist.
