import type { MandalaLayer } from '../domain';
import type { EditorState } from './editorReducer';

export const selectProject = (state: EditorState) => state.history.present;

export function selectSelectedLayer(state: EditorState): MandalaLayer | null {
  return (
    state.history.present.layers.find(
      (layer) => layer.id === state.selectedLayerId,
    ) ?? null
  );
}

export const selectCanUndo = (state: EditorState) =>
  state.history.past.length > 0;

export const selectCanRedo = (state: EditorState) =>
  state.history.future.length > 0;

export const selectVisibleCount = (state: EditorState) =>
  state.history.present.layers.filter((layer) => layer.visible).length;
