import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import type { LayerKind, MandalaLayer, MandalaProject } from '../../domain';
import { Icon, type IconName } from '../Icon';

const kindLabels: Record<LayerKind, string> = {
  flower: 'Fleur paramétrique',
  disk: 'Disque',
  'circle-ring': 'Anneau de cercles',
};

const kindIcons: Record<LayerKind, IconName> = {
  flower: 'flower',
  disk: 'disk',
  'circle-ring': 'ring',
};

interface LayerPanelProps {
  project: MandalaProject;
  selectedLayerId: string | null;
  drawerOpen: boolean;
  renamingId: string | null;
  onCloseDrawer(): void;
  onSelect(id: string): void;
  onAdd(kind: LayerKind): void;
  onDuplicate(id: string): void;
  onVisibility(id: string, visible: boolean): void;
  onLock(id: string, locked: boolean): void;
  onMove(id: string, targetIndex: number): void;
  onRemove(id: string): void;
  onRename(id: string, name: string): void;
  onRenamingChange(id: string | null): void;
}

function LayerThumbnail({ layer }: { layer: MandalaLayer }) {
  return (
    <span
      aria-hidden="true"
      className={`layer-thumbnail layer-thumbnail--${layer.kind}`}
      style={
        {
          '--swatch': layer.style.fill ?? layer.style.stroke ?? '#24231f',
        } as CSSProperties
      }
    >
      <Icon name={kindIcons[layer.kind]} />
    </span>
  );
}

export function LayerPanel({
  project,
  selectedLayerId,
  drawerOpen,
  renamingId,
  onCloseDrawer,
  onSelect,
  onAdd,
  onDuplicate,
  onVisibility,
  onLock,
  onMove,
  onRemove,
  onRename,
  onRenamingChange,
}: LayerPanelProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const renameRef = useRef<HTMLInputElement>(null);
  const displayedLayers = [...project.layers].reverse();

  useEffect(() => {
    if (renamingId) {
      requestAnimationFrame(() => {
        renameRef.current?.focus();
        renameRef.current?.select();
      });
    }
  }, [renamingId]);

  const commitRename = (id: string, rawName: string) => {
    const name = rawName.trim();
    if (name) onRename(id, name.slice(0, 80));
    onRenamingChange(null);
  };

  return (
    <aside
      aria-label="Pile de calques"
      className={`side-panel layer-panel ${drawerOpen ? 'side-panel--open' : ''}`}
      data-testid="layer-panel"
    >
      <header className="side-panel__header">
        <div>
          <p className="eyebrow">Composition</p>
          <h2>
            Calques <span>{project.layers.length}/32</span>
          </h2>
        </div>
        <button
          aria-label="Fermer le panneau des calques"
          className="icon-button side-panel__close"
          onClick={onCloseDrawer}
          type="button"
        >
          <Icon name="close" />
        </button>
      </header>

      <div className="layer-add">
        <button
          aria-expanded={addOpen}
          className="button button--paper button--full"
          data-testid="add-layer"
          disabled={project.layers.length >= 32}
          onClick={() => setAddOpen((open) => !open)}
          type="button"
        >
          <Icon name="add" />
          Ajouter une couche
          <Icon className="button__trailing" name="arrow-down" />
        </button>
        {addOpen ? (
          <div className="layer-add__menu" role="menu">
            {(
              [
                ['flower', 'Une courbe polaire aux pétales réguliers.'],
                ['disk', 'Un aplât circulaire centré.'],
                ['circle-ring', 'Des cercles distribués sur une orbite.'],
              ] as const
            ).map(([kind, description]) => (
              <button
                data-testid={`add-${kind}`}
                key={kind}
                onClick={() => {
                  onAdd(kind);
                  setAddOpen(false);
                }}
                role="menuitem"
                type="button"
              >
                <Icon name={kindIcons[kind]} />
                <span>
                  <strong>{kindLabels[kind]}</strong>
                  <small>{description}</small>
                </span>
              </button>
            ))}
          </div>
        ) : null}
        {project.layers.length >= 32 ? (
          <p className="field-note" role="status">
            La composition a atteint la limite de 32 calques.
          </p>
        ) : null}
      </div>

      {displayedLayers.length ? (
        <ol className="layer-list" data-testid="layer-list">
          {displayedLayers.map((layer) => {
            const canonicalIndex = project.layers.findIndex(
              (candidate) => candidate.id === layer.id,
            );
            const selected = selectedLayerId === layer.id;
            return (
              <li
                className={`layer-row ${selected ? 'layer-row--selected' : ''} ${
                  layer.visible ? '' : 'layer-row--hidden'
                }`}
                data-layer-id={layer.id}
                data-testid={`layer-row-${layer.id}`}
                draggable={!layer.locked}
                key={layer.id}
                onDragEnd={() => setDraggedId(null)}
                onDragOver={(event) => event.preventDefault()}
                onDragStart={(event) => {
                  setDraggedId(layer.id);
                  event.dataTransfer.effectAllowed = 'move';
                  event.dataTransfer.setData('text/plain', layer.id);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const id =
                    draggedId || event.dataTransfer.getData('text/plain');
                  if (id && id !== layer.id) onMove(id, canonicalIndex);
                  setDraggedId(null);
                }}
              >
                <span
                  aria-hidden="true"
                  className="layer-row__handle"
                  title="Faire glisser pour réordonner"
                >
                  ⠿
                </span>
                <LayerThumbnail layer={layer} />
                {renamingId === layer.id ? (
                  <input
                    aria-label={`Renommer ${layer.name}`}
                    className="layer-row__rename"
                    defaultValue={layer.name}
                    maxLength={80}
                    onBlur={(event) =>
                      commitRename(layer.id, event.currentTarget.value)
                    }
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        commitRename(layer.id, event.currentTarget.value);
                      } else if (event.key === 'Escape') {
                        onRenamingChange(null);
                      }
                    }}
                    ref={renameRef}
                  />
                ) : (
                  <button
                    aria-current={selected ? 'true' : undefined}
                    className="layer-row__select"
                    onClick={() => onSelect(layer.id)}
                    onDoubleClick={() => {
                      if (!layer.locked) onRenamingChange(layer.id);
                    }}
                    type="button"
                  >
                    <strong>{layer.name}</strong>
                    <span>{kindLabels[layer.kind]}</span>
                  </button>
                )}
                <div className="layer-row__actions">
                  <button
                    aria-label={`${layer.visible ? 'Masquer' : 'Afficher'} ${layer.name}`}
                    aria-pressed={!layer.visible}
                    className="icon-button icon-button--small"
                    data-testid={`visibility-${layer.id}`}
                    onClick={() => onVisibility(layer.id, !layer.visible)}
                    type="button"
                  >
                    <Icon name={layer.visible ? 'eye' : 'eye-off'} />
                  </button>
                  <button
                    aria-label={`${layer.locked ? 'Déverrouiller' : 'Verrouiller'} ${layer.name}`}
                    aria-pressed={layer.locked}
                    className="icon-button icon-button--small"
                    data-testid={`lock-${layer.id}`}
                    onClick={() => onLock(layer.id, !layer.locked)}
                    type="button"
                  >
                    <Icon name={layer.locked ? 'lock' : 'unlock'} />
                  </button>
                </div>

                {selected ? (
                  <div
                    aria-label={`Actions pour ${layer.name}`}
                    className="layer-row__expanded-actions"
                  >
                    <button
                      aria-label="Descendre vers l’arrière-plan"
                      className="mini-action"
                      disabled={layer.locked || canonicalIndex === 0}
                      onClick={() => onMove(layer.id, canonicalIndex - 1)}
                      title="Descendre · Alt + flèche bas"
                      type="button"
                    >
                      <Icon name="arrow-down" />
                    </button>
                    <button
                      aria-label="Monter vers le premier plan"
                      className="mini-action"
                      disabled={
                        layer.locked ||
                        canonicalIndex === project.layers.length - 1
                      }
                      onClick={() => onMove(layer.id, canonicalIndex + 1)}
                      title="Monter · Alt + flèche haut"
                      type="button"
                    >
                      <Icon name="arrow-up" />
                    </button>
                    <button
                      aria-label={`Dupliquer ${layer.name}`}
                      className="mini-action"
                      disabled={project.layers.length >= 32}
                      onClick={() => onDuplicate(layer.id)}
                      title="Dupliquer · Ctrl/Cmd + D"
                      type="button"
                    >
                      <Icon name="duplicate" />
                    </button>
                    <button
                      aria-label={`Renommer ${layer.name}`}
                      className="mini-action"
                      disabled={layer.locked}
                      onClick={() => onRenamingChange(layer.id)}
                      title="Renommer · F2"
                      type="button"
                    >
                      <Icon name="settings" />
                    </button>
                    <button
                      aria-label={`Supprimer ${layer.name}`}
                      className="mini-action mini-action--danger"
                      disabled={layer.locked}
                      onClick={() => onRemove(layer.id)}
                      title="Supprimer"
                      type="button"
                    >
                      <Icon name="trash" />
                    </button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="panel-empty" data-testid="empty-layers">
          <span className="panel-empty__motif" aria-hidden="true">
            <Icon name="layers" />
          </span>
          <h3>La table est vide</h3>
          <p>
            Superposez une fleur, un disque ou un anneau pour commencer votre
            composition.
          </p>
          <button
            className="button button--accent"
            onClick={() => {
              onAdd('flower');
              setAddOpen(false);
            }}
            type="button"
          >
            <Icon name="flower" />
            Ajouter une fleur
          </button>
        </div>
      )}

      <footer className="layer-panel__footer">
        <span aria-hidden="true">↑ premier plan</span>
        <span aria-hidden="true">arrière-plan ↓</span>
      </footer>
    </aside>
  );
}
