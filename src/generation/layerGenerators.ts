import type {
  GeneratedLayer,
  MandalaLayer,
  Point,
  Primitive,
} from '../domain';

const radians = (degrees: number): number => (degrees * Math.PI) / 180;

function generateFlower(layer: Extract<MandalaLayer, { kind: 'flower' }>) {
  const sampleCount = layer.petalCount * 32;
  const phase = radians(layer.rotationDeg);
  const points: Point[] = Array.from({ length: sampleCount }, (_, index) => {
    const angle = (2 * Math.PI * index) / sampleCount;
    const radius =
      layer.outerRadius *
      (layer.innerRatio +
        ((1 - layer.innerRatio) *
          (1 + Math.cos(layer.petalCount * (angle - phase)))) /
          2);
    return {
      x: radius * Math.cos(angle),
      y: radius * Math.sin(angle),
    };
  });
  return [{ kind: 'path' as const, points, closed: true }];
}

function generateCircleRing(
  layer: Extract<MandalaLayer, { kind: 'circle-ring' }>,
) {
  const phase = radians(layer.rotationDeg);
  return Array.from({ length: layer.circleCount }, (_, index) => {
    const angle = phase + (2 * Math.PI * index) / layer.circleCount;
    return {
      kind: 'circle' as const,
      center: {
        x: layer.orbitRadius * Math.cos(angle),
        y: layer.orbitRadius * Math.sin(angle),
      },
      radius: layer.circleRadius,
    };
  });
}

export function generateLayerGeometry(layer: MandalaLayer): GeneratedLayer {
  let primitives: Primitive[];
  switch (layer.kind) {
    case 'disk':
      primitives = [
        {
          kind: 'circle',
          center: { x: 0, y: 0 },
          radius: layer.radius,
        },
      ];
      break;
    case 'circle-ring':
      primitives = generateCircleRing(layer);
      break;
    case 'flower':
      primitives = generateFlower(layer);
      break;
    default: {
      const unsupported: never = layer;
      throw new TypeError(
        `Type de couche inconnu : ${String(
          (unsupported as { kind?: unknown }).kind,
        )}`,
      );
    }
  }
  return { layerId: layer.id, primitives };
}
