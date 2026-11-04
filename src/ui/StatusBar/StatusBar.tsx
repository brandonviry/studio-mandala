interface StatusBarProps {
  zoom: number;
  visibleLayers: number;
  totalLayers: number;
  dirty: boolean;
  renderMs: number | null;
  error: string | null;
  message: string;
}

export function StatusBar({
  zoom,
  visibleLayers,
  totalLayers,
  dirty,
  renderMs,
  error,
  message,
}: StatusBarProps) {
  return (
    <footer className="status-bar" data-testid="status-bar">
      <div
        aria-atomic="true"
        aria-live="polite"
        className={error ? 'status-bar__message status-bar__message--error' : 'status-bar__message'}
        role={error ? 'alert' : 'status'}
      >
        <span aria-hidden="true" className="status-dot" />
        {error ?? message}
      </div>
      <div className="status-bar__facts" aria-label="État du document">
        <span>{visibleLayers}/{totalLayers} calques visibles</span>
        <span>{Math.round(zoom * 100)} %</span>
        <span>{renderMs === null ? 'Rendu —' : `Rendu ${renderMs.toFixed(1)} ms`}</span>
        <strong>{dirty ? 'Modifié' : 'Enregistré'}</strong>
      </div>
    </footer>
  );
}
