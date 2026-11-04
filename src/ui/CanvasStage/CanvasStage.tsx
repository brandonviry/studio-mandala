import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent,
} from 'react';
import type { LayerKind, MandalaProject } from '../../domain';
import {
  createScene,
  describeProject,
  hitTestLayer,
  renderMandala,
  resizeCanvasToDisplaySize,
} from '../../rendering';
import type { ViewportState } from '../../state/editorReducer';
import { Icon } from '../Icon';

interface CanvasStageProps {
  project: MandalaProject;
  selectedLayerId: string | null;
  viewport: ViewportState;
  onSelect(id: string | null): void;
  onZoom(zoom: number): void;
  onPan(x: number, y: number): void;
  onFit(): void;
  onToggleGuides(): void;
  onAdd(kind: LayerKind): void;
  onRender(duration: number): void;
}

interface PanGesture {
  pointerId: number;
  x: number;
  y: number;
}

export function CanvasStage({
  project,
  selectedLayerId,
  viewport,
  onSelect,
  onZoom,
  onPan,
  onFit,
  onToggleGuides,
  onAdd,
  onRender,
}: CanvasStageProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvasSize, setCanvasSize] = useState(640);
  const [spacePressed, setSpacePressed] = useState(false);
  const panGesture = useRef<PanGesture | null>(null);
  const scene = useMemo(() => createScene(project), [project]);
  const visibleCount = project.layers.filter((layer) => layer.visible).length;
  const description = describeProject(project);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const updateSize = () => {
      const rect = stage.getBoundingClientRect();
      const available = Math.max(
        240,
        Math.min(rect.width - 64, rect.height - 118, 900),
      );
      setCanvasSize(Math.round(available));
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const frame = requestAnimationFrame(() => {
      const started = performance.now();
      resizeCanvasToDisplaySize(canvas, canvasSize);
      const context = canvas.getContext('2d');
      if (!context) return;
      renderMandala(context, scene, {
        guides: viewport.guides,
        selectedLayerId: selectedLayerId ?? undefined,
      });
      onRender(performance.now() - started);
    });
    return () => cancelAnimationFrame(frame);
  }, [
    canvasSize,
    onRender,
    scene,
    selectedLayerId,
    viewport.guides,
  ]);

  const selectAtPointer = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      const canvas = event.currentTarget;
      const rect = canvas.getBoundingClientRect();
      const normalizedPoint = {
        x: ((event.clientX - rect.left) / rect.width - 0.5) / 0.475,
        y: ((event.clientY - rect.top) / rect.height - 0.5) / 0.475,
      };
      onSelect(hitTestLayer(scene, normalizedPoint, 0.035));
    },
    [onSelect, scene],
  );

  const beginPan = (
    event: ReactPointerEvent<HTMLDivElement | HTMLCanvasElement>,
  ) => {
    panGesture.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const continuePan = (
    event: ReactPointerEvent<HTMLDivElement | HTMLCanvasElement>,
  ) => {
    const gesture = panGesture.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    onPan(event.clientX - gesture.x, event.clientY - gesture.y);
    panGesture.current = { ...gesture, x: event.clientX, y: event.clientY };
  };

  const endPan = (
    event: ReactPointerEvent<HTMLDivElement | HTMLCanvasElement>,
  ) => {
    if (panGesture.current?.pointerId !== event.pointerId) return;
    panGesture.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const factor = event.deltaY > 0 ? 0.9 : 1.1;
    onZoom(viewport.zoom * factor);
  };

  return (
    <main
      aria-label="Table de montage"
      className={`canvas-stage ${spacePressed ? 'canvas-stage--panning' : ''}`}
      data-testid="canvas-stage"
      onKeyDown={(event) => {
        if (event.code === 'Space' && !event.repeat) {
          event.preventDefault();
          setSpacePressed(true);
        }
      }}
      onKeyUp={(event) => {
        if (event.code === 'Space') setSpacePressed(false);
      }}
      onWheel={handleWheel}
      ref={stageRef}
      tabIndex={0}
    >
      <header className="stage-heading">
        <div>
          <p className="eyebrow">Table de montage · Épreuve active</p>
          <h1>{project.title}</h1>
        </div>
        <p className="stage-heading__meta">
          {visibleCount} calque{visibleCount > 1 ? 's' : ''} visible
          {visibleCount > 1 ? 's' : ''}
          <span aria-hidden="true"> / </span>
          centre commun
        </p>
      </header>

      {project.layers.length > 0 && visibleCount === 0 ? (
        <div className="stage-alert" role="status">
          <Icon name="eye-off" />
          <span>Toutes les couches sont masquées.</span>
        </div>
      ) : null}

      <div className="stage-workarea">
        <div
          className="artboard-transform"
          style={{
            transform: `translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.zoom})`,
          }}
        >
          <div className="proof-sheet" style={{ width: canvasSize }}>
            <span className="crop-mark crop-mark--tl" aria-hidden="true" />
            <span className="crop-mark crop-mark--tr" aria-hidden="true" />
            <span className="crop-mark crop-mark--bl" aria-hidden="true" />
            <span className="crop-mark crop-mark--br" aria-hidden="true" />
            <canvas
              aria-describedby="canvas-description"
              aria-label={description}
              className="mandala-canvas"
              data-testid="mandala-canvas"
              onPointerDown={(event) => {
                if (spacePressed || event.button === 1) {
                  event.preventDefault();
                  beginPan(event);
                } else {
                  selectAtPointer(event);
                }
              }}
              onPointerMove={continuePan}
              onPointerUp={endPan}
              ref={canvasRef}
              role="img"
            >
              Votre navigateur ne prend pas en charge Canvas 2D.
            </canvas>
            {project.layers.length === 0 ? (
              <div className="canvas-empty" data-testid="canvas-empty">
                <span className="canvas-empty__rings" aria-hidden="true" />
                <p className="eyebrow">Composition vide</p>
                <h2>Posez votre première forme</h2>
                <p>
                  Toutes les couches partageront ce même centre, comme des
                  feuilles découpées sur une table lumineuse.
                </p>
                <div>
                  <button
                    className="button button--accent"
                    onClick={() => onAdd('flower')}
                    type="button"
                  >
                    <Icon name="flower" />
                    Ajouter une fleur
                  </button>
                  <button
                    className="button button--paper"
                    onClick={() => onAdd('circle-ring')}
                    type="button"
                  >
                    <Icon name="ring" />
                    Ajouter un anneau
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="canvas-controls" aria-label="Contrôles du canvas">
        <button
          aria-label="Dézoomer"
          className="icon-button"
          data-testid="zoom-out"
          onClick={() => onZoom(viewport.zoom - 0.1)}
          type="button"
        >
          −
        </button>
        <button
          className="zoom-readout"
          data-testid="zoom-fit"
          onClick={onFit}
          title="Ajuster à la fenêtre · 0"
          type="button"
        >
          {Math.round(viewport.zoom * 100)} %
        </button>
        <button
          aria-label="Zoomer"
          className="icon-button"
          data-testid="zoom-in"
          onClick={() => onZoom(viewport.zoom + 0.1)}
          type="button"
        >
          +
        </button>
        <span className="canvas-controls__rule" aria-hidden="true" />
        <button
          aria-pressed={viewport.guides}
          className="tool-button"
          data-testid="toggle-guides"
          onClick={onToggleGuides}
          type="button"
        >
          <Icon name="guides" />
          Guides
        </button>
      </div>

      <div className="visually-hidden" id="canvas-description">
        <p>{description}</p>
        <ol>
          {[...project.layers].reverse().map((layer) => (
            <li key={layer.id}>
              {layer.name}, {layer.kind}, {layer.visible ? 'visible' : 'masqué'}
              , {layer.locked ? 'verrouillé' : 'modifiable'}.
            </li>
          ))}
        </ol>
      </div>
    </main>
  );
}
