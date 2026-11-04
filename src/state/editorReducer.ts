import { createExampleProject, type MandalaProject } from '../domain';
import {
  beginTransaction,
  commitProject,
  createHistory,
  endTransaction,
  redoHistory,
  type ProjectHistory,
  undoHistory,
} from './history';

export type DrawerName = 'layers' | 'inspector' | null;

export interface ViewportState {
  zoom: number;
  panX: number;
  panY: number;
  guides: boolean;
}

export interface EditorState {
  history: ProjectHistory;
  seedDraft: string;
  selectedLayerId: string | null;
  viewport: ViewportState;
  dirty: boolean;
  drawer: DrawerName;
  message: string;
  error: string | null;
  lastRenderMs: number | null;
}

export type EditorAction =
  | { type: 'COMMIT_PROJECT'; project: MandalaProject; message?: string }
  | { type: 'REPLACE_PROJECT'; project: MandalaProject; saved?: boolean; message?: string }
  | { type: 'BEGIN_TRANSACTION' }
  | { type: 'END_TRANSACTION'; message?: string }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'SELECT_LAYER'; id: string | null }
  | { type: 'SET_ZOOM'; zoom: number }
  | { type: 'PAN_BY'; x: number; y: number }
  | { type: 'RESET_VIEW' }
  | { type: 'TOGGLE_GUIDES' }
  | { type: 'SET_DRAWER'; drawer: DrawerName }
  | { type: 'SET_SEED_DRAFT'; seed: string }
  | { type: 'MARK_SAVED'; message?: string }
  | { type: 'SET_MESSAGE'; message: string }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'SET_RENDER_TIME'; duration: number };

export function createInitialEditorState(
  project: MandalaProject = createExampleProject(),
): EditorState {
  return {
    history: createHistory(project),
    seedDraft: project.seed,
    selectedLayerId: project.layers.at(-1)?.id ?? null,
    viewport: { zoom: 1, panX: 0, panY: 0, guides: true },
    dirty: false,
    drawer: null,
    message: 'Composition prête.',
    error: null,
    lastRenderMs: null,
  };
}

function existingSelection(
  project: MandalaProject,
  selectedLayerId: string | null,
): string | null {
  return project.layers.some((layer) => layer.id === selectedLayerId)
    ? selectedLayerId
    : (project.layers.at(-1)?.id ?? null);
}

export function editorReducer(
  state: EditorState,
  action: EditorAction,
): EditorState {
  switch (action.type) {
    case 'COMMIT_PROJECT': {
      const history = commitProject(state.history, action.project);
      const seedChanged =
        action.project.seed !== state.history.present.seed;
      return {
        ...state,
        history,
        seedDraft: seedChanged ? action.project.seed : state.seedDraft,
        selectedLayerId: existingSelection(
          history.present,
          state.selectedLayerId,
        ),
        dirty: history !== state.history ? true : state.dirty,
        message: action.message ?? state.message,
        error: null,
      };
    }
    case 'REPLACE_PROJECT':
      return {
        ...state,
        history: createHistory(action.project),
        seedDraft: action.project.seed,
        selectedLayerId: action.project.layers.at(-1)?.id ?? null,
        dirty: !(action.saved ?? true),
        message: action.message ?? 'Composition chargée.',
        error: null,
      };
    case 'BEGIN_TRANSACTION':
      return { ...state, history: beginTransaction(state.history) };
    case 'END_TRANSACTION':
      return {
        ...state,
        history: endTransaction(state.history),
        dirty: state.history.transactionBase ? true : state.dirty,
        message: action.message ?? state.message,
      };
    case 'UNDO': {
      const history = undoHistory(state.history);
      return {
        ...state,
        history,
        seedDraft: history.present.seed,
        selectedLayerId: existingSelection(
          history.present,
          state.selectedLayerId,
        ),
        dirty: history !== state.history ? true : state.dirty,
        message: history !== state.history ? 'Modification annulée.' : state.message,
        error: null,
      };
    }
    case 'REDO': {
      const history = redoHistory(state.history);
      return {
        ...state,
        history,
        seedDraft: history.present.seed,
        selectedLayerId: existingSelection(
          history.present,
          state.selectedLayerId,
        ),
        dirty: history !== state.history ? true : state.dirty,
        message: history !== state.history ? 'Modification rétablie.' : state.message,
        error: null,
      };
    }
    case 'SELECT_LAYER':
      return { ...state, selectedLayerId: action.id, drawer: null };
    case 'SET_ZOOM':
      return {
        ...state,
        viewport: {
          ...state.viewport,
          zoom: Math.min(4, Math.max(0.25, action.zoom)),
        },
      };
    case 'PAN_BY':
      return {
        ...state,
        viewport: {
          ...state.viewport,
          panX: state.viewport.panX + action.x,
          panY: state.viewport.panY + action.y,
        },
      };
    case 'RESET_VIEW':
      return {
        ...state,
        viewport: { ...state.viewport, zoom: 1, panX: 0, panY: 0 },
      };
    case 'TOGGLE_GUIDES':
      return {
        ...state,
        viewport: { ...state.viewport, guides: !state.viewport.guides },
        message: state.viewport.guides
          ? 'Guides masqués.'
          : 'Guides affichés.',
      };
    case 'SET_DRAWER':
      return { ...state, drawer: action.drawer };
    case 'SET_SEED_DRAFT':
      return { ...state, seedDraft: action.seed };
    case 'MARK_SAVED':
      return {
        ...state,
        dirty: false,
        message: action.message ?? 'Composition enregistrée.',
        error: null,
      };
    case 'SET_MESSAGE':
      return { ...state, message: action.message };
    case 'SET_ERROR':
      return { ...state, error: action.error };
    case 'SET_RENDER_TIME':
      return { ...state, lastRenderMs: action.duration };
  }
}
