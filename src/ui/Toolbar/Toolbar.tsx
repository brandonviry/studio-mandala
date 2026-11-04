import { Icon } from '../Icon';

interface ToolbarProps {
  title: string;
  dirty: boolean;
  seed: string;
  canUndo: boolean;
  canRedo: boolean;
  documentValid: boolean;
  guides: boolean;
  onNew(): void;
  onOpen(): void;
  onSave(): void;
  onUndo(): void;
  onRedo(): void;
  onSeedChange(seed: string): void;
  onGenerate(): void;
  onVariant(): void;
  onToggleGuides(): void;
  onExport(): void;
  onHelp(): void;
  onToggleLayers(): void;
  onToggleInspector(): void;
}

export function Toolbar(props: ToolbarProps) {
  return (
    <header className="toolbar" data-testid="toolbar">
      <div className="toolbar__brand">
        <span className="brand-mark" aria-hidden="true">
          C
        </span>
        <div className="toolbar__brand-copy">
          <p>Coloribook · Étude 02</p>
          <strong>
            {props.title}
            {props.dirty ? <span aria-label="modifié"> ·</span> : null}
          </strong>
        </div>
      </div>

      <nav aria-label="Fichier et historique" className="toolbar__cluster">
        <button
          className="tool-button tool-button--mobile-panel"
          data-testid="toggle-layers"
          onClick={props.onToggleLayers}
          type="button"
        >
          <Icon name="layers" />
          <span>Calques</span>
        </button>
        <button
          aria-label="Nouvelle composition (Ctrl ou Cmd + N)"
          className="tool-button tool-button--icon"
          data-testid="new-project"
          onClick={props.onNew}
          title="Nouvelle composition · Ctrl/Cmd + N"
          type="button"
        >
          <Icon name="add" />
        </button>
        <button
          aria-label="Ouvrir un projet (Ctrl ou Cmd + O)"
          className="tool-button tool-button--icon"
          data-testid="open-project"
          onClick={props.onOpen}
          title="Ouvrir · Ctrl/Cmd + O"
          type="button"
        >
          <Icon name="folder" />
        </button>
        <button
          aria-label="Enregistrer (Ctrl ou Cmd + S)"
          className="tool-button tool-button--icon"
          data-testid="save-project"
          disabled={!props.documentValid}
          onClick={props.onSave}
          title={
            props.documentValid
              ? 'Enregistrer · Ctrl/Cmd + S'
              : 'Corrigez la saisie invalide avant d’enregistrer'
          }
          type="button"
        >
          <Icon name="save" />
        </button>
        <span className="toolbar__rule" aria-hidden="true" />
        <button
          aria-label="Annuler"
          className="tool-button tool-button--icon"
          data-testid="undo"
          disabled={!props.canUndo}
          onClick={props.onUndo}
          title="Annuler · Ctrl/Cmd + Z"
          type="button"
        >
          <Icon name="undo" />
        </button>
        <button
          aria-label="Rétablir"
          className="tool-button tool-button--icon"
          data-testid="redo"
          disabled={!props.canRedo}
          onClick={props.onRedo}
          title="Rétablir · Ctrl/Cmd + Maj + Z"
          type="button"
        >
          <Icon name="redo" />
        </button>
      </nav>

      <form
        aria-label="Génération déterministe"
        className="seed-tool"
        onSubmit={(event) => {
          event.preventDefault();
          props.onGenerate();
        }}
      >
        <label htmlFor="seed-input">Graine</label>
        <input
          data-testid="seed-input"
          id="seed-input"
          maxLength={128}
          onChange={(event) => props.onSeedChange(event.target.value)}
          spellCheck={false}
          type="text"
          value={props.seed}
        />
        <button
          className="button button--ink"
          data-testid="generate"
          type="submit"
        >
          <Icon name="generate" />
          Générer
        </button>
        <button
          aria-label="Créer une nouvelle graine et générer"
          className="tool-button tool-button--icon"
          data-testid="new-variant"
          onClick={props.onVariant}
          title="Nouvelle variante"
          type="button"
        >
          <Icon name="spark" />
        </button>
      </form>

      <nav aria-label="Affichage et export" className="toolbar__cluster toolbar__end">
        <button
          aria-pressed={props.guides}
          className="tool-button tool-button--icon toolbar__desktop-action"
          onClick={props.onToggleGuides}
          title="Afficher ou masquer les guides · G"
          type="button"
        >
          <Icon name="guides" />
        </button>
        <button
          aria-label="Aide et raccourcis"
          className="tool-button tool-button--icon toolbar__desktop-action"
          onClick={props.onHelp}
          type="button"
        >
          <Icon name="help" />
        </button>
        <button
          className="button button--accent"
          data-testid="open-export"
          disabled={!props.documentValid}
          onClick={props.onExport}
          title={
            props.documentValid
              ? 'Exporter le mandala'
              : 'Corrigez la saisie invalide avant d’exporter'
          }
          type="button"
        >
          <Icon name="download" />
          Exporter
        </button>
        <button
          className="tool-button tool-button--mobile-panel"
          data-testid="toggle-inspector"
          onClick={props.onToggleInspector}
          type="button"
        >
          <Icon name="settings" />
          <span>Propriétés</span>
        </button>
      </nav>
    </header>
  );
}
