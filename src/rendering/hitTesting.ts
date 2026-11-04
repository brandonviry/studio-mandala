import type { Point, Primitive } from '../domain';
import type { MandalaScene, SceneLayer } from './scene';

function distance(left: Point, right: Point): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function distanceToSegment(point: Point, start: Point, end: Point): number {
  const segmentX = end.x - start.x;
  const segmentY = end.y - start.y;
  const lengthSquared = segmentX * segmentX + segmentY * segmentY;
  if (lengthSquared === 0) return distance(point, start);

  const projection = Math.max(
    0,
    Math.min(
      1,
      ((point.x - start.x) * segmentX +
        (point.y - start.y) * segmentY) /
        lengthSquared,
    ),
  );
  return Math.hypot(
    point.x - (start.x + projection * segmentX),
    point.y - (start.y + projection * segmentY),
  );
}

function distanceToPath(
  point: Point,
  points: Point[],
  closed: boolean,
): number {
  if (points.length === 0) return Number.POSITIVE_INFINITY;
  if (points.length === 1) return distance(point, points[0] as Point);

  let closest = Number.POSITIVE_INFINITY;
  const segmentCount = closed ? points.length : points.length - 1;
  for (let index = 0; index < segmentCount; index += 1) {
    const start = points[index];
    const end = points[(index + 1) % points.length];
    if (!start || !end) continue;
    closest = Math.min(closest, distanceToSegment(point, start, end));
  }
  return closest;
}

function pointInPolygon(point: Point, points: Point[]): boolean {
  if (points.length < 3) return false;
  let inside = false;
  for (
    let index = 0, previous = points.length - 1;
    index < points.length;
    previous = index, index += 1
  ) {
    const currentPoint = points[index];
    const previousPoint = points[previous];
    if (!currentPoint || !previousPoint) continue;

    const crossesHorizontalRay =
      currentPoint.y > point.y !== previousPoint.y > point.y &&
      point.x <
        ((previousPoint.x - currentPoint.x) *
          (point.y - currentPoint.y)) /
          (previousPoint.y - currentPoint.y) +
          currentPoint.x;
    if (crossesHorizontalRay) inside = !inside;
  }
  return inside;
}

function hitPrimitive(
  primitive: Primitive,
  style: SceneLayer['style'],
  point: Point,
  tolerance: number,
): boolean {
  if (style.opacity <= 0) return false;

  if (primitive.kind === 'circle') {
    const centerDistance = distance(primitive.center, point);
    const fillHit =
      style.fill !== null && centerDistance <= primitive.radius + tolerance;
    const strokeHit =
      style.stroke !== null &&
      Math.abs(centerDistance - primitive.radius) <=
        tolerance + style.strokeWidth / 2;
    return fillHit || strokeHit;
  }

  const edgeDistance = distanceToPath(
    point,
    primitive.points,
    primitive.closed,
  );
  const fillHit =
    style.fill !== null &&
    primitive.closed &&
    (pointInPolygon(point, primitive.points) || edgeDistance <= tolerance);
  const strokeHit =
    style.stroke !== null &&
    edgeDistance <= tolerance + style.strokeWidth / 2;
  return fillHit || strokeHit;
}

export function hitTestLayer(
  scene: MandalaScene,
  point: Point,
  tolerance = 0.02,
): string | null {
  const safeTolerance = Number.isFinite(tolerance)
    ? Math.max(0, tolerance)
    : 0;
  for (let index = scene.layers.length - 1; index >= 0; index -= 1) {
    const layer = scene.layers[index];
    if (
      layer?.primitives.some((primitive) =>
        hitPrimitive(primitive, layer.style, point, safeTolerance),
      )
    ) {
      return layer.layerId;
    }
  }
  return null;
}
