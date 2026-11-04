import { useState } from 'react';
import type { MandalaProject } from '../../domain';
import type { ExportResolution } from '../../app/integration';
import { Icon } from '../Icon';
import { Modal } from '../Modal';

interface ExportDialogProps {
  open: boolean;
  project: MandalaProject;
  busy: boolean;
  documentValid: boolean;
  onClose(): void;
  onExport(resolution: ExportResolution): void;
}

export function ExportDialog({
  open,
  project,
  busy,
  documentValid,
  onClose,
  onExport,
}: ExportDialogProps) {
  const [resolution, setResolution] = useState<ExportResolution>(4096);
  return (
    <Modal
      eyebrow="Épreuve finale"
      footer={
        <>
          <button
            className="button button--paper"
            disabled={busy}
            onClick={onClose}
            type="button"
          >
            Annuler
          </button>
          <button
            className="button button--accent"
            data-testid="confirm-export"
            disabled={busy || !documentValid}
            onClick={() => onExport(resolution)}
            type="button"
          >
            <Icon name="download" />
            {busy ? 'Création du PNG…' : `Exporter · ${resolution} px`}
          </button>
        </>
      }
      onClose={onClose}
      open={open}
      testId="export-dialog"
      title="Exporter le mandala"
    >
      <div className="export-preview" aria-hidden="true">
        <span>
          <Icon name="flower" />
        </span>
        <small>{project.layers.length} calques</small>
      </div>
      <fieldset className="resolution-options" disabled={busy}>
        <legend>Résolution carrée</legend>
        {([2048, 4096] as const).map((size) => (
          <label key={size}>
            <input
              checked={resolution === size}
              data-testid={`resolution-${size}`}
              name="resolution"
              onChange={() => setResolution(size)}
              type="radio"
            />
            <span>
              <strong>{size} × {size} px</strong>
              <small>
                {size === 2048
                  ? 'Aperçu et partage numérique'
                  : 'Impression haute définition'}
              </small>
            </span>
          </label>
        ))}
      </fieldset>
      <p className="modal-note">
        {documentValid
          ? 'Les guides, la sélection et l’interface ne seront pas inclus dans le fichier PNG.'
          : 'Corrigez la saisie invalide dans l’inspecteur avant d’exporter.'}
      </p>
    </Modal>
  );
}
