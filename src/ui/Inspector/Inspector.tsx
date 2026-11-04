import { useEffect, useId, useMemo, useState } from 'react';
import type { MandalaLayer, MandalaProject } from '../../domain';
import { Icon } from '../Icon';

interface NumericFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  scale?: number;
  disabled?: boolean;
  testId: string;
  onBegin(): void;
  onChange(value: number): void;
  onEnd(): void;
  onValidityChange(fieldId: string, valid: boolean): void;
}

function decimalPlaces(value: number): number {
  const text = String(value);
  return text.includes('.') ? text.split('.')[1]?.length ?? 0 : 0;
}

function NumericField({
  label,
  value,
  min,
  max,
  step,
  unit,
  scale = 1,
  disabled,
  testId,
  onBegin,
  onChange,
  onEnd,
  onValidityChange,
}: NumericFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const places = decimalPlaces(step * scale);
  const displayed = Number((value * scale).toFixed(Math.min(4, places + 1)));
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const minDisplayed = min * scale;
  const maxDisplayed = max * scale;
  const stepDisplayed = step * scale;
  const activeDraft = draft ?? String(displayed);

  useEffect(
    () => () => {
      onValidityChange(testId, true);
    },
    [onValidityChange, testId],
  );

  const validateDraft = (candidate: string): string | null => {
    const parsed = Number(candidate.replace(',', '.'));
    return !Number.isFinite(parsed) ||
      parsed < minDisplayed ||
      parsed > maxDisplayed
      ? `Saisissez une valeur entre ${minDisplayed} et ${maxDisplayed}${unit}.`
      : null;
  };

  const commitDraft = () => {
    const parsed = Number(activeDraft.replace(',', '.'));
    const validationError = validateDraft(activeDraft);
    if (validationError) {
      setError(validationError);
      onValidityChange(testId, false);
      return;
    }
    setError(null);
    onValidityChange(testId, true);
    onChange(parsed / scale);
    setDraft(null);
  };

  return (
    <div className={`numeric-field ${error ? 'field--invalid' : ''}`}>
      <div className="numeric-field__label">
        <label htmlFor={`${id}-range`}>{label}</label>
        <span aria-hidden="true">
          {displayed}
          {unit}
        </span>
      </div>
      <div className="numeric-field__controls">
        <input
          aria-valuetext={`${displayed} ${unit || ''}`.trim()}
          data-testid={`${testId}-range`}
          disabled={disabled}
          id={`${id}-range`}
          max={maxDisplayed}
          min={minDisplayed}
          onChange={(event) => {
            setDraft(null);
            setError(null);
            onValidityChange(testId, true);
            onChange(Number(event.target.value) / scale);
          }}
          onKeyDown={(event) => {
            if (event.key.startsWith('Arrow')) onBegin();
          }}
          onKeyUp={(event) => {
            if (event.key.startsWith('Arrow')) onEnd();
          }}
          onPointerDown={onBegin}
          onPointerUp={onEnd}
          step={stepDisplayed}
          type="range"
          value={displayed}
        />
        <div className="number-box">
          <input
            aria-describedby={error ? errorId : undefined}
            aria-invalid={error ? 'true' : undefined}
            aria-label={`${label}, saisie précise`}
            data-testid={`${testId}-input`}
            disabled={disabled}
            inputMode="decimal"
            max={maxDisplayed}
            min={minDisplayed}
            onBlur={commitDraft}
            onChange={(event) => {
              const nextDraft = event.target.value;
              const validationError = validateDraft(nextDraft);
              setDraft(nextDraft);
              setError(validationError);
              onValidityChange(testId, validationError === null);
            }}
            onFocus={() => {
              if (draft === null) setDraft(String(displayed));
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                commitDraft();
                event.currentTarget.blur();
              }
            }}
            step={stepDisplayed}
            type="number"
            value={activeDraft}
          />
          <span>{unit}</span>
        </div>
      </div>
      {error ? (
        <p className="field-error" id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

interface ColorFieldProps {
  label: string;
  value: string | null;
  fallback: string;
  canDisable: boolean;
  disabled?: boolean;
  testId: string;
  onChange(value: string | null): void;
}

function ColorField({
  label,
  value,
  fallback,
  canDisable,
  disabled,
  testId,
  onChange,
}: ColorFieldProps) {
  const id = useId();
  return (
    <div className="color-field">
      <label htmlFor={id}>{label}</label>
      <div className="color-field__controls">
        <input
          aria-label={`Couleur de ${label.toLocaleLowerCase('fr')}`}
          data-testid={`${testId}-color`}
          disabled={disabled || value === null}
          id={id}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          type="color"
          value={value ?? fallback}
        />
        <code>{value ?? 'Aucun'}</code>
        <button
          aria-pressed={value !== null}
          className="switch-button"
          data-testid={`${testId}-toggle`}
          disabled={disabled || (!canDisable && value !== null)}
          onClick={() => onChange(value === null ? fallback : null)}
          type="button"
        >
          {value === null ? 'Activer' : 'Retirer'}
        </button>
      </div>
    </div>
  );
}

interface InspectorProps {
  project: MandalaProject;
  layer: MandalaLayer | null;
  drawerOpen: boolean;
  guides: boolean;
  onCloseDrawer(): void;
  onProjectPatch(patch: Partial<MandalaProject>): void;
  onLayerPatch(id: string, patch: Record<string, unknown>): void;
  onVisibility(id: string, visible: boolean): void;
  onLock(id: string, locked: boolean): void;
  onBeginTransaction(): void;
  onEndTransaction(): void;
  onDraftValidityChange(fieldId: string, valid: boolean): void;
}

const layerTypeLabel = {
  flower: 'Fleur paramétrique',
  disk: 'Disque',
  'circle-ring': 'Anneau de cercles',
} as const;

export function Inspector({
  project,
  layer,
  drawerOpen,
  guides,
  onCloseDrawer,
  onProjectPatch,
  onLayerPatch,
  onVisibility,
  onLock,
  onBeginTransaction,
  onEndTransaction,
  onDraftValidityChange,
}: InspectorProps) {
  const commonNumeric = useMemo(
    () => ({
      onBegin: onBeginTransaction,
      onEnd: onEndTransaction,
      onValidityChange: onDraftValidityChange,
    }),
    [onBeginTransaction, onDraftValidityChange, onEndTransaction],
  );

  return (
    <aside
      aria-label="Inspecteur de propriétés"
      className={`side-panel inspector ${drawerOpen ? 'side-panel--open' : ''}`}
      data-testid="inspector"
    >
      <header className="side-panel__header">
        <div>
          <p className="eyebrow">{layer ? 'Calque sélectionné' : 'Document'}</p>
          <h2>{layer ? layer.name : 'Composition'}</h2>
        </div>
        <button
          aria-label="Fermer l’inspecteur"
          className="icon-button side-panel__close"
          onClick={onCloseDrawer}
          type="button"
        >
          <Icon name="close" />
        </button>
      </header>

      {layer ? (
        <div className="inspector__content">
          <section className="inspector-section">
            <div className="layer-identity">
              <span>
                <Icon
                  name={
                    layer.kind === 'flower'
                      ? 'flower'
                      : layer.kind === 'disk'
                        ? 'disk'
                        : 'ring'
                  }
                />
              </span>
              <div>
                <small>Type de couche</small>
                <strong>{layerTypeLabel[layer.kind]}</strong>
              </div>
            </div>
            <div className="toggle-pair">
              <button
                aria-pressed={layer.visible}
                className="switch-button"
                onClick={() => onVisibility(layer.id, !layer.visible)}
                type="button"
              >
                <Icon name={layer.visible ? 'eye' : 'eye-off'} />
                {layer.visible ? 'Visible' : 'Masqué'}
              </button>
              <button
                aria-pressed={layer.locked}
                className="switch-button"
                onClick={() => onLock(layer.id, !layer.locked)}
                type="button"
              >
                <Icon name={layer.locked ? 'lock' : 'unlock'} />
                {layer.locked ? 'Verrouillé' : 'Libre'}
              </button>
            </div>
            {layer.locked ? (
              <p className="locked-note" role="status">
                <Icon name="lock" />
                Déverrouillez ce calque pour modifier sa géométrie ou son
                apparence.
              </p>
            ) : null}
          </section>

          <fieldset className="inspector-section" disabled={layer.locked}>
            <legend>Géométrie</legend>
            {layer.kind === 'flower' ? (
              <>
                <NumericField
                  {...commonNumeric}
                  disabled={layer.locked}
                  label="Rayon extérieur"
                  max={1}
                  min={0.02}
                  onChange={(outerRadius) =>
                    onLayerPatch(layer.id, { outerRadius })
                  }
                  scale={100}
                  step={0.01}
                  testId="flower-radius"
                  unit="%"
                  value={layer.outerRadius}
                />
                <NumericField
                  {...commonNumeric}
                  disabled={layer.locked}
                  label="Nombre de pétales"
                  max={64}
                  min={3}
                  onChange={(petalCount) =>
                    onLayerPatch(layer.id, {
                      petalCount: Math.round(petalCount),
                    })
                  }
                  step={1}
                  testId="flower-petals"
                  unit=""
                  value={layer.petalCount}
                />
                <NumericField
                  {...commonNumeric}
                  disabled={layer.locked}
                  label="Profondeur"
                  max={0.95}
                  min={0}
                  onChange={(innerRatio) =>
                    onLayerPatch(layer.id, { innerRatio })
                  }
                  scale={100}
                  step={0.01}
                  testId="flower-depth"
                  unit="%"
                  value={layer.innerRatio}
                />
                <NumericField
                  {...commonNumeric}
                  disabled={layer.locked}
                  label="Rotation"
                  max={359}
                  min={0}
                  onChange={(rotationDeg) =>
                    onLayerPatch(layer.id, { rotationDeg })
                  }
                  step={1}
                  testId="flower-rotation"
                  unit="°"
                  value={layer.rotationDeg}
                />
              </>
            ) : null}
            {layer.kind === 'disk' ? (
              <NumericField
                {...commonNumeric}
                disabled={layer.locked}
                label="Rayon"
                max={1}
                min={0.02}
                onChange={(radius) => onLayerPatch(layer.id, { radius })}
                scale={100}
                step={0.01}
                testId="disk-radius"
                unit="%"
                value={layer.radius}
              />
            ) : null}
            {layer.kind === 'circle-ring' ? (
              <>
                <NumericField
                  {...commonNumeric}
                  disabled={layer.locked}
                  label="Rayon orbital"
                  max={Math.min(0.95, 1 - layer.circleRadius)}
                  min={0.02}
                  onChange={(orbitRadius) =>
                    onLayerPatch(layer.id, { orbitRadius })
                  }
                  scale={100}
                  step={0.01}
                  testId="ring-orbit"
                  unit="%"
                  value={layer.orbitRadius}
                />
                <NumericField
                  {...commonNumeric}
                  disabled={layer.locked}
                  label="Nombre de cercles"
                  max={128}
                  min={3}
                  onChange={(circleCount) =>
                    onLayerPatch(layer.id, {
                      circleCount: Math.round(circleCount),
                    })
                  }
                  step={1}
                  testId="ring-count"
                  unit=""
                  value={layer.circleCount}
                />
                <NumericField
                  {...commonNumeric}
                  disabled={layer.locked}
                  label="Rayon des cercles"
                  max={Math.min(0.25, 1 - layer.orbitRadius)}
                  min={0.005}
                  onChange={(circleRadius) =>
                    onLayerPatch(layer.id, { circleRadius })
                  }
                  scale={100}
                  step={0.005}
                  testId="ring-circle-radius"
                  unit="%"
                  value={layer.circleRadius}
                />
                <NumericField
                  {...commonNumeric}
                  disabled={layer.locked}
                  label="Rotation"
                  max={359}
                  min={0}
                  onChange={(rotationDeg) =>
                    onLayerPatch(layer.id, { rotationDeg })
                  }
                  step={1}
                  testId="ring-rotation"
                  unit="°"
                  value={layer.rotationDeg}
                />
              </>
            ) : null}
          </fieldset>

          <fieldset className="inspector-section" disabled={layer.locked}>
            <legend>Apparence</legend>
            <NumericField
              {...commonNumeric}
              disabled={layer.locked}
              label="Opacité"
              max={1}
              min={0}
              onChange={(opacity) =>
                onLayerPatch(layer.id, {
                  style: { ...layer.style, opacity },
                })
              }
              scale={100}
              step={0.01}
              testId="layer-opacity"
              unit="%"
              value={layer.style.opacity}
            />
            <ColorField
              canDisable={layer.style.stroke !== null}
              disabled={layer.locked}
              fallback="#E9A66F"
              label="Remplissage"
              onChange={(fill) =>
                onLayerPatch(layer.id, {
                  style: { ...layer.style, fill },
                })
              }
              testId="layer-fill"
              value={layer.style.fill}
            />
            <ColorField
              canDisable={layer.style.fill !== null}
              disabled={layer.locked}
              fallback="#24231F"
              label="Contour"
              onChange={(stroke) =>
                onLayerPatch(layer.id, {
                  style: { ...layer.style, stroke },
                })
              }
              testId="layer-stroke"
              value={layer.style.stroke}
            />
            {layer.style.stroke ? (
              <NumericField
                {...commonNumeric}
                disabled={layer.locked}
                label="Épaisseur du contour"
                max={0.05}
                min={0.0005}
                onChange={(strokeWidth) =>
                  onLayerPatch(layer.id, {
                    style: { ...layer.style, strokeWidth },
                  })
                }
                scale={100}
                step={0.0005}
                testId="stroke-width"
                unit="%"
                value={layer.style.strokeWidth}
              />
            ) : null}
          </fieldset>
        </div>
      ) : (
        <div className="inspector__content">
          <section className="inspector-section">
            <label className="text-field" htmlFor="project-title">
              <span>Titre de la composition</span>
              <input
                defaultValue={project.title}
                id="project-title"
                key={project.title}
                maxLength={120}
                onBlur={(event) => {
                  const title = event.currentTarget.value.trim();
                  if (title && title !== project.title) onProjectPatch({ title });
                }}
                type="text"
              />
            </label>
            <label className="text-field" htmlFor="project-seed-inspector">
              <span>Graine active</span>
              <input
                defaultValue={project.seed}
                id="project-seed-inspector"
                key={project.seed}
                maxLength={128}
                onBlur={(event) => {
                  const seed = event.currentTarget.value.normalize('NFC').trim();
                  if (seed && seed !== project.seed) onProjectPatch({ seed });
                }}
                spellCheck={false}
                type="text"
              />
            </label>
          </section>
          <section className="inspector-section">
            <h3>Feuille</h3>
            <div className="color-field">
              <label htmlFor="project-background">Couleur du fond</label>
              <div className="color-field__controls">
                <input
                  aria-label="Couleur de fond de la composition"
                  id="project-background"
                  onChange={(event) =>
                    onProjectPatch({
                      background: event.target.value.toUpperCase(),
                    })
                  }
                  type="color"
                  value={project.background}
                />
                <code>{project.background}</code>
              </div>
            </div>
            <div className="document-fact">
              <span>Guides de construction</span>
              <strong>{guides ? 'Affichés' : 'Masqués'}</strong>
            </div>
            <div className="document-fact">
              <span>Format d’export</span>
              <strong>PNG carré</strong>
            </div>
          </section>
          <section className="inspector-section inspector-section--note">
            <p className="eyebrow">Principe radial</p>
            <h3>Un centre, plusieurs rythmes</h3>
            <p>
              Chaque calque possède sa propre répétition et sa propre rotation,
              mais toutes les formes restent ancrées au même centre.
            </p>
          </section>
        </div>
      )}
    </aside>
  );
}
