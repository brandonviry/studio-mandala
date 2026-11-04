import {
  createDefaultLayer,
  createEmptyProject,
  deserializeProject,
  type MandalaLayer,
  type MandalaProject,
} from '../../src/domain';
import nominalFixture from './fixtures/nominal-v1.mandala.json';

export function loadNominalPerformanceFixture(): MandalaProject {
  return deserializeProject(JSON.stringify(nominalFixture));
}

export function createPerformanceProject(layerCount = 8): MandalaProject {
  if (!Number.isInteger(layerCount) || layerCount < 1 || layerCount > 32) {
    throw new RangeError('Le benchmark accepte entre 1 et 32 couches.');
  }

  const layers = Array.from({ length: layerCount }, (_, index) => {
    const kind =
      index % 3 === 0
        ? 'disk'
        : index % 3 === 1
          ? 'flower'
          : 'circle-ring';
    const layer = createDefaultLayer(kind, `layer-${index + 1}`);
    if (layer.kind === 'flower') {
      layer.petalCount = 32;
      layer.rotationDeg = index * 7.5;
    }
    if (layer.kind === 'circle-ring') {
      layer.circleCount = 64;
      layer.rotationDeg = index * 5;
    }
    return layer;
  }) as MandalaLayer[];

  return {
    ...createEmptyProject('performance-v1'),
    title: `Benchmark ${layerCount} couches`,
    nextLayerNumber: layerCount + 1,
    layers,
  };
}
