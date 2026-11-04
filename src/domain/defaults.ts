import type {
  LayerKind,
  LayerStyle,
  MandalaLayer,
  MandalaProject,
} from './types';
import { canonicalizeSeed } from './validation';

function createDefaultStyle(): LayerStyle {
  return {
    stroke: '#231f20',
    strokeWidth: 0.006,
    fill: '#e9a66f',
    opacity: 1,
  };
}

export function createEmptyProject(seed = 'atelier'): MandalaProject {
  return {
    schemaVersion: 1,
    generatorVersion: 1,
    title: 'Nouveau mandala',
    seed: canonicalizeSeed(seed),
    background: '#fffaf2',
    nextLayerNumber: 1,
    layers: [],
  };
}

export function createDefaultLayer(
  kind: LayerKind,
  id = 'layer-1',
): MandalaLayer {
  if (kind !== 'flower' && kind !== 'disk' && kind !== 'circle-ring') {
    throw new TypeError('Type de couche inconnu.');
  }

  const base = {
    id,
    name:
      kind === 'flower' ? 'Fleur' : kind === 'disk' ? 'Disque' : 'Anneau',
    visible: true,
    locked: false,
    rotationDeg: 0,
    style: createDefaultStyle(),
  };

  if (kind === 'flower') {
    return {
      ...base,
      kind,
      outerRadius: 0.72,
      innerRatio: 0.3,
      petalCount: 8,
    };
  }
  if (kind === 'disk') {
    return { ...base, kind, radius: 0.22 };
  }
  return {
    ...base,
    kind,
    orbitRadius: 0.72,
    circleRadius: 0.09,
    circleCount: 12,
  };
}

export function createExampleProject(): MandalaProject {
  const project = createEmptyProject('exemple-v1');
  return {
    ...project,
    title: 'Mandala exemple',
    nextLayerNumber: 4,
    layers: [
      {
        ...createDefaultLayer('disk', 'layer-1'),
        style: { ...createDefaultStyle(), fill: '#f5cf8e' },
      },
      {
        ...createDefaultLayer('flower', 'layer-2'),
        rotationDeg: 11.25,
      },
      {
        ...createDefaultLayer('circle-ring', 'layer-3'),
        style: { ...createDefaultStyle(), fill: '#6aa5a0' },
      },
    ],
  };
}
