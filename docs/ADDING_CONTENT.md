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
    spawn: { x: 0, y: 12, z: 36, yaw: 0 },
    landmarks: [gatewayOfIndia],
  }],
};
```

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

## Add a landmark from a 3D source model

1. Confirm that the source permits redistribution and modification.
2. Store the original model and its license under `assets/source/<landmark>/`.
3. Add visible attribution through the preset's `credit` field.
4. Generate compact spans with `scripts/voxelize-obj.mjs`.
5. Commit the source, attribution, transformation script and generated output.
6. Test the opening, bounds, approach clearance and block count.

India Gate is the reference implementation. Its generated data is rebuilt with
`npm run voxelize:india-gate`.

## Add a block

1. Add its ID to `engine/world/blocks.ts`.
2. Paint its atlas tile in `engine/rendering/textureAtlas.ts`.
3. Add it to the hotbar only if players should place it directly.

Block IDs are serialized into `Uint8Array`; keep values between 0 and 255 and
never reuse an ID once persisted multiplayer worlds exist.
