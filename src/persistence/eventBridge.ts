import type {
  ExportResolution,
  GatewayEventDetail,
} from '../app/integration';
import type { MandalaProject } from '../domain';
import {
  createProjectDesktopGateway,
  type ProjectDesktopGateway,
} from './editorGateway';

interface SavePayload {
  project: MandalaProject;
  saveAs?: boolean;
}

interface ExportPayload {
  project: MandalaProject;
  resolution: ExportResolution;
}

function isProject(value: unknown): value is MandalaProject {
  return (
    typeof value === 'object' &&
    value !== null &&
    'schemaVersion' in value &&
    'layers' in value
  );
}

function asSavePayload(value: unknown): SavePayload {
  if (isProject(value)) return { project: value };
  if (
    typeof value === 'object' &&
    value !== null &&
    'project' in value &&
    isProject(value.project)
  ) {
    return value as SavePayload;
  }
  throw new TypeError('La requête de sauvegarde ne contient aucun projet.');
}

function asExportPayload(value: unknown): ExportPayload {
  if (
    typeof value === 'object' &&
    value !== null &&
    'project' in value &&
    isProject(value.project) &&
    'resolution' in value &&
    (value.resolution === 2048 || value.resolution === 4096)
  ) {
    return value as ExportPayload;
  }
  throw new TypeError('La requête d’export PNG est invalide.');
}

export function installPersistenceEventBridge(
  gateway: ProjectDesktopGateway = createProjectDesktopGateway(),
): () => void {
  const onOpen = (event: Event) => {
    const detail = (event as CustomEvent<GatewayEventDetail<MandalaProject>>)
      .detail;
    gateway.open().then(detail.resolve).catch(detail.reject);
  };
  const onSave = (event: Event) => {
    const detail = (event as CustomEvent<GatewayEventDetail<undefined>>).detail;
    try {
      const payload = asSavePayload(detail.payload);
      gateway
        .save(payload.project, { saveAs: payload.saveAs ?? false })
        .then(detail.resolve)
        .catch(detail.reject);
    } catch (error) {
      detail.reject(error);
    }
  };
  const onExport = (event: Event) => {
    const detail = (event as CustomEvent<GatewayEventDetail<undefined>>).detail;
    try {
      const payload = asExportPayload(detail.payload);
      gateway
        .exportPng(payload.project, payload.resolution)
        .then(detail.resolve)
        .catch(detail.reject);
    } catch (error) {
      detail.reject(error);
    }
  };

  window.addEventListener('mandala:request-open', onOpen);
  window.addEventListener('mandala:request-save', onSave);
  window.addEventListener('mandala:request-export', onExport);

  return () => {
    window.removeEventListener('mandala:request-open', onOpen);
    window.removeEventListener('mandala:request-save', onSave);
    window.removeEventListener('mandala:request-export', onExport);
  };
}
