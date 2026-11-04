import type { ExportResolution } from '../app/integration';
import type { MandalaProject } from '../domain';
import { renderMandala } from '../rendering/canvasRenderer';
import { createScene } from '../rendering/scene';
import type { DesktopGateway, SaveFileResult } from './desktopGateway';
import { ProjectFileError } from './projectFiles';

const pngFilters = [{ name: 'Image PNG', extensions: ['png'] }] as const;

function safePngFilename(title: string, resolution: ExportResolution): string {
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
  return `${sanitized || 'mandala'}-${resolution}.png`;
}

function canvasToPng(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Le navigateur n’a pas pu encoder le Canvas en PNG.'));
        return;
      }
      blob
        .arrayBuffer()
        .then((buffer) => resolve(new Uint8Array(buffer)))
        .catch(reject);
    }, 'image/png');
  });
}

export async function renderProjectPng(
  project: MandalaProject,
  resolution: ExportResolution,
): Promise<Uint8Array> {
  if (resolution !== 2048 && resolution !== 4096) {
    throw new RangeError('La résolution PNG doit être 2048 ou 4096 pixels.');
  }
  if (typeof document === 'undefined') {
    throw new Error('L’export PNG doit être exécuté dans le WebView.');
  }

  const canvas = document.createElement('canvas');
  canvas.width = resolution;
  canvas.height = resolution;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Le contexte Canvas 2D est indisponible.');

  try {
    renderMandala(context, createScene(project), {
      guides: false,
    });
    return await canvasToPng(canvas);
  } finally {
    canvas.width = 1;
    canvas.height = 1;
  }
}

export async function exportProjectPng(
  project: MandalaProject,
  resolution: ExportResolution,
  gateway: DesktopGateway,
): Promise<SaveFileResult> {
  try {
    return gateway.saveBinaryFile({
      title: 'Exporter le mandala en PNG',
      suggestedName: safePngFilename(project.title, resolution),
      suffix: '.png',
      filters: pngFilters,
      contents: () => renderProjectPng(project, resolution),
    });
  } catch (error) {
    if (error instanceof ProjectFileError) throw error;
    throw new ProjectFileError(
      'save-failed',
      'Impossible de générer ou d’enregistrer le fichier PNG.',
      { cause: error },
    );
  }
}
