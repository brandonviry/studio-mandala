export interface DesktopFileFilter {
  name: string;
  extensions: readonly string[];
}

export interface OpenTextFileRequest {
  title: string;
  filters: readonly DesktopFileFilter[];
}

export interface SaveFileRequest {
  title: string;
  suggestedName: string;
  suffix: string;
  filters: readonly DesktopFileFilter[];
  path?: string;
}

export interface SaveTextFileRequest extends SaveFileRequest {
  contents: string;
}

export type BinaryFileContents =
  | Uint8Array
  | (() => Promise<Uint8Array>);

export interface SaveBinaryFileRequest extends SaveFileRequest {
  contents: BinaryFileContents;
}

export type OpenTextFileResult =
  | { status: 'success'; path: string; contents: string }
  | { status: 'cancelled' };

export type SaveFileResult =
  | { status: 'success'; path: string }
  | { status: 'cancelled' };

export interface DesktopGateway {
  openTextFile(request: OpenTextFileRequest): Promise<OpenTextFileResult>;
  saveTextFile(request: SaveTextFileRequest): Promise<SaveFileResult>;
  saveBinaryFile(request: SaveBinaryFileRequest): Promise<SaveFileResult>;
}

function copyFilters(filters: readonly DesktopFileFilter[]) {
  return filters.map((filter) => ({
    name: filter.name,
    extensions: [...filter.extensions],
  }));
}

function filenameFromPath(path: string): string {
  return path.split(/[\\/]/).at(-1) || path;
}

function ensureSuffix(path: string, suffix: string): string {
  return path.toLocaleLowerCase().endsWith(suffix.toLocaleLowerCase())
    ? path
    : `${path}${suffix}`;
}

async function resolveBinaryContents(
  contents: BinaryFileContents,
): Promise<Uint8Array> {
  return typeof contents === 'function' ? contents() : contents;
}

function assertBrowserDocument(): Document {
  if (typeof document === 'undefined') {
    throw new Error('Cette opération nécessite un environnement navigateur.');
  }
  return document;
}

function downloadBlob(blob: Blob, filename: string): void {
  const browserDocument = assertBrowserDocument();
  const url = URL.createObjectURL(blob);
  const anchor = browserDocument.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.hidden = true;
  browserDocument.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export class BrowserDesktopGateway implements DesktopGateway {
  async openTextFile(
    request: OpenTextFileRequest,
  ): Promise<OpenTextFileResult> {
    const browserDocument = assertBrowserDocument();
    const input = browserDocument.createElement('input');
    input.type = 'file';
    input.accept = request.filters
      .flatMap((filter) => filter.extensions)
      .map((extension) => `.${extension}`)
      .join(',');

    const file = await new Promise<File | null>((resolve) => {
      let settled = false;
      const finish = (selected: File | null) => {
        if (settled) return;
        settled = true;
        resolve(selected);
      };

      input.addEventListener(
        'change',
        () => finish(input.files?.item(0) ?? null),
        { once: true },
      );
      input.addEventListener('cancel', () => finish(null), { once: true });
      input.click();
    });

    if (!file) return { status: 'cancelled' };

    return {
      status: 'success',
      path: file.name,
      contents: await file.text(),
    };
  }

  async saveTextFile(
    request: SaveTextFileRequest,
  ): Promise<SaveFileResult> {
    const filename = ensureSuffix(
      filenameFromPath(request.path ?? request.suggestedName),
      request.suffix,
    );
    downloadBlob(
      new Blob([request.contents], {
        type: 'application/json;charset=utf-8',
      }),
      filename,
    );
    return { status: 'success', path: `browser-download://${filename}` };
  }

  async saveBinaryFile(
    request: SaveBinaryFileRequest,
  ): Promise<SaveFileResult> {
    const filename = ensureSuffix(
      filenameFromPath(request.path ?? request.suggestedName),
      request.suffix,
    );
    const contents = await resolveBinaryContents(request.contents);
    const copy = new Uint8Array(contents.byteLength);
    copy.set(contents);
    downloadBlob(new Blob([copy.buffer], { type: 'image/png' }), filename);
    return { status: 'success', path: `browser-download://${filename}` };
  }
}

export class TauriDesktopGateway implements DesktopGateway {
  async openTextFile(
    request: OpenTextFileRequest,
  ): Promise<OpenTextFileResult> {
    const [{ open }, { readTextFile }] = await Promise.all([
      import('@tauri-apps/plugin-dialog'),
      import('@tauri-apps/plugin-fs'),
    ]);
    const selection = await open({
      title: request.title,
      multiple: false,
      directory: false,
      filters: copyFilters(request.filters),
    });

    if (selection === null) return { status: 'cancelled' };
    if (Array.isArray(selection)) {
      throw new Error('Le dialogue a retourné plusieurs chemins inattendus.');
    }

    return {
      status: 'success',
      path: selection,
      contents: await readTextFile(selection),
    };
  }

  async saveTextFile(
    request: SaveTextFileRequest,
  ): Promise<SaveFileResult> {
    const path = await this.selectSavePath(request);
    if (!path) return { status: 'cancelled' };
    const { writeTextFile } = await import('@tauri-apps/plugin-fs');
    await writeTextFile(path, request.contents);
    return { status: 'success', path };
  }

  async saveBinaryFile(
    request: SaveBinaryFileRequest,
  ): Promise<SaveFileResult> {
    const path = await this.selectSavePath(request);
    if (!path) return { status: 'cancelled' };
    const contents = await resolveBinaryContents(request.contents);
    const { writeFile } = await import('@tauri-apps/plugin-fs');
    await writeFile(path, contents);
    return { status: 'success', path };
  }

  private async selectSavePath(
    request: SaveFileRequest,
  ): Promise<string | null> {
    if (request.path) return ensureSuffix(request.path, request.suffix);

    const { save } = await import('@tauri-apps/plugin-dialog');
    const selection = await save({
      title: request.title,
      defaultPath: ensureSuffix(request.suggestedName, request.suffix),
      filters: copyFilters(request.filters),
    });
    return selection === null
      ? null
      : ensureSuffix(selection, request.suffix);
  }
}

interface E2eFilePaths {
  project: string;
  png2048: string;
  png4096: string;
}

/**
 * Gateway compilé uniquement dans le profil E2E. Il évite de piloter les
 * dialogues système et borne toutes les écritures au dossier temporaire
 * préparé par le backend de test.
 */
export class E2eDesktopGateway implements DesktopGateway {
  private pathsPromise: Promise<E2eFilePaths> | undefined;

  async openTextFile(): Promise<OpenTextFileResult> {
    const [{ readTextFile }, paths] = await Promise.all([
      import('@tauri-apps/plugin-fs'),
      this.paths(),
    ]);
    return {
      status: 'success',
      path: paths.project,
      contents: await readTextFile(paths.project),
    };
  }

  async saveTextFile(
    request: SaveTextFileRequest,
  ): Promise<SaveFileResult> {
    const paths = await this.paths();
    const path = ensureSuffix(request.path ?? paths.project, request.suffix);
    const { writeTextFile } = await import('@tauri-apps/plugin-fs');
    await writeTextFile(path, request.contents);
    return { status: 'success', path };
  }

  async saveBinaryFile(
    request: SaveBinaryFileRequest,
  ): Promise<SaveFileResult> {
    const paths = await this.paths();
    const path = request.path
      ? ensureSuffix(request.path, request.suffix)
      : request.suggestedName.includes('2048')
        ? paths.png2048
        : paths.png4096;
    const contents = await resolveBinaryContents(request.contents);
    const { writeFile } = await import('@tauri-apps/plugin-fs');
    await writeFile(path, contents);
    return { status: 'success', path };
  }

  private paths(): Promise<E2eFilePaths> {
    this.pathsPromise ??= import('@tauri-apps/api/core').then(({ invoke }) =>
      invoke<E2eFilePaths>('e2e_file_paths'),
    );
    return this.pathsPromise;
  }
}

type MemoryFile = string | Uint8Array;

export class MemoryDesktopGateway implements DesktopGateway {
  readonly files = new Map<string, MemoryFile>();
  private readonly openQueue: Array<string | null> = [];
  private readonly saveQueue: Array<string | null> = [];

  constructor(initialFiles: Readonly<Record<string, MemoryFile>> = {}) {
    for (const [path, contents] of Object.entries(initialFiles)) {
      this.files.set(
        path,
        typeof contents === 'string' ? contents : contents.slice(),
      );
    }
  }

  queueOpen(path: string | null): void {
    this.openQueue.push(path);
  }

  queueSave(path: string | null): void {
    this.saveQueue.push(path);
  }

  getText(path: string): string | undefined {
    const contents = this.files.get(path);
    return typeof contents === 'string' ? contents : undefined;
  }

  getBinary(path: string): Uint8Array | undefined {
    const contents = this.files.get(path);
    return contents instanceof Uint8Array ? contents.slice() : undefined;
  }

  async openTextFile(): Promise<OpenTextFileResult> {
    const path = this.openQueue.shift();
    if (path === undefined || path === null) return { status: 'cancelled' };

    const contents = this.files.get(path);
    if (typeof contents !== 'string') {
      throw new Error(`Le fichier texte mémoire « ${path} » est introuvable.`);
    }
    return { status: 'success', path, contents };
  }

  async saveTextFile(
    request: SaveTextFileRequest,
  ): Promise<SaveFileResult> {
    const path = this.resolveSavePath(request);
    if (!path) return { status: 'cancelled' };
    this.files.set(path, request.contents);
    return { status: 'success', path };
  }

  async saveBinaryFile(
    request: SaveBinaryFileRequest,
  ): Promise<SaveFileResult> {
    const path = this.resolveSavePath(request);
    if (!path) return { status: 'cancelled' };
    const contents = await resolveBinaryContents(request.contents);
    this.files.set(path, contents.slice());
    return { status: 'success', path };
  }

  private resolveSavePath(request: SaveFileRequest): string | null {
    if (request.path) return ensureSuffix(request.path, request.suffix);
    const queued = this.saveQueue.shift();
    if (queued === null) return null;
    return ensureSuffix(queued ?? request.suggestedName, request.suffix);
  }
}

export function isTauriRuntime(): boolean {
  return (
    typeof window !== 'undefined' &&
    '__TAURI_INTERNALS__' in
      (window as unknown as Record<string, unknown>)
  );
}

export function createDesktopGateway(): DesktopGateway {
  if (
    import.meta.env.VITE_MANDALA_E2E === 'true' &&
    isTauriRuntime()
  ) {
    return new E2eDesktopGateway();
  }
  return isTauriRuntime()
    ? new TauriDesktopGateway()
    : new BrowserDesktopGateway();
}
