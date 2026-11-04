import {
  deserializeProject,
  serializeProject,
  type MandalaProject,
} from '../domain';
import type {
  DesktopGateway,
  OpenTextFileResult,
  SaveFileResult,
} from './desktopGateway';

const projectFilters = [
  { name: 'Projet Studio Mandala', extensions: ['json'] },
] as const;

export type OpenProjectResult =
  | { status: 'success'; path: string; project: MandalaProject }
  | { status: 'cancelled' };

export interface SaveProjectOptions {
  path?: string;
}

export class ProjectFileError extends Error {
  constructor(
    readonly code: 'invalid-project' | 'open-failed' | 'save-failed',
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'ProjectFileError';
  }
}

function safeProjectFilename(title: string): string {
  const withoutControlCharacters = [...title.normalize('NFC')]
    .map((character) =>
      (character.codePointAt(0) ?? 0) < 32 ? '-' : character,
    )
    .join('');
  const sanitized = withoutControlCharacters
    .replaceAll(/[<>:"/\\|?*]/g, '-')
    .replaceAll(/\s+/g, ' ')
    .replaceAll(/[. ]+$/g, '')
    .trim();
  return `${sanitized || 'mandala'}.mandala.json`;
}

export async function openProjectFile(
  gateway: DesktopGateway,
): Promise<OpenProjectResult> {
  let opened: OpenTextFileResult;
  try {
    opened = await gateway.openTextFile({
      title: 'Ouvrir un projet Studio Mandala',
      filters: projectFilters,
    });
  } catch (error) {
    throw new ProjectFileError(
      'open-failed',
      'Impossible de lire le fichier sélectionné.',
      { cause: error },
    );
  }

  if (opened.status === 'cancelled') return opened;

  try {
    return {
      status: 'success',
      path: opened.path,
      project: deserializeProject(opened.contents),
    };
  } catch (error) {
    throw new ProjectFileError(
      'invalid-project',
      'Ce fichier n’est pas un projet Studio Mandala valide.',
      { cause: error },
    );
  }
}

export async function saveProjectFile(
  project: MandalaProject,
  gateway: DesktopGateway,
  options: SaveProjectOptions = {},
): Promise<SaveFileResult> {
  let contents: string;
  try {
    contents = serializeProject(project);
  } catch (error) {
    throw new ProjectFileError(
      'invalid-project',
      'Le projet contient des valeurs invalides et ne peut pas être enregistré.',
      { cause: error },
    );
  }

  try {
    const request = {
      title: 'Enregistrer le projet Studio Mandala',
      suggestedName: safeProjectFilename(project.title),
      suffix: '.mandala.json',
      filters: projectFilters,
      contents,
    };
    return options.path
      ? gateway.saveTextFile({ ...request, path: options.path })
      : gateway.saveTextFile(request);
  } catch (error) {
    throw new ProjectFileError(
      'save-failed',
      'Impossible d’enregistrer le projet à cet emplacement.',
      { cause: error },
    );
  }
}

export function requireOpenedProject(
  result: OpenProjectResult,
): MandalaProject {
  if (result.status === 'success') return result.project;
  throw new ProjectFileError(
    'open-failed',
    'Aucun projet n’a été sélectionné.',
  );
}
