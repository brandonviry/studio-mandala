import type { Primitive } from '../domain';
import type { MandalaScene } from './scene';

export interface RenderOptions {
  guides?: boolean;
  selectedLayerId?: string | undefined;
}

function tracePrimitive(
  context: CanvasRenderingContext2D,
  primitive: Primitive,
): void {
  context.beginPath();
  if (primitive.kind === 'circle') {
    context.arc(
      primitive.center.x,
      primitive.center.y,
      primitive.radius,
      0,
      Math.PI * 2,
    );
    return;
  }

  primitive.points.forEach((point, index) => {
    if (index === 0) context.moveTo(point.x, point.y);
    else context.lineTo(point.x, point.y);
  });
  if (primitive.closed) context.closePath();
}

export function renderMandala(
  context: CanvasRenderingContext2D,
  scene: MandalaScene,
  options: RenderOptions = {},
): void {
  const { height, width } = context.canvas;
  const scale = Math.min(width, height) * 0.475;

  context.save();
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.globalAlpha = 1;
  context.globalCompositeOperation = 'source-over';
  context.clearRect(0, 0, width, height);
  context.fillStyle = scene.project.background;
  context.fillRect(0, 0, width, height);
  context.translate(width / 2, height / 2);
  context.scale(scale, scale);

  for (const layer of scene.layers) {
    for (const primitive of layer.primitives) {
      tracePrimitive(context, primitive);
      context.globalAlpha = layer.style.opacity;
      context.lineWidth = layer.style.strokeWidth;
      if (layer.style.fill) {
        context.fillStyle = layer.style.fill;
        context.fill();
      }
      if (layer.style.stroke) {
        context.strokeStyle = layer.style.stroke;
        context.stroke();
      }

      if (options.selectedLayerId === layer.layerId) {
        context.globalAlpha = 0.8;
        context.strokeStyle = '#2563eb';
        context.lineWidth = 0.008;
        context.stroke();
      }
    }
  }

  if (options.guides) {
    context.globalAlpha = 0.25;
    context.strokeStyle = '#667085';
    context.lineWidth = 0.002;
    context.beginPath();
    context.arc(0, 0, 1, 0, Math.PI * 2);
    context.moveTo(-1, 0);
    context.lineTo(1, 0);
    context.moveTo(0, -1);
    context.lineTo(0, 1);
    context.stroke();
  }
  context.restore();
}

export function resizeCanvasToDisplaySize(
  canvas: HTMLCanvasElement,
  size = canvas.clientWidth,
): number {
  const safeSize = Number.isFinite(size) ? Math.max(1, size) : 1;
  const dpr = Math.max(1, globalThis.devicePixelRatio || 1);
  const internalSize = Math.max(1, Math.round(safeSize * dpr));
  canvas.width = internalSize;
  canvas.height = internalSize;
  canvas.style.width = `${safeSize}px`;
  canvas.style.height = `${safeSize}px`;
  return dpr;
}
