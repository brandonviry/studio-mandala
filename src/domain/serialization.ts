import type { MandalaProject } from './types';
import { assertValidProject } from './validation';

export function serializeProject(project: MandalaProject): string {
  assertValidProject(project);
  return JSON.stringify(project, null, 2);
}

export function deserializeProject(text: string): MandalaProject {
  if (typeof text !== 'string') {
    throw new TypeError('Le contenu du projet doit être du texte.');
  }

  const value: unknown = JSON.parse(text);
  assertValidProject(value);

  // La validation refuse les clés inconnues : le clone ne transporte donc
  // que le schéma sérialisable V1, jamais une référence fournie par l’appelant.
  return structuredClone(value);
}
