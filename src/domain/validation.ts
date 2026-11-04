import type {
  LayerStyle,
  MandalaLayer,
  MandalaProject,
  ValidationIssue,
} from './types';

const OPAQUE_HEX_COLOR = /^#[0-9a-f]{6}$/i;
const LAYER_ID = /^layer-([1-9]\d*)$/;
const PROJECT_KEYS = new Set([
  'schemaVersion',
  'generatorVersion',
  'title',
  'seed',
  'background',
  'nextLayerNumber',
  'layers',
]);
const BASE_LAYER_KEYS = [
  'id',
  'name',
  'visible',
  'locked',
  'rotationDeg',
  'style',
  'kind',
] as const;
const STYLE_KEYS = new Set(['stroke', 'strokeWidth', 'fill', 'opacity']);
const LAYER_KEYS = {
  flower: new Set([
    ...BASE_LAYER_KEYS,
    'outerRadius',
    'innerRatio',
    'petalCount',
  ]),
  disk: new Set([...BASE_LAYER_KEYS, 'radius']),
  'circle-ring': new Set([
    ...BASE_LAYER_KEYS,
    'orbitRadius',
    'circleRadius',
    'circleCount',
  ]),
} as const;

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isOpaqueColor(value: unknown): value is string {
  return typeof value === 'string' && OPAQUE_HEX_COLOR.test(value);
}

function addUnexpectedKeyIssues(
  value: UnknownRecord,
  allowedKeys: ReadonlySet<string>,
  path: string,
  issues: ValidationIssue[],
): void {
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      issues.push({
        path: path ? `${path}.${key}` : key,
        message: 'Propriété inconnue',
      });
    }
  }
}

function validateStyle(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): value is LayerStyle {
  if (!isRecord(value)) {
    issues.push({ path, message: 'Style invalide' });
    return false;
  }

  addUnexpectedKeyIssues(value, STYLE_KEYS, path, issues);

  const { fill, opacity, stroke, strokeWidth } = value;
  if (stroke !== null && !isOpaqueColor(stroke)) {
    issues.push({
      path: `${path}.stroke`,
      message: 'Couleur opaque #RRGGBB ou null requise',
    });
  }
  if (fill !== null && !isOpaqueColor(fill)) {
    issues.push({
      path: `${path}.fill`,
      message: 'Couleur opaque #RRGGBB ou null requise',
    });
  }
  if (stroke === null && fill === null) {
    issues.push({
      path,
      message: 'Contour ou remplissage requis',
    });
  }
  if (
    !isFiniteNumber(strokeWidth) ||
    strokeWidth < 0.0005 ||
    strokeWidth > 0.05
  ) {
    issues.push({
      path: `${path}.strokeWidth`,
      message: 'Valeur attendue entre 0.0005 et 0.05',
    });
  }
  if (!isFiniteNumber(opacity) || opacity < 0 || opacity > 1) {
    issues.push({
      path: `${path}.opacity`,
      message: 'Valeur attendue entre 0 et 1',
    });
  }

  return issues.every((issue) => !issue.path.startsWith(path));
}

function validateCommonLayerFields(
  layer: UnknownRecord,
  path: string,
  issues: ValidationIssue[],
): void {
  const idMatch = typeof layer.id === 'string' ? LAYER_ID.exec(layer.id) : null;
  if (!idMatch || !Number.isSafeInteger(Number(idMatch[1]))) {
    issues.push({
      path: `${path}.id`,
      message: 'Identifiant layer-N positif et sûr requis',
    });
  }
  if (
    typeof layer.name !== 'string' ||
    !layer.name.trim() ||
    layer.name.length > 80
  ) {
    issues.push({
      path: `${path}.name`,
      message: 'Nom requis (80 caractères maximum)',
    });
  }
  if (typeof layer.visible !== 'boolean') {
    issues.push({
      path: `${path}.visible`,
      message: 'Booléen requis',
    });
  }
  if (typeof layer.locked !== 'boolean') {
    issues.push({
      path: `${path}.locked`,
      message: 'Booléen requis',
    });
  }
  if (
    !isFiniteNumber(layer.rotationDeg) ||
    layer.rotationDeg < 0 ||
    layer.rotationDeg >= 360
  ) {
    issues.push({
      path: `${path}.rotationDeg`,
      message: 'Rotation attendue dans [0, 360)',
    });
  }
  validateStyle(layer.style, `${path}.style`, issues);
}

function validateLayer(
  value: unknown,
  index: number,
  issues: ValidationIssue[],
): value is MandalaLayer {
  const path = `layers[${index}]`;
  if (!isRecord(value)) {
    issues.push({ path, message: 'Couche invalide' });
    return false;
  }

  const kind = value.kind;
  if (kind !== 'flower' && kind !== 'disk' && kind !== 'circle-ring') {
    issues.push({
      path: `${path}.kind`,
      message: 'Type de couche inconnu',
    });
    return false;
  }

  addUnexpectedKeyIssues(value, LAYER_KEYS[kind], path, issues);
  validateCommonLayerFields(value, path, issues);

  if (kind === 'flower') {
    if (
      !isFiniteNumber(value.outerRadius) ||
      value.outerRadius < 0.02 ||
      value.outerRadius > 1
    ) {
      issues.push({
        path: `${path}.outerRadius`,
        message: 'Rayon attendu entre 0.02 et 1',
      });
    }
    if (
      !isFiniteNumber(value.innerRatio) ||
      value.innerRatio < 0 ||
      value.innerRatio > 0.95
    ) {
      issues.push({
        path: `${path}.innerRatio`,
        message: 'Profondeur attendue entre 0 et 0.95',
      });
    }
    if (
      !Number.isInteger(value.petalCount) ||
      !isFiniteNumber(value.petalCount) ||
      value.petalCount < 3 ||
      value.petalCount > 64
    ) {
      issues.push({
        path: `${path}.petalCount`,
        message: 'Nombre entier de pétales attendu entre 3 et 64',
      });
    }
  } else if (kind === 'disk') {
    if (
      !isFiniteNumber(value.radius) ||
      value.radius < 0.02 ||
      value.radius > 1
    ) {
      issues.push({
        path: `${path}.radius`,
        message: 'Rayon attendu entre 0.02 et 1',
      });
    }
  } else {
    if (
      !isFiniteNumber(value.orbitRadius) ||
      value.orbitRadius < 0.02 ||
      value.orbitRadius > 0.95
    ) {
      issues.push({
        path: `${path}.orbitRadius`,
        message: 'Rayon orbital attendu entre 0.02 et 0.95',
      });
    }
    if (
      !isFiniteNumber(value.circleRadius) ||
      value.circleRadius < 0.005 ||
      value.circleRadius > 0.25
    ) {
      issues.push({
        path: `${path}.circleRadius`,
        message: 'Rayon de cercle attendu entre 0.005 et 0.25',
      });
    }
    if (
      !Number.isInteger(value.circleCount) ||
      !isFiniteNumber(value.circleCount) ||
      value.circleCount < 3 ||
      value.circleCount > 128
    ) {
      issues.push({
        path: `${path}.circleCount`,
        message: 'Nombre entier de cercles attendu entre 3 et 128',
      });
    }
    if (
      isFiniteNumber(value.orbitRadius) &&
      isFiniteNumber(value.circleRadius) &&
      value.orbitRadius + value.circleRadius > 1
    ) {
      issues.push({
        path,
        message: 'L’anneau doit rester dans le rayon normalisé',
      });
    }
  }

  return true;
}

export function canonicalizeSeed(seed: string): string {
  if (typeof seed !== 'string') {
    throw new TypeError('La graine doit être une chaîne.');
  }
  const normalized = seed.normalize('NFC');
  if (!normalized.trim() || normalized.length > 128) {
    throw new RangeError('La graine doit contenir entre 1 et 128 caractères.');
  }
  return normalized;
}

export function validateProject(project: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!isRecord(project)) {
    return [{ path: 'project', message: 'Projet invalide' }];
  }

  addUnexpectedKeyIssues(project, PROJECT_KEYS, '', issues);

  if (project.schemaVersion !== 1) {
    issues.push({
      path: 'schemaVersion',
      message:
        typeof project.schemaVersion === 'number' && project.schemaVersion > 1
          ? 'Version future non prise en charge'
          : 'Version de schéma non prise en charge',
    });
  }
  if (project.generatorVersion !== 1) {
    issues.push({
      path: 'generatorVersion',
      message: 'Version de générateur non prise en charge',
    });
  }
  if (
    typeof project.title !== 'string' ||
    !project.title.trim() ||
    project.title.length > 160
  ) {
    issues.push({
      path: 'title',
      message: 'Titre requis (160 caractères maximum)',
    });
  }

  if (typeof project.seed !== 'string') {
    issues.push({ path: 'seed', message: 'Graine textuelle requise' });
  } else {
    try {
      if (canonicalizeSeed(project.seed) !== project.seed) {
        issues.push({
          path: 'seed',
          message: 'Graine Unicode NFC requise',
        });
      }
    } catch (error) {
      issues.push({
        path: 'seed',
        message: error instanceof Error ? error.message : 'Graine invalide',
      });
    }
  }

  if (!isOpaqueColor(project.background)) {
    issues.push({
      path: 'background',
      message: 'Couleur opaque #RRGGBB requise',
    });
  }

  if (
    !Number.isSafeInteger(project.nextLayerNumber) ||
    typeof project.nextLayerNumber !== 'number' ||
    project.nextLayerNumber < 1
  ) {
    issues.push({
      path: 'nextLayerNumber',
      message: 'Compteur entier positif et sûr requis',
    });
  }

  if (!Array.isArray(project.layers)) {
    issues.push({ path: 'layers', message: 'Tableau de couches requis' });
    return issues;
  }
  if (project.layers.length > 32) {
    issues.push({ path: 'layers', message: '32 couches maximum' });
  }

  const ids = new Set<string>();
  let maxLayerNumber = 0;
  project.layers.forEach((layer, index) => {
    validateLayer(layer, index, issues);
    if (!isRecord(layer) || typeof layer.id !== 'string') return;

    if (ids.has(layer.id)) {
      issues.push({
        path: `layers[${index}].id`,
        message: 'Identifiant dupliqué',
      });
    }
    ids.add(layer.id);

    const match = LAYER_ID.exec(layer.id);
    if (match) {
      const suffix = Number(match[1]);
      if (Number.isSafeInteger(suffix)) {
        maxLayerNumber = Math.max(maxLayerNumber, suffix);
      }
    }
  });

  if (
    typeof project.nextLayerNumber === 'number' &&
    Number.isSafeInteger(project.nextLayerNumber) &&
    project.nextLayerNumber <= maxLayerNumber
  ) {
    issues.push({
      path: 'nextLayerNumber',
      message: 'Le compteur doit dépasser tous les identifiants actifs',
    });
  }

  return issues;
}

export function assertValidProject(
  project: unknown,
): asserts project is MandalaProject {
  const errors = validateProject(project);
  if (errors.length > 0) {
    throw new RangeError(
      errors.map((error) => `${error.path}: ${error.message}`).join('; '),
    );
  }
}

export function normalizeRotation(degrees: number): number {
  if (!Number.isFinite(degrees)) {
    throw new RangeError('La rotation doit être un nombre fini.');
  }
  return ((degrees % 360) + 360) % 360;
}
