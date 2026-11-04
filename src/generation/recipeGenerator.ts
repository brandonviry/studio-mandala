import {
  assertValidProject,
  canonicalizeSeed,
  createDefaultLayer,
  type LayerKind,
  type MandalaLayer,
  type MandalaProject,
} from '../domain';
import { seededRandom } from './prng';

const RECIPE_VERSION_PREFIX = 'recipe-v1:';
const PALETTES = [
  ['#23395b', '#6a8d92', '#f4d35e'],
  ['#372248', '#f46036', '#f3e9d2'],
  ['#0b6e4f', '#e0a458', '#d1345b'],
] as const;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function layerEnvelope(layer: MandalaLayer): number {
  if (layer.kind === 'flower') return layer.outerRadius;
  if (layer.kind === 'circle-ring') {
    return layer.orbitRadius + layer.circleRadius;
  }
  return layer.radius;
}

export function generateProject(
  seed: string,
  generatorVersion: 1 = 1,
): MandalaProject {
  if (generatorVersion !== 1) {
    throw new RangeError('Version de générateur non prise en charge.');
  }

  const canonicalSeed = canonicalizeSeed(seed);
  const random = seededRandom(`${RECIPE_VERSION_PREFIX}${canonicalSeed}`);

  // Calendrier recipe-v1 : palette, nombre, types additionnels, puis cinq
  // tirages fixes par descripteur (rayon, rotation, répétition, détail, couleur).
  const palette = PALETTES[Math.floor(random() * PALETTES.length)];
  if (!palette) throw new RangeError('Palette indisponible.');

  const layerCount = 3 + Math.floor(random() * 6);
  const kinds: LayerKind[] = ['disk', 'flower', 'circle-ring'];
  while (kinds.length < layerCount) {
    kinds.push(random() < 0.5 ? 'flower' : 'circle-ring');
  }

  const nonDiskCount = kinds.filter((kind) => kind !== 'disk').length;
  let nonDiskIndex = 0;
  const descriptors = kinds.map((kind) => {
    const radiusDraw = random();
    const rotationDraw = random();
    const repetitionDraw = random();
    const detailDraw = random();
    const colorDraw = random();
    const layer = createDefaultLayer(kind);

    layer.rotationDeg = Math.floor(rotationDraw * 36_000) / 100;
    if (layer.kind === 'disk') {
      layer.radius = 0.12 + radiusDraw * 0.24;
    } else {
      const band =
        0.18 + (nonDiskIndex / Math.max(1, nonDiskCount - 1)) * 0.72;
      nonDiskIndex += 1;
      const envelope = clamp(band + (radiusDraw - 0.5) * 0.04, 0.18, 0.9);

      if (layer.kind === 'flower') {
        layer.outerRadius = envelope;
        layer.petalCount = 3 + Math.floor(repetitionDraw * 14);
        layer.innerRatio = 0.12 + detailDraw * 0.5;
      } else {
        layer.circleCount = 5 + Math.floor(repetitionDraw * 20);
        layer.circleRadius = 0.02 + detailDraw * 0.07;
        layer.orbitRadius = envelope - layer.circleRadius;
      }
    }

    layer.style = {
      ...layer.style,
      fill: palette[Math.floor(colorDraw * palette.length)] ?? palette[0],
    };
    return layer;
  });

  const disk = descriptors.find((layer) => layer.kind === 'disk');
  if (!disk) throw new Error('La recette V1 doit contenir un disque.');

  const foregroundLayers = descriptors
    .filter((layer) => layer.kind !== 'disk')
    .sort((left, right) => layerEnvelope(right) - layerEnvelope(left));
  const layers = [disk, ...foregroundLayers].map((layer, index) => ({
    ...layer,
    id: `layer-${index + 1}`,
  })) as MandalaLayer[];

  const project: MandalaProject = {
    schemaVersion: 1,
    generatorVersion,
    title: `Mandala ${canonicalSeed}`,
    seed: canonicalSeed,
    background: '#fffaf2',
    nextLayerNumber: layerCount + 1,
    layers,
  };
  assertValidProject(project);
  return project;
}
