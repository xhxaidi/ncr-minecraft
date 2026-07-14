import type { GeoPoint } from "../../content/types/catalog";

export const BLOCK_METRES = 3;

export type BlockPoint = { x: number; z: number };

export function geoToBlock(point: GeoPoint, origin: GeoPoint): BlockPoint {
  const xMetres = (point.lon - origin.lon) * 111_320 * Math.cos(origin.lat * Math.PI / 180);
  const zMetres = -(point.lat - origin.lat) * 110_540;
  const x = Math.round(xMetres / BLOCK_METRES);
  const z = Math.round(zMetres / BLOCK_METRES);
  return {
    x: Object.is(x, -0) ? 0 : x,
    z: Object.is(z, -0) ? 0 : z,
  };
}

export function distanceMetres(a: GeoPoint, b: GeoPoint): number {
  const dx = (a.lon - b.lon) * 111_320 * Math.cos(b.lat * Math.PI / 180);
  const dz = (a.lat - b.lat) * 110_540;
  return Math.hypot(dx, dz);
}
