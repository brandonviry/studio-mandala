import {
  assertValidProject,
  type GeneratedLayer,
  type MandalaLayer,
  type MandalaProject,
  type Primitive,
} from '../domain';
import { generateLayerGeometry } from '../generation';

export interface SceneLayer extends GeneratedLayer {
  style: MandalaLayer['style'];
}

export interface MandalaScene {
  project: MandalaProject;
  layers: SceneLayer[];
}

export type GeometryGenerator = (layer: MandalaLayer) => GeneratedLayer;

export interface GeometryCacheOptions {
  maxEntries?: number;
  generate?: GeometryGenerator;
}

const DEFAULT_CACHE_SIZE = 64;

export function geometrySignature(layer: MandalaLayer): string {
  switch (layer.kind) {
    case 'disk':
      // La rotation du disque est intentionnellement sans effet.
      return JSON.stringify(['disk', layer.radius]);
    case 'flower':
      return JSON.stringify([
        'flower',
        layer.outerRadius,
        layer.innerRatio,
        layer.petalCount,
        layer.rotationDeg,
      ]);
    case 'circle-ring':
      return JSON.stringify([
        'circle-ring',
        layer.orbitRadius,
        layer.circleRadius,
        layer.circleCount,
        layer.rotationDeg,
      ]);
  }
}

export class GeometryCache {
  readonly maxEntries: number;
  private readonly generate: GeometryGenerator;
  private readonly entries = new Map<string, Primitive[]>();

  constructor(options: GeometryCacheOptions = {}) {
    const maxEntries = options.maxEntries ?? DEFAULT_CACHE_SIZE;
    if (!Number.isInteger(maxEntries) || maxEntries < 1) {
      throw new RangeError('Le cache doit contenir au moins une entrée.');
    }
    this.maxEntries = maxEntries;
    this.generate = options.generate ?? generateLayerGeometry;
  }

  get size(): number {
    return this.entries.size;
  }

  get(layer: MandalaLayer): Primitive[] {
    const signature = geometrySignature(layer);
    const cached = this.entries.get(signature);
    if (cached) {
      // Réinsérer l’entrée la place en fin de Map : éviction LRU déterministe.
      this.entries.delete(signature);
      this.entries.set(signature, cached);
      return cached;
    }

    const primitives = this.generate(layer).primitives;
    this.entries.set(signature, primitives);
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
    return primitives;
  }

  clear(): void {
    this.entries.clear();
  }
}

// CanvasStage recrée une scène à chaque nouvel objet projet. Ce cache de module
// conserve les primitives entre ces scènes tout en bornant strictement la mémoire.
const defaultGeometryCache = new GeometryCache();

export function createScene(
  project: MandalaProject,
  cache: GeometryCache = defaultGeometryCache,
): MandalaScene {
  assertValidProject(project);
  return {
    project,
    layers: project.layers
      .filter((layer) => layer.visible)
      .map((layer) => ({
        layerId: layer.id,
        primitives: cache.get(layer),
        style: layer.style,
      })),
  };
}

export function describeProject(project: MandalaProject): string {
  const visible = project.layers.filter((layer) => layer.visible);
  const suffix = visible.length === 1 ? '' : 's';
  const layerDescription =
    visible
      .map((layer) => `${layer.name} (${layer.kind})`)
      .join(', ') || 'aucune';
  return `${project.title}, ${visible.length} couche${suffix} visible${suffix} : ${layerDescription}.`;
}
