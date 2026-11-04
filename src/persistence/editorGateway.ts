import type {
  EditorGateway,
  ExportResolution,
  GatewayResult,
} from '../app/integration';
import type { MandalaProject } from '../domain';
import {
  createDesktopGateway,
  type DesktopGateway,
} from './desktopGateway';
import { exportProjectPng } from './pngExport';
import { openProjectFile, saveProjectFile } from './projectFiles';

export interface ProjectDesktopGateway extends EditorGateway {
  getCurrentProjectPath(): string | undefined;
  clearCurrentProjectPath(): void;
}

export function createProjectDesktopGateway(
  desktopGateway: DesktopGateway = createDesktopGateway(),
): ProjectDesktopGateway {
  let currentProjectPath: string | undefined;

  return {
    async open(): Promise<GatewayResult<MandalaProject>> {
      const result = await openProjectFile(desktopGateway);
      if (result.status === 'cancelled') return result;
      currentProjectPath = result.path;
      return {
        status: 'success',
        path: result.path,
        value: result.project,
      };
    },

    async save(project, options = {}): Promise<GatewayResult> {
      const saveAs = options.saveAs ?? false;
      const path = saveAs ? undefined : currentProjectPath;
      const result = await saveProjectFile(
        project,
        desktopGateway,
        path ? { path } : {},
      );
      if (result.status === 'success') currentProjectPath = result.path;
      return result;
    },

    async exportPng(
      project: MandalaProject,
      resolution: ExportResolution,
    ): Promise<GatewayResult> {
      return exportProjectPng(project, resolution, desktopGateway);
    },

    getCurrentProjectPath(): string | undefined {
      return currentProjectPath;
    },

    clearCurrentProjectPath(): void {
      currentProjectPath = undefined;
    },
  };
}
