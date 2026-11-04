import { describe, expect, it } from 'vitest';
import {
  addLayer,
  createDefaultLayer,
  createEmptyProject,
  createExampleProject,
  deserializeProject,
  duplicateLayer,
  moveLayer,
  normalizeRotation,
  removeLayer,
  serializeProject,
  setLayerLocked,
  setLayerVisibility,
  updateLayer,
  validateProject,
  type MandalaProject,
  type Result,
} from '../../src/domain';
import {
  generateLayerGeometry,
  generateProject,
} from '../../src/generation';
import {
  createScene,
  describeProject,
  GeometryCache,
  hitTestLayer,
} from '../../src/rendering';
import recipeGolden from './fixtures/recipe-v1.golden.json';

function unwrap(result: Result<MandalaProject>): MandalaProject {
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

function asMutableJson(project: MandalaProject): Record<string, unknown> {
  return JSON.parse(JSON.stringify(project)) as Record<string, unknown>;
}

function firstLayer(
  project: Record<string, unknown>,
): Record<string, unknown> {
  const layers = project.layers as Array<Record<string, unknown>>;
  const layer = layers[0];
  if (!layer) throw new Error('Fixture sans couche.');
  return layer;
}

const invalidProjectCases: Array<
  [label: string, mutate: (raw: Record<string, unknown>) => void]
> = [
  [
    'un titre non textuel',
    (raw) => {
      raw.title = { unsafe: true };
    },
  ],
  [
    'un discriminant inconnu',
    (raw) => {
      firstLayer(raw).kind = 'star';
    },
  ],
  [
    'une visibilité non booléenne',
    (raw) => {
      firstLayer(raw).visible = 'false';
    },
  ],
  [
    'une couleur avec alpha',
    (raw) => {
      const style = firstLayer(raw).style as Record<string, unknown>;
      style.fill = '#11223380';
    },
  ],
  [
    'une rotation non canonique',
    (raw) => {
      firstLayer(raw).rotationDeg = 360;
    },
  ],
  [
    'un compteur non sûr',
    (raw) => {
      raw.nextLayerNumber = 1e100;
    },
  ],
  [
    'une propriété supplémentaire',
    (raw) => {
      raw.debugPayload = true;
    },
  ],
];

describe('validation et sérialisation', () => {
  it('sérialise un projet valide sans perte', () => {
    const project = generateProject('aller-retour');
    expect(deserializeProject(serializeProject(project))).toEqual(project);
  });

  it('refuse les versions futures avec une erreur explicite', () => {
    const raw = asMutableJson(generateProject('future'));
    raw.schemaVersion = 2;
    expect(() => deserializeProject(JSON.stringify(raw))).toThrow(/future/i);
  });

  it.each(invalidProjectCases)('refuse %s à la désérialisation', (_label, mutate) => {
    const raw = asMutableJson(generateProject('hostile'));
    mutate(raw);
    expect(validateProject(raw).length).toBeGreaterThan(0);
    expect(() => deserializeProject(JSON.stringify(raw))).toThrow();
  });

  it('rejette NaN, Infinity et les identifiants non canoniques', () => {
    const project = generateProject('bornes');
    const invalidNumber = {
      ...project,
      layers: project.layers.map((layer, index) =>
        index === 0
          ? { ...layer, style: { ...layer.style, opacity: Number.NaN } }
          : layer,
      ),
    };
    const invalidId = {
      ...project,
      layers: project.layers.map((layer, index) =>
        index === 0 ? { ...layer, id: 'layer-01' } : layer,
      ),
    };
    const invalidInfinity = {
      ...project,
      layers: project.layers.map((layer, index) =>
        index === 0 ? { ...layer, rotationDeg: Number.POSITIVE_INFINITY } : layer,
      ),
    };

    expect(validateProject(invalidNumber).length).toBeGreaterThan(0);
    expect(validateProject(invalidId).length).toBeGreaterThan(0);
    expect(validateProject(invalidInfinity).length).toBeGreaterThan(0);
  });
});

describe('opérations de couches', () => {
  it('limite ajout et duplication à 32 couches sans mutation', () => {
    let project = createEmptyProject();
    for (let index = 0; index < 32; index += 1) {
      project = unwrap(addLayer(project, 'disk'));
    }
    const snapshot = structuredClone(project);

    expect(addLayer(project, 'disk')).toEqual({
      ok: false,
      error: '32 couches maximum',
    });
    expect(duplicateLayer(project, 'layer-1')).toEqual({
      ok: false,
      error: '32 couches maximum',
    });
    expect(project).toEqual(snapshot);
  });

  it('applique une modification uniquement à la couche visée', () => {
    const withFlower = unwrap(addLayer(createEmptyProject(), 'flower'));
    const project = unwrap(addLayer(withFlower, 'disk'));
    const beforeDisk = project.layers[1];
    const updated = unwrap(
      updateLayer(project, 'layer-1', {
        outerRadius: 0.42,
        rotationDeg: -45,
      }),
    );

    expect(project.layers[0]).not.toEqual(updated.layers[0]);
    expect(project.layers[1]).toBe(beforeDisk);
    expect(updated.layers[0]?.rotationDeg).toBe(315);
    expect(project.layers[0]).not.toEqual(updated.layers[0]);
  });

  it('refuse les propriétés protégées, inconnues ou d’un autre type', () => {
    const project = unwrap(addLayer(createEmptyProject(), 'flower'));
    expect(updateLayer(project, 'layer-1', { id: 'layer-9' }).ok).toBe(false);
    expect(updateLayer(project, 'layer-1', { radius: 0.4 }).ok).toBe(false);
    expect(updateLayer(project, 'layer-1', { arbitrary: true }).ok).toBe(
      false,
    );
  });

  it('respecte le verrouillage tout en permettant visibilité et duplication', () => {
    const project = unwrap(addLayer(createEmptyProject(), 'flower'));
    const locked = unwrap(setLayerLocked(project, 'layer-1', true));

    expect(updateLayer(locked, 'layer-1', { name: 'Bloqué' }).ok).toBe(false);
    expect(moveLayer(locked, 'layer-1', 0).ok).toBe(false);
    expect(removeLayer(locked, 'layer-1').ok).toBe(false);
    expect(unwrap(setLayerVisibility(locked, 'layer-1', false)).layers[0])
      .toMatchObject({ locked: true, visible: false });
    expect(unwrap(duplicateLayer(locked, 'layer-1')).layers[1]?.locked).toBe(
      false,
    );
  });

  it('réordonne et supprime sans altérer le projet source', () => {
    let project = createEmptyProject();
    project = unwrap(addLayer(project, 'disk'));
    project = unwrap(addLayer(project, 'flower'));
    project = unwrap(addLayer(project, 'circle-ring'));
    const originalOrder = project.layers.map((layer) => layer.id);

    const moved = unwrap(moveLayer(project, 'layer-1', 2));
    expect(moved.layers.map((layer) => layer.id)).toEqual([
      'layer-2',
      'layer-3',
      'layer-1',
    ]);
    expect(project.layers.map((layer) => layer.id)).toEqual(originalOrder);

    const removed = unwrap(removeLayer(moved, 'layer-3'));
    expect(removed.layers.map((layer) => layer.id)).toEqual([
      'layer-2',
      'layer-1',
    ]);
    expect(moved.layers).toHaveLength(3);
  });

  it('convertit les échecs de validation en Result au lieu de lever', () => {
    const project = {
      ...createEmptyProject(),
      nextLayerNumber: Number.MAX_SAFE_INTEGER,
    };
    expect(() => addLayer(project, 'disk')).not.toThrow();
    expect(addLayer(project, 'disk').ok).toBe(false);
    expect(moveLayer(project, 'missing', Number.NaN).ok).toBe(false);
  });
});

describe('géométrie et génération déterministe', () => {
  it('échantillonne et ferme une fleur avec exactement 32 points par pétale', () => {
    const flower = createDefaultLayer('flower');
    if (flower.kind !== 'flower') throw new Error('Fleur attendue.');
    const generated = generateLayerGeometry(flower);
    const primitive = generated.primitives[0];

    expect(primitive?.kind).toBe('path');
    if (primitive?.kind !== 'path') throw new Error('Chemin attendu.');
    expect(primitive.closed).toBe(true);
    expect(primitive.points).toHaveLength(flower.petalCount * 32);
    expect(generateLayerGeometry(flower)).toEqual(generated);
  });

  it('normalise les rotations et conserve la géométrie périodique', () => {
    expect(normalizeRotation(-45)).toBe(315);
    expect(normalizeRotation(765)).toBe(45);

    const flower = createDefaultLayer('flower');
    if (flower.kind !== 'flower') throw new Error('Fleur attendue.');
    const negative = generateLayerGeometry({ ...flower, rotationDeg: -45 });
    const canonical = generateLayerGeometry({ ...flower, rotationDeg: 315 });
    const negativePath = negative.primitives[0];
    const canonicalPath = canonical.primitives[0];
    if (negativePath?.kind !== 'path' || canonicalPath?.kind !== 'path') {
      throw new Error('Chemins attendus.');
    }
    negativePath.points.forEach((point, index) => {
      expect(point.x).toBeCloseTo(canonicalPath.points[index]?.x ?? 0, 12);
      expect(point.y).toBeCloseTo(canonicalPath.points[index]?.y ?? 0, 12);
    });
  });

  it('centre le disque et le centroïde des cercles de l’anneau', () => {
    const disk = createDefaultLayer('disk');
    const diskPrimitive = generateLayerGeometry(disk).primitives[0];
    expect(diskPrimitive).toEqual({
      kind: 'circle',
      center: { x: 0, y: 0 },
      radius: 0.22,
    });

    const ring = createDefaultLayer('circle-ring');
    if (ring.kind !== 'circle-ring') throw new Error('Anneau attendu.');
    const circles = generateLayerGeometry(ring).primitives;
    expect(circles).toHaveLength(ring.circleCount);
    const centers = circles.map((primitive) => {
      if (primitive.kind !== 'circle') throw new Error('Cercle attendu.');
      return primitive.center;
    });
    expect(
      centers.reduce((sum, point) => sum + point.x, 0) / centers.length,
    ).toBeCloseTo(0, 12);
    expect(
      centers.reduce((sum, point) => sum + point.y, 0) / centers.length,
    ).toBeCloseTo(0, 12);
  });

  it('produit les fixtures JSON complètes de recipe-v1', () => {
    expect(generateProject('abc')).toEqual(recipeGolden.abc);
    expect(generateProject('référence-一')).toEqual(
      recipeGolden['référence-一'],
    );
  });

  it('canonise Unicode et distingue des graines différentes', () => {
    expect(generateProject('e\u0301')).toEqual(generateProject('é'));
    expect(generateProject('alpha')).not.toEqual(generateProject('beta'));
  });

  it('crée 3 à 8 couches valides avec disque au fond et enveloppes triées', () => {
    for (const seed of ['a', 'b', 'c', 'd', 'e', 'f', 'g']) {
      const project = generateProject(seed);
      expect(validateProject(project)).toEqual([]);
      expect(project.layers.length).toBeGreaterThanOrEqual(3);
      expect(project.layers.length).toBeLessThanOrEqual(8);
      expect(project.layers[0]?.kind).toBe('disk');
      expect(project.layers.filter((layer) => layer.kind === 'disk')).toHaveLength(
        1,
      );

      const envelopes = project.layers.slice(1).map((layer) =>
        layer.kind === 'flower'
          ? layer.outerRadius
          : layer.kind === 'circle-ring'
            ? layer.orbitRadius + layer.circleRadius
            : 0,
      );
      expect(envelopes).toEqual([...envelopes].sort((a, b) => b - a));
      expect(Math.min(...envelopes)).toBeGreaterThanOrEqual(0.18);
      expect(Math.min(...envelopes)).toBeLessThanOrEqual(0.2);
      expect(Math.max(...envelopes)).toBeGreaterThanOrEqual(0.88);
      expect(Math.max(...envelopes)).toBeLessThanOrEqual(0.9);
    }
  });
});

describe('cache de géométrie', () => {
  it('ne régénère rien pour le style et une seule couche pour la géométrie', () => {
    let generationCount = 0;
    const cache = new GeometryCache({
      maxEntries: 32,
      generate: (layer) => {
        generationCount += 1;
        return generateLayerGeometry(layer);
      },
    });
    const project = createExampleProject();
    createScene(project, cache);
    expect(generationCount).toBe(3);

    const styleChanged: MandalaProject = {
      ...project,
      layers: project.layers.map((layer, index) =>
        index === 1
          ? {
              ...layer,
              style: { ...layer.style, fill: '#ffffff' },
            }
          : layer,
      ),
    };
    createScene(styleChanged, cache);
    expect(generationCount).toBe(3);

    const geometryChanged: MandalaProject = {
      ...styleChanged,
      layers: styleChanged.layers.map((layer) =>
        layer.kind === 'flower'
          ? { ...layer, outerRadius: layer.outerRadius - 0.01 }
          : layer,
      ),
    };
    createScene(geometryChanged, cache);
    expect(generationCount).toBe(4);

    const diskRotationChanged: MandalaProject = {
      ...geometryChanged,
      layers: geometryChanged.layers.map((layer) =>
        layer.kind === 'disk' ? { ...layer, rotationDeg: 90 } : layer,
      ),
    };
    createScene(diskRotationChanged, cache);
    expect(generationCount).toBe(4);
  });

  it('partage les primitives par signature et borne strictement sa taille', () => {
    const cache = new GeometryCache({ maxEntries: 2 });
    const flower = createDefaultLayer('flower', 'layer-1');
    const sameFlower = { ...flower, id: 'layer-2', name: 'Copie' };
    expect(cache.get(flower)).toBe(cache.get(sameFlower));

    cache.get(createDefaultLayer('disk', 'layer-3'));
    cache.get(createDefaultLayer('circle-ring', 'layer-4'));
    expect(cache.size).toBe(2);
  });
});

describe('hit-test de la scène', () => {
  it('ne sélectionne pas une fleur quand le pointeur est dans le vide', () => {
    const flower = createDefaultLayer('flower', 'layer-1');
    const project: MandalaProject = {
      ...createEmptyProject(),
      nextLayerNumber: 2,
      layers: [flower],
    };
    const scene = createScene(project, new GeometryCache());

    expect(hitTestLayer(scene, { x: 2, y: 2 }, 0.035)).toBeNull();
    expect(hitTestLayer(scene, { x: 0, y: 0 }, 0.01)).toBe('layer-1');
  });

  it('distingue le remplissage du contour d’un disque', () => {
    const disk = createDefaultLayer('disk', 'layer-1');
    if (disk.kind !== 'disk') throw new Error('Disque attendu.');
    const strokeOnly = {
      ...disk,
      style: { ...disk.style, fill: null },
    };
    const project: MandalaProject = {
      ...createEmptyProject(),
      nextLayerNumber: 2,
      layers: [strokeOnly],
    };
    const scene = createScene(project, new GeometryCache());

    expect(hitTestLayer(scene, { x: 0, y: 0 }, 0.01)).toBeNull();
    expect(hitTestLayer(scene, { x: disk.radius, y: 0 }, 0.01)).toBe(
      'layer-1',
    );
  });

  it('sélectionne la couche visible supérieure sous le pointeur', () => {
    const back = createDefaultLayer('disk', 'layer-1');
    const front = {
      ...createDefaultLayer('disk', 'layer-2'),
      style: {
        ...createDefaultLayer('disk').style,
        fill: '#ffffff',
      },
    };
    const project: MandalaProject = {
      ...createEmptyProject(),
      nextLayerNumber: 3,
      layers: [back, front],
    };

    expect(hitTestLayer(createScene(project), { x: 0, y: 0 })).toBe(
      'layer-2',
    );
  });
});

describe('gardes et diagnostics du moteur', () => {
  it('refuse les variantes et versions inconnues', () => {
    expect(() => createDefaultLayer('star' as never)).toThrow(
      'Type de couche inconnu',
    );
    expect(() =>
      generateLayerGeometry({ kind: 'star' } as never),
    ).toThrow('Type de couche inconnu : star');
    expect(() => generateProject('version', 2 as never)).toThrow(
      'Version de générateur non prise en charge',
    );
  });

  it('refuse les entrées non finies ou non textuelles', () => {
    expect(() => normalizeRotation(Number.NaN)).toThrow(
      'La rotation doit être un nombre fini',
    );
    expect(() => deserializeProject(null as never)).toThrow(
      'Le contenu du projet doit être du texte',
    );
  });

  it('vide explicitement le cache géométrique', () => {
    const cache = new GeometryCache();
    cache.get(createDefaultLayer('disk'));
    expect(cache.size).toBe(1);
    cache.clear();
    expect(cache.size).toBe(0);
  });

  it('décrit correctement une scène vide puis une couche unique', () => {
    expect(describeProject(createEmptyProject())).toContain(
      '0 couches visibles : aucune',
    );

    const project = {
      ...createEmptyProject(),
      nextLayerNumber: 2,
      layers: [createDefaultLayer('disk')],
    };
    expect(describeProject(project)).toContain(
      '1 couche visible : Disque (disk)',
    );
  });
});
