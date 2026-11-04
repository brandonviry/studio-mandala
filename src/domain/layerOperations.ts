import { createDefaultLayer } from './defaults';
import type {
  LayerKind,
  MandalaLayer,
  MandalaProject,
  Result,
} from './types';
import { normalizeRotation, validateProject } from './validation';

const MAX_LAYERS = 32;
const COMMON_UPDATE_KEYS = new Set(['name', 'rotationDeg', 'style']);
const KIND_UPDATE_KEYS: Record<LayerKind, ReadonlySet<string>> = {
  flower: new Set([
    ...COMMON_UPDATE_KEYS,
    'outerRadius',
    'innerRatio',
    'petalCount',
  ]),
  disk: new Set([...COMMON_UPDATE_KEYS, 'radius']),
  'circle-ring': new Set([
    ...COMMON_UPDATE_KEYS,
    'orbitRadius',
    'circleRadius',
    'circleCount',
  ]),
};

function fail(error: string): Result<MandalaProject> {
  return { ok: false, error };
}

function validationError(project: unknown): string | null {
  const issues = validateProject(project);
  return issues.length > 0
    ? issues.map((issue) => `${issue.path}: ${issue.message}`).join('; ')
    : null;
}

function checked(project: MandalaProject): Result<MandalaProject> {
  const error = validationError(project);
  return error ? fail(error) : { ok: true, value: project };
}

function inputError(project: MandalaProject): Result<MandalaProject> | null {
  const error = validationError(project);
  return error ? fail(`Projet source invalide — ${error}`) : null;
}

function unexpectedError(error: unknown): Result<MandalaProject> {
  return fail(error instanceof Error ? error.message : String(error));
}

function isLayerKind(value: unknown): value is LayerKind {
  return value === 'flower' || value === 'disk' || value === 'circle-ring';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function addLayer(
  project: MandalaProject,
  kind: LayerKind,
  index?: number,
): Result<MandalaProject> {
  const invalid = inputError(project);
  if (invalid) return invalid;
  if (!isLayerKind(kind)) return fail('Type de couche inconnu');
  if (project.layers.length >= MAX_LAYERS) {
    return fail('32 couches maximum');
  }

  const targetIndex = index ?? project.layers.length;
  if (!Number.isInteger(targetIndex)) {
    return fail('Position de couche invalide');
  }

  try {
    const layer = createDefaultLayer(
      kind,
      `layer-${project.nextLayerNumber}`,
    );
    const layers = [...project.layers];
    layers.splice(
      Math.max(0, Math.min(targetIndex, layers.length)),
      0,
      layer,
    );
    return checked({
      ...project,
      nextLayerNumber: project.nextLayerNumber + 1,
      layers,
    });
  } catch (error) {
    return unexpectedError(error);
  }
}

export function duplicateLayer(
  project: MandalaProject,
  id: string,
): Result<MandalaProject> {
  const invalid = inputError(project);
  if (invalid) return invalid;

  const index = project.layers.findIndex((layer) => layer.id === id);
  if (index < 0) return fail('Couche introuvable');
  if (project.layers.length >= MAX_LAYERS) {
    return fail('32 couches maximum');
  }

  try {
    const source = project.layers[index];
    if (!source) return fail('Couche introuvable');

    const copy = structuredClone(source) as MandalaLayer;
    copy.id = `layer-${project.nextLayerNumber}`;
    copy.name = `${source.name.slice(0, 74)} copie`;
    copy.locked = false;

    const layers = [...project.layers];
    layers.splice(index + 1, 0, copy);
    return checked({
      ...project,
      nextLayerNumber: project.nextLayerNumber + 1,
      layers,
    });
  } catch (error) {
    return unexpectedError(error);
  }
}

export function updateLayer(
  project: MandalaProject,
  id: string,
  patch: Record<string, unknown>,
): Result<MandalaProject> {
  const invalid = inputError(project);
  if (invalid) return invalid;
  if (!isRecord(patch)) return fail('Modification invalide');

  const index = project.layers.findIndex((layer) => layer.id === id);
  if (index < 0) return fail('Couche introuvable');

  const source = project.layers[index];
  if (!source) return fail('Couche introuvable');
  if (source.locked) return fail('Couche verrouillée');

  const allowedKeys = KIND_UPDATE_KEYS[source.kind];
  const rejectedKey = Object.keys(patch).find((key) => !allowedKeys.has(key));
  if (rejectedKey) {
    return fail(`Propriété non modifiable : ${rejectedKey}`);
  }

  try {
    const candidate = {
      ...source,
      ...structuredClone(patch),
    } as MandalaLayer;
    candidate.rotationDeg = normalizeRotation(candidate.rotationDeg);

    const layers = [...project.layers];
    layers[index] = candidate;
    return checked({ ...project, layers });
  } catch (error) {
    return unexpectedError(error);
  }
}

export function setLayerVisibility(
  project: MandalaProject,
  id: string,
  visible: boolean,
): Result<MandalaProject> {
  if (typeof visible !== 'boolean') return fail('Visibilité invalide');
  return updateSpecial(project, id, { visible });
}

export function setLayerLocked(
  project: MandalaProject,
  id: string,
  locked: boolean,
): Result<MandalaProject> {
  if (typeof locked !== 'boolean') return fail('Verrouillage invalide');
  return updateSpecial(project, id, { locked });
}

function updateSpecial(
  project: MandalaProject,
  id: string,
  patch: { visible: boolean } | { locked: boolean },
): Result<MandalaProject> {
  const invalid = inputError(project);
  if (invalid) return invalid;

  const index = project.layers.findIndex((layer) => layer.id === id);
  if (index < 0) return fail('Couche introuvable');

  const source = project.layers[index];
  if (!source) return fail('Couche introuvable');
  const layers = [...project.layers];
  layers[index] = { ...source, ...patch } as MandalaLayer;
  return checked({ ...project, layers });
}

export function moveLayer(
  project: MandalaProject,
  id: string,
  targetIndex: number,
): Result<MandalaProject> {
  const invalid = inputError(project);
  if (invalid) return invalid;
  if (!Number.isInteger(targetIndex)) return fail('Position de couche invalide');

  const index = project.layers.findIndex((layer) => layer.id === id);
  if (index < 0) return fail('Couche introuvable');
  if (project.layers[index]?.locked) return fail('Couche verrouillée');

  const layers = [...project.layers];
  const [layer] = layers.splice(index, 1);
  if (!layer) return fail('Couche introuvable');
  layers.splice(
    Math.max(0, Math.min(targetIndex, layers.length)),
    0,
    layer,
  );
  return checked({ ...project, layers });
}

export function removeLayer(
  project: MandalaProject,
  id: string,
): Result<MandalaProject> {
  const invalid = inputError(project);
  if (invalid) return invalid;

  const layer = project.layers.find((candidate) => candidate.id === id);
  if (!layer) return fail('Couche introuvable');
  if (layer.locked) return fail('Couche verrouillée');
  return checked({
    ...project,
    layers: project.layers.filter((candidate) => candidate.id !== id),
  });
}
