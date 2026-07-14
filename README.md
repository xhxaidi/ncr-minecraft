# Dilli Blocks

**Real NCR, every block mineable.** Dilli Blocks converts cached OpenStreetMap
data into a browser-playable voxel city, then replaces important sites with
handcrafted, fully editable landmark builders.

## Included worlds

- India Gate and Kartavya Path — OSM city context + mineable India Gate
- Old Delhi and Jama Masjid — OSM roads and building footprints
- Connaught Place — OSM radial roads and urban blocks
- Gurugram Cyber City — OSM roads and high-rise footprints
- Qutub Minar Landmark Lab — handcrafted mineable tower

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

## Controls

- `WASD` / arrows: move
- Mouse: look
- `Space`: jump
- `Shift`: sprint
- `F`: toggle fly; `C` descends while flying
- Left click: mine
- Right click: place
- `1`–`9`: select a block
- `Esc`: release the cursor and change districts

## Quality checks

```bash
npm run check
```

## Deploy to Netlify

1. Import this GitHub repository into Netlify.
2. Netlify reads `netlify.toml` automatically.
3. Build command: `npm run build`
4. Publish directory: `dist`

No API key is required for the included worlds. Map data is cached under
`public/data/cities` and Three.js is bundled locally. Map data is ©
[OpenStreetMap contributors](https://www.openstreetmap.org/copyright) and is
used under the ODbL.

## Add content

The engine does not contain city-specific logic. See
[`docs/ADDING_CONTENT.md`](docs/ADDING_CONTENT.md) for the city manifest and
landmark-builder contracts.
