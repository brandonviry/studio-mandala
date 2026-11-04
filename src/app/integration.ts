import type { MandalaProject } from '../domain';

export type ExportResolution = 2048 | 4096;

export type GatewayResult<T = undefined> =
  | { status: 'success'; value?: T; path?: string }
  | { status: 'cancelled' };

export interface EditorGateway {
  open(): Promise<GatewayResult<MandalaProject>>;
  save(
    project: MandalaProject,
    options?: { saveAs?: boolean },
  ): Promise<GatewayResult>;
  exportPng(
    project: MandalaProject,
    resolution: ExportResolution,
  ): Promise<GatewayResult>;
  clearCurrentProjectPath?(): void;
}

export type GatewayEventName =
  | 'mandala:request-open'
  | 'mandala:request-save'
  | 'mandala:request-export';

export interface GatewayEventDetail<T> {
  payload?: unknown;
  resolve: (result: GatewayResult<T>) => void;
  reject: (error: unknown) => void;
}

export function requestGatewayEvent<T>(
  name: GatewayEventName,
  payload?: unknown,
): Promise<GatewayResult<T>> {
  return new Promise((resolve, reject) => {
    window.dispatchEvent(
      new CustomEvent<GatewayEventDetail<T>>(name, {
        detail: { payload, resolve, reject },
      }),
    );
  });
}
