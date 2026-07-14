import type { BlockPoint } from "./projection";

export function rasterLine(a: BlockPoint, b: BlockPoint): BlockPoint[] {
  const points: BlockPoint[] = [];
  let x0 = a.x;
  let z0 = a.z;
  const x1 = b.x;
  const z1 = b.z;
  const dx = Math.abs(x1 - x0);
  const dz = Math.abs(z1 - z0);
  const sx = x0 < x1 ? 1 : -1;
  const sz = z0 < z1 ? 1 : -1;
  let error = dx - dz;
  while (true) {
    points.push({ x: x0, z: z0 });
    if (x0 === x1 && z0 === z1) break;
    const doubled = error * 2;
    if (doubled > -dz) {
      error -= dz;
      x0 += sx;
    }
    if (doubled < dx) {
      error += dx;
      z0 += sz;
    }
  }
  return points;
}

export function pointInPolygon(point: BlockPoint, polygon: BlockPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const pi = polygon[i];
    const pj = polygon[j];
    if (!pi || !pj) continue;
    const intersects = ((pi.z > point.z) !== (pj.z > point.z)) &&
      point.x < (pj.x - pi.x) * (point.z - pi.z) / ((pj.z - pi.z) || Number.EPSILON) + pi.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function polygonBounds(polygon: BlockPoint[]) {
  return polygon.reduce(
    (bounds, point) => ({
      minX: Math.min(bounds.minX, point.x),
      maxX: Math.max(bounds.maxX, point.x),
      minZ: Math.min(bounds.minZ, point.z),
      maxZ: Math.max(bounds.maxZ, point.z),
    }),
    { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity },
  );
}
