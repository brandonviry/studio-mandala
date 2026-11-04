import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from 'react';
import {
  addLayer,
  assertValidProject,
  createEmptyProject,
  duplicateLayer,
  moveLayer,
  removeLayer,
  setLayerLocked,
  setLayerVisibility,
  updateLayer,
  type LayerKind,
  type MandalaProject,
  type Result,
} from '../domain';
import { generateProject } from '../generation';
import {
  createInitialEditorState,
  editorReducer,
  type DrawerName,
} from '../state/editorReducer';
import {
  selectCanRedo,
  selectCanUndo,
  selectProject,
  selectSelectedLayer,
  selectVisibleCount,
} from '../state/selectors';
import { CanvasStage } from '../ui/CanvasStage/CanvasStage';
import { ExportDialog } from '../ui/ExportDialog/ExportDialog';
import { Icon } from '../ui/Icon';
import { Inspector } from '../ui/Inspector/Inspector';
import { LayerPanel } from '../ui/LayerPanel/LayerPanel';
import { Modal } from '../ui/Modal';
import { StatusBar } from '../ui/StatusBar/StatusBar';
import { Toolbar } from '../ui/Toolbar/Toolbar';
import {
  type EditorShortcutCommands,
  handleEditorShortcut,
} from './shortcuts';
import {
  type EditorGateway,
  type ExportResolution,
  requestGatewayEvent,
} from './integration';

export interface AppProps {
  gateway?: EditorGateway;
  initialProject?: MandalaProject;
}

type ConfirmAction = 'new' | 'open' | null;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function createVariantSeed(): string {
  const values = crypto.getRandomValues(new Uint32Array(2));
  return `atelier-${values[0]?.toString(36)}-${values[1]?.toString(36)}`;
}

export function App({ gateway, initialProject }: AppProps) {
  const [state, dispatch] = useReducer(
    editorReducer,
    initialProject,
    (project) => createInitialEditorState(project),
  );
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [busy, setBusy] = useState<'open' | 'save' | 'export' | null>(null);
  const [invalidDrafts, setInvalidDrafts] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  const project = selectProject(state);
  const selectedLayer = selectSelectedLayer(state);
  const canUndo = selectCanUndo(state);
  const canRedo = selectCanRedo(state);
  const visibleCount = selectVisibleCount(state);
  const seedDraft = state.seedDraft;
  const documentValid = invalidDrafts.size === 0;

  const setDraftValidity = useCallback(
    (fieldId: string, valid: boolean) => {
      setInvalidDrafts((current) => {
        const next = new Set(current);
        if (valid) next.delete(fieldId);
        else next.add(fieldId);
        if (next.size === current.size && next.has(fieldId) === current.has(fieldId)) {
          return current;
        }
        return next;
      });
    },
    [],
  );

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!state.dirty) return;
      event.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [state.dirty]);

  const showError = useCallback((error: unknown) => {
    dispatch({ type: 'SET_ERROR', error: errorMessage(error) });
  }, []);

  const commitResult = useCallback(
    (
      result: Result<MandalaProject>,
      message: string,
      selectId?: string | null,
    ): boolean => {
      if (!result.ok) {
        showError(result.error);
        return false;
      }
      dispatch({ type: 'COMMIT_PROJECT', project: result.value, message });
      if (selectId !== undefined) {
        dispatch({ type: 'SELECT_LAYER', id: selectId });
      }
      return true;
    },
    [showError],
  );

  const add = useCallback(
    (kind: LayerKind) => {
      const selectedIndex = project.layers.findIndex(
        (layer) => layer.id === state.selectedLayerId,
      );
      const insertAt =
        selectedIndex >= 0 ? selectedIndex + 1 : project.layers.length;
      const result = addLayer(project, kind, insertAt);
      const newId = result.ok ? result.value.layers[insertAt]?.id ?? null : null;
      commitResult(result, 'Couche ajoutée.', newId);
    },
    [commitResult, project, state.selectedLayerId],
  );

  const duplicate = useCallback(
    (id = state.selectedLayerId) => {
      if (!id) return;
      const before = new Set(project.layers.map((layer) => layer.id));
      const result = duplicateLayer(project, id);
      const newId = result.ok
        ? result.value.layers.find((layer) => !before.has(layer.id))?.id ?? null
        : null;
      commitResult(result, 'Couche dupliquée.', newId);
    },
    [commitResult, project, state.selectedLayerId],
  );

  const update = useCallback(
    (id: string, patch: Record<string, unknown>) => {
      commitResult(updateLayer(project, id, patch), 'Propriété modifiée.');
    },
    [commitResult, project],
  );

  const visibility = useCallback(
    (id: string, visible: boolean) => {
      const layer = project.layers.find((candidate) => candidate.id === id);
      commitResult(
        setLayerVisibility(project, id, visible),
        `${layer?.name ?? 'Couche'} ${visible ? 'affiché' : 'masqué'}.`,
      );
    },
    [commitResult, project],
  );

  const lock = useCallback(
    (id: string, locked: boolean) => {
      const layer = project.layers.find((candidate) => candidate.id === id);
      commitResult(
        setLayerLocked(project, id, locked),
        `${layer?.name ?? 'Couche'} ${locked ? 'verrouillé' : 'déverrouillé'}.`,
      );
    },
    [commitResult, project],
  );

  const move = useCallback(
    (id: string, targetIndex: number) => {
      const layer = project.layers.find((candidate) => candidate.id === id);
      if (
        commitResult(
          moveLayer(project, id, targetIndex),
          `${layer?.name ?? 'Couche'} déplacé.`,
        )
      ) {
        dispatch({
          type: 'SET_MESSAGE',
          message: `${layer?.name ?? 'Couche'} déplacé dans la pile.`,
        });
      }
    },
    [commitResult, project],
  );

  const remove = useCallback(
    (id = state.selectedLayerId) => {
      if (!id) return;
      const layer = project.layers.find((candidate) => candidate.id === id);
      const index = project.layers.findIndex((candidate) => candidate.id === id);
      const nextSelection =
        project.layers[index - 1]?.id ??
        project.layers[index + 1]?.id ??
        null;
      commitResult(
        removeLayer(project, id),
        `${layer?.name ?? 'Couche'} supprimé.`,
        nextSelection,
      );
    },
    [commitResult, project, state.selectedLayerId],
  );

  const projectPatch = useCallback(
    (patch: Partial<MandalaProject>) => {
      try {
        const candidate = { ...project, ...patch };
        assertValidProject(candidate);
        dispatch({
          type: 'COMMIT_PROJECT',
          project: candidate,
          message: 'Composition mise à jour.',
        });
      } catch (error) {
        showError(error);
      }
    },
    [project, showError],
  );

  const generate = useCallback(
    (seed = seedDraft) => {
      try {
        const normalized = seed.normalize('NFC').trim();
        const generated = generateProject(normalized, 1);
        dispatch({
          type: 'COMMIT_PROJECT',
          project: generated,
          message: `Composition générée depuis « ${normalized} ».`,
        });
        dispatch({
          type: 'SELECT_LAYER',
          id: generated.layers.at(-1)?.id ?? null,
        });
      } catch (error) {
        showError(error);
      }
    },
    [seedDraft, showError],
  );

  const createNew = useCallback(() => {
    gateway?.clearCurrentProjectPath?.();
    const empty = createEmptyProject('atelier');
    dispatch({
      type: 'REPLACE_PROJECT',
      project: empty,
      saved: false,
      message: 'Nouvelle composition vide.',
    });
    setConfirmAction(null);
  }, [gateway]);

  const openProject = useCallback(async () => {
    setConfirmAction(null);
    setBusy('open');
    dispatch({ type: 'SET_ERROR', error: null });
    try {
      const result = gateway
        ? await gateway.open()
        : await requestGatewayEvent<MandalaProject>('mandala:request-open');
      if (result.status === 'success' && result.value) {
        assertValidProject(result.value);
        dispatch({
          type: 'REPLACE_PROJECT',
          project: result.value,
          saved: true,
          message: result.path
            ? `Projet ouvert : ${result.path}`
            : 'Projet ouvert.',
        });
      } else {
        dispatch({ type: 'SET_MESSAGE', message: 'Ouverture annulée.' });
      }
    } catch (error) {
      showError(error);
    } finally {
      setBusy(null);
    }
  }, [gateway, showError]);

  const saveProject = useCallback(async () => {
    if (!documentValid) {
      showError('Corrigez la saisie invalide avant d’enregistrer.');
      return;
    }
    setBusy('save');
    dispatch({ type: 'SET_ERROR', error: null });
    try {
      const result = gateway
        ? await gateway.save(project)
        : await requestGatewayEvent('mandala:request-save', { project });
      if (result.status === 'success') {
        dispatch({
          type: 'MARK_SAVED',
          message: result.path
            ? `Projet enregistré : ${result.path}`
            : 'Projet enregistré.',
        });
      } else {
        dispatch({ type: 'SET_MESSAGE', message: 'Enregistrement annulé.' });
      }
    } catch (error) {
      showError(error);
    } finally {
      setBusy(null);
    }
  }, [documentValid, gateway, project, showError]);

  const exportPng = useCallback(
    async (resolution: ExportResolution) => {
      if (!documentValid) {
        showError('Corrigez la saisie invalide avant d’exporter.');
        return;
      }
      setBusy('export');
      dispatch({ type: 'SET_ERROR', error: null });
      try {
        const result = gateway
          ? await gateway.exportPng(project, resolution)
          : await requestGatewayEvent('mandala:request-export', {
              project,
              resolution,
            });
        if (result.status === 'success') {
          setExportOpen(false);
          dispatch({
            type: 'SET_MESSAGE',
            message: result.path
              ? `PNG ${resolution} × ${resolution} exporté : ${result.path}`
              : `PNG ${resolution} × ${resolution} exporté.`,
          });
        } else {
          dispatch({ type: 'SET_MESSAGE', message: 'Export annulé.' });
        }
      } catch (error) {
        showError(error);
      } finally {
        setBusy(null);
      }
    },
    [documentValid, gateway, project, showError],
  );

  const requestNew = useCallback(() => {
    if (state.dirty) setConfirmAction('new');
    else createNew();
  }, [createNew, state.dirty]);

  const requestOpen = useCallback(() => {
    if (state.dirty) setConfirmAction('open');
    else void openProject();
  }, [openProject, state.dirty]);

  const moveSelected = useCallback(
    (direction: 1 | -1) => {
      const id = state.selectedLayerId;
      if (!id) return;
      const index = project.layers.findIndex((layer) => layer.id === id);
      const target = Math.min(
        project.layers.length - 1,
        Math.max(0, index + direction),
      );
      if (target !== index) move(id, target);
    },
    [move, project.layers, state.selectedLayerId],
  );

  const closeDrawers = useCallback(() => {
    dispatch({ type: 'SET_DRAWER', drawer: null });
  }, []);

  const toggleDrawer = useCallback(
    (drawer: Exclude<DrawerName, null>) => {
      dispatch({
        type: 'SET_DRAWER',
        drawer: state.drawer === drawer ? null : drawer,
      });
    },
    [state.drawer],
  );

  const shortcutCommands: EditorShortcutCommands = useMemo(
    () => ({
      newProject: requestNew,
      open: requestOpen,
      save: () => void saveProject(),
      undo: () => dispatch({ type: 'UNDO' }),
      redo: () => dispatch({ type: 'REDO' }),
      duplicate: () => duplicate(),
      rename: () => {
        if (state.selectedLayerId && !selectedLayer?.locked) {
          setRenamingId(state.selectedLayerId);
        }
      },
      moveUp: () => moveSelected(1),
      moveDown: () => moveSelected(-1),
      remove: () => remove(),
      fit: () => dispatch({ type: 'RESET_VIEW' }),
      actualSize: () => dispatch({ type: 'SET_ZOOM', zoom: 1 }),
      toggleGuides: () => dispatch({ type: 'TOGGLE_GUIDES' }),
      escape: () => {
        setExportOpen(false);
        setHelpOpen(false);
        setConfirmAction(null);
        setRenamingId(null);
        dispatch({ type: 'SELECT_LAYER', id: null });
        closeDrawers();
      },
    }),
    [
      closeDrawers,
      duplicate,
      moveSelected,
      remove,
      requestNew,
      requestOpen,
      saveProject,
      selectedLayer?.locked,
      state.selectedLayerId,
    ],
  );

  useEffect(() => {
    const listener = (event: KeyboardEvent) =>
      handleEditorShortcut(event, shortcutCommands);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [shortcutCommands]);

  const showAll = useCallback(() => {
    try {
      const candidate = {
        ...project,
        layers: project.layers.map((layer) => ({ ...layer, visible: true })),
      };
      assertValidProject(candidate);
      dispatch({
        type: 'COMMIT_PROJECT',
        project: candidate,
        message: 'Tous les calques sont affichés.',
      });
    } catch (error) {
      showError(error);
    }
  }, [project, showError]);

  const reportRenderTime = useCallback((duration: number) => {
    dispatch({ type: 'SET_RENDER_TIME', duration });
  }, []);

  return (
    <div className="app-shell" data-testid="app-shell">
      <Toolbar
        canRedo={canRedo}
        canUndo={canUndo}
        documentValid={documentValid}
        dirty={state.dirty}
        guides={state.viewport.guides}
        onExport={() => setExportOpen(true)}
        onGenerate={() => generate()}
        onHelp={() => setHelpOpen(true)}
        onNew={requestNew}
        onOpen={requestOpen}
        onRedo={() => dispatch({ type: 'REDO' })}
        onSave={() => void saveProject()}
        onSeedChange={(seed) =>
          dispatch({ type: 'SET_SEED_DRAFT', seed })
        }
        onToggleGuides={() => dispatch({ type: 'TOGGLE_GUIDES' })}
        onToggleInspector={() => toggleDrawer('inspector')}
        onToggleLayers={() => toggleDrawer('layers')}
        onUndo={() => dispatch({ type: 'UNDO' })}
        onVariant={() => {
          const seed = createVariantSeed();
          generate(seed);
        }}
        seed={seedDraft}
        title={project.title}
      />

      <div className="editor-workspace">
        <LayerPanel
          drawerOpen={state.drawer === 'layers'}
          onAdd={add}
          onCloseDrawer={closeDrawers}
          onDuplicate={duplicate}
          onLock={lock}
          onMove={move}
          onRemove={remove}
          onRename={(id, name) => update(id, { name })}
          onRenamingChange={setRenamingId}
          onSelect={(id) => dispatch({ type: 'SELECT_LAYER', id })}
          onVisibility={visibility}
          project={project}
          renamingId={renamingId}
          selectedLayerId={state.selectedLayerId}
        />

        <CanvasStage
          onAdd={add}
          onFit={() => dispatch({ type: 'RESET_VIEW' })}
          onPan={(x, y) => dispatch({ type: 'PAN_BY', x, y })}
          onRender={reportRenderTime}
          onSelect={(id) => dispatch({ type: 'SELECT_LAYER', id })}
          onToggleGuides={() => dispatch({ type: 'TOGGLE_GUIDES' })}
          onZoom={(zoom) => dispatch({ type: 'SET_ZOOM', zoom })}
          project={project}
          selectedLayerId={state.selectedLayerId}
          viewport={state.viewport}
        />

        <Inspector
          drawerOpen={state.drawer === 'inspector'}
          guides={state.viewport.guides}
          layer={selectedLayer}
          onBeginTransaction={() => dispatch({ type: 'BEGIN_TRANSACTION' })}
          onCloseDrawer={closeDrawers}
          onEndTransaction={() => dispatch({ type: 'END_TRANSACTION' })}
          onDraftValidityChange={setDraftValidity}
          onLayerPatch={update}
          onLock={lock}
          onProjectPatch={projectPatch}
          onVisibility={visibility}
          project={project}
        />

        {state.drawer ? (
          <button
            aria-label="Fermer le panneau"
            className="drawer-scrim"
            onClick={closeDrawers}
            type="button"
          />
        ) : null}

        {project.layers.length > 0 && visibleCount === 0 ? (
          <button
            className="show-all-action"
            data-testid="show-all-layers"
            onClick={showAll}
            type="button"
          >
            <Icon name="eye" />
            Tout afficher
          </button>
        ) : null}
      </div>

      <StatusBar
        dirty={state.dirty}
        error={
          state.error ??
          (documentValid
            ? null
            : 'Une saisie est invalide. Le dernier rendu valide est conservé.')
        }
        message={
          busy === 'open'
            ? 'Ouverture du projet…'
            : busy === 'save'
              ? 'Enregistrement du projet…'
              : busy === 'export'
                ? 'Création du PNG…'
                : state.message
        }
        renderMs={state.lastRenderMs}
        totalLayers={project.layers.length}
        visibleLayers={visibleCount}
        zoom={state.viewport.zoom}
      />

      <ExportDialog
        busy={busy === 'export'}
        documentValid={documentValid}
        onClose={() => {
          if (!busy) setExportOpen(false);
        }}
        onExport={(resolution) => void exportPng(resolution)}
        open={exportOpen}
        project={project}
      />

      <Modal
        eyebrow="Composition modifiée"
        footer={
          <>
            <button
              className="button button--paper"
              onClick={() => setConfirmAction(null)}
              type="button"
            >
              Revenir à l’atelier
            </button>
            <button
              className="button button--danger"
              data-testid="confirm-discard"
              onClick={() => {
                if (confirmAction === 'new') createNew();
                else if (confirmAction === 'open') void openProject();
              }}
              type="button"
            >
              Continuer sans enregistrer
            </button>
          </>
        }
        onClose={() => setConfirmAction(null)}
        open={confirmAction !== null}
        testId="unsaved-dialog"
        title={
          confirmAction === 'open'
            ? 'Ouvrir un autre projet ?'
            : 'Créer une nouvelle composition ?'
        }
      >
        <p>
          Les modifications apportées à « {project.title} » ne sont pas encore
          enregistrées. Cette action remplacera la composition active.
        </p>
      </Modal>

      <Modal
        eyebrow="Aide-mémoire"
        footer={
          <button
            className="button button--accent"
            onClick={() => setHelpOpen(false)}
            type="button"
          >
            Retour à l’atelier
          </button>
        }
        onClose={() => setHelpOpen(false)}
        open={helpOpen}
        testId="shortcuts-dialog"
        title="Raccourcis de l’atelier"
      >
        <dl className="shortcut-list">
          <div><dt>Ctrl/Cmd + Z</dt><dd>Annuler</dd></div>
          <div><dt>Ctrl/Cmd + Maj + Z</dt><dd>Rétablir</dd></div>
          <div><dt>Ctrl/Cmd + D</dt><dd>Dupliquer le calque</dd></div>
          <div><dt>F2</dt><dd>Renommer le calque</dd></div>
          <div><dt>Alt + ↑ / ↓</dt><dd>Réordonner le calque</dd></div>
          <div><dt>Suppr</dt><dd>Supprimer le calque</dd></div>
          <div><dt>0 / 1</dt><dd>Ajuster / zoom 100 %</dd></div>
          <div><dt>G</dt><dd>Afficher ou masquer les guides</dd></div>
          <div><dt>Espace + glisser</dt><dd>Déplacer la feuille</dd></div>
        </dl>
      </Modal>
    </div>
  );
}
