import { describe, expect, it } from 'vitest';
import { createScene, GeometryCache } from '../../src/rendering';
import { loadNominalPerformanceFixture } from './fixtures';

function percentile95(samples: number[]): number {
  const sorted = [...samples].sort((left, right) => left - right);
  return sorted[Math.ceil(sorted.length * 0.95) - 1] ?? Number.POSITIVE_INFINITY;
}

describe('budget de rendu nominal', () => {
  it('génère la scène nominale en 50 ms au p95', () => {
    const project = loadNominalPerformanceFixture();

    for (let index = 0; index < 5; index += 1) {
      createScene(project, new GeometryCache());
    }

    const samples = Array.from({ length: 30 }, () => {
      const startedAt = performance.now();
      createScene(project, new GeometryCache());
      return performance.now() - startedAt;
    });

    expect(percentile95(samples)).toBeLessThanOrEqual(50);
  });
});
