import { describe, expect, it } from 'vitest';
import {
  createExampleProject,
  moveLayer,
  type DiskLayer,
  type MandalaProject,
} from '../../src/domain';
import {
  exportProjectPng,
  MemoryDesktopGateway,
  renderProjectPng,
} from '../../src/persistence';
import { createScene, renderMandala } from '../../src/rendering';

const pngHeader = [137, 80, 78, 71, 13, 10, 26, 10];
const exportSize = 2048;

function solidDisk(
  id: string,
  name: string,
  fill: string,
): DiskLayer {
  return {
    id,
    name,
    visible: true,
    locked: false,
    rotationDeg: 0,
    style: {
      stroke: null,
      strokeWidth: 0.006,
      fill,
      opacity: 1,
    },
    kind: 'disk',
    radius: 0.6,
  };
}

function createOverlapProject(): MandalaProject {
  return {
    schemaVersion: 1,
    generatorVersion: 1,
    title: 'Sondes RGBA',
    seed: 'rgba-order-v1',
    background: '#ffffff',
    nextLayerNumber: 3,
    layers: [
      solidDisk('layer-1', 'Rouge arrière', '#ff0000'),
      solidDisk('layer-2', 'Bleu avant', '#0000ff'),
    ],
  };
}

function renderPreview(project: MandalaProject): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = exportSize;
  canvas.height = exportSize;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Contexte Canvas 2D indisponible.');
  renderMandala(context, createScene(project), { guides: false });
  return canvas;
}

async function decodePng(contents: Uint8Array): Promise<HTMLCanvasElement> {
  const owned = new Uint8Array(contents.byteLength);
  owned.set(contents);
  const bitmap = await createImageBitmap(
    new Blob([owned.buffer], { type: 'image/png' }),
  );
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext('2d');
  if (!context) {
    bitmap.close();
    throw new Error('Contexte Canvas 2D indisponible.');
  }
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  return canvas;
}

function stableRgbaProbes(canvas: HTMLCanvasElement) {
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Contexte Canvas 2D indisponible.');
  const center = exportSize / 2;
  const rgbaAt = (x: number, y: number) =>
    [...context.getImageData(x, y, 1, 1).data];

  return {
    center: rgbaAt(center, center),
    insideEast: rgbaAt(center + 160, center),
    background: rgbaAt(32, 32),
    horizontalGuideSentinel: rgbaAt(64, center),
    verticalGuideSentinel: rgbaAt(center, 64),
  };
}

function readPngDimensions(contents: Uint8Array) {
  const view = new DataView(
    contents.buffer,
    contents.byteOffset,
    contents.byteLength,
  );
  return {
    width: view.getUint32(16),
    height: view.getUint32(20),
  };
}

describe('export PNG réel', () => {
  it('encode un PNG 2048 carré avec le moteur de scène', async () => {
    const contents = await renderProjectPng(createExampleProject(), 2048);

    expect([...contents.subarray(0, 8)]).toEqual(pngHeader);
    expect(readPngDimensions(contents)).toEqual({
      width: 2048,
      height: 2048,
    });
    expect(contents.byteLength).toBeGreaterThan(1_000);
  });

  it('écrit les octets dans le gateway choisi', async () => {
    const memory = new MemoryDesktopGateway();
    memory.queueSave('export-test');

    const result = await exportProjectPng(
      createExampleProject(),
      2048,
      memory,
    );

    expect(result).toEqual({
      status: 'success',
      path: 'export-test.png',
    });
    expect(
      readPngDimensions(memory.getBinary('export-test.png') ?? new Uint8Array()),
    ).toEqual({ width: 2048, height: 2048 });
  });

  it('rejette toute résolution non prévue', async () => {
    await expect(
      renderProjectPng(createExampleProject(), 1024 as 2048),
    ).rejects.toThrow('2048 ou 4096');
  });

  it('conserve les mêmes RGBA et le même ordre visuel après réordonnancement', async () => {
    const project = createOverlapProject();
    const previewBefore = renderPreview(project);
    const pngBefore = await renderProjectPng(project, exportSize);
    const decodedBefore = await decodePng(pngBefore);

    expect({
      width: previewBefore.width,
      height: previewBefore.height,
    }).toEqual(readPngDimensions(pngBefore));
    const previewBeforeRgba = stableRgbaProbes(previewBefore);
    const exportBeforeRgba = stableRgbaProbes(decodedBefore);
    expect(exportBeforeRgba).toEqual(previewBeforeRgba);
    expect(previewBeforeRgba.center).toEqual([0, 0, 255, 255]);
    expect(previewBeforeRgba.horizontalGuideSentinel).toEqual([
      255, 255, 255, 255,
    ]);
    expect(previewBeforeRgba.verticalGuideSentinel).toEqual([
      255, 255, 255, 255,
    ]);

    const moved = moveLayer(project, 'layer-1', 1);
    expect(moved.ok).toBe(true);
    if (!moved.ok) throw new Error(moved.error);

    const previewAfter = renderPreview(moved.value);
    const pngAfter = await renderProjectPng(moved.value, exportSize);
    const decodedAfter = await decodePng(pngAfter);
    expect({
      width: previewAfter.width,
      height: previewAfter.height,
    }).toEqual(readPngDimensions(pngAfter));
    const previewAfterRgba = stableRgbaProbes(previewAfter);
    const exportAfterRgba = stableRgbaProbes(decodedAfter);

    expect(exportAfterRgba).toEqual(previewAfterRgba);
    expect(previewAfterRgba.center).toEqual([255, 0, 0, 255]);
    expect(previewAfterRgba.center).not.toEqual(previewBeforeRgba.center);
    expect(exportAfterRgba.center).not.toEqual(exportBeforeRgba.center);

    for (const canvas of [
      previewBefore,
      decodedBefore,
      previewAfter,
      decodedAfter,
    ]) {
      canvas.width = 1;
      canvas.height = 1;
    }
  });
});
