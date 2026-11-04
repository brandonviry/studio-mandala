import { describe, expect, it } from 'vitest';
import { createScene, GeometryCache } from '../../src/rendering';
import { createPerformanceProject } from './fixtures';

const thirtyMinutes = 30 * 60 * 1_000;

describe('stress prolongé', () => {
  it(
    'reste stable pendant trente minutes de modifications',
    () => {
      const duration = Number(
        process.env.MANDALA_STRESS_MS ?? thirtyMinutes,
      );
      const startedAt = performance.now();
      const baselineHeap = process.memoryUsage().heapUsed;
      let operations = 0;
      let longestOperation = 0;

      while (performance.now() - startedAt < duration) {
        const operationStartedAt = performance.now();
        const project = createPerformanceProject(24);
        const rotation = operations % 360;
        const firstEditableLayer = project.layers.find(
          (layer) => layer.kind !== 'disk',
        );
        if (firstEditableLayer) firstEditableLayer.rotationDeg = rotation;
        createScene(project, new GeometryCache());
        longestOperation = Math.max(
          longestOperation,
          performance.now() - operationStartedAt,
        );
        operations += 1;
      }

      const residualHeap = process.memoryUsage().heapUsed - baselineHeap;
      expect(operations).toBeGreaterThan(0);
      expect(longestOperation).toBeLessThanOrEqual(2_000);
      expect(residualHeap).toBeLessThanOrEqual(25 * 1024 * 1024);
    },
    thirtyMinutes + 60_000,
  );
});
