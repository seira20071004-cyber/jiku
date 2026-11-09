export const ORIGIN_FOV = 42;
export const ORIGIN_RADIUS = 3.2;
export const originDistance = aspect => Math.max(24, 19 / Math.max(.2, aspect));

// A sphere's apparent edge is the tangent to it, not its center plane.
export function projectedOriginRadius(width, height) {
  if (!width || !height) return 0;
  const distance = originDistance(width / height);
  const tangent = Math.sqrt(distance ** 2 - ORIGIN_RADIUS ** 2);
  return height * ORIGIN_RADIUS / (2 * tangent * Math.tan(ORIGIN_FOV * Math.PI / 360));
}
