import { readFile } from 'node:fs/promises';
import { expect, type Page, test } from '@playwright/test';
import { createExampleProject } from '../../src/domain';

const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const browserErrors = new WeakMap<Page, string[]>();

function pngDimensions(contents: Buffer) {
  expect(contents.subarray(0, 8)).toEqual(pngSignature);
  expect(contents.subarray(12, 16).toString('ascii')).toBe('IHDR');
  return {
    width: contents.readUInt32BE(16),
    height: contents.readUInt32BE(20),
  };
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  browserErrors.set(page, errors);
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/');
  await expect(page.getByTestId('app-shell')).toBeVisible();
});

test.afterEach(async ({ page }) => {
  expect(browserErrors.get(page) ?? []).toEqual([]);
});

test('enregistre un projet JSON rééditable dans le navigateur', async ({
  page,
}, testInfo) => {
  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('save-project').click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toMatch(/\.mandala\.json$/i);
  const outputPath = testInfo.outputPath('projet.mandala.json');
  await download.saveAs(outputPath);
  const project = JSON.parse(await readFile(outputPath, 'utf8'));

  expect(project).toMatchObject({
    schemaVersion: 1,
    generatorVersion: 1,
    layers: expect.any(Array),
  });
  await expect(page.getByTestId('status-bar')).toContainText('Enregistré');
});

test('ouvre et valide un projet local choisi', async ({ page }) => {
  const project = {
    ...createExampleProject(),
    title: 'Projet importé E2E',
    seed: 'import-e2e',
  };
  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByTestId('open-project').click();
  const chooser = await chooserPromise;
  await chooser.setFiles({
    name: 'importe.mandala.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(project), 'utf8'),
  });

  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Projet importé E2E',
  );
  await expect(page.getByTestId('status-bar')).toContainText('Projet ouvert');
});

for (const resolution of [2048, 4096] as const) {
  test(`exporte réellement un PNG ${resolution} × ${resolution}`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000);
    await page.getByTestId('open-export').click();
    await page.getByTestId(`resolution-${resolution}`).check();

    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('confirm-export').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.png$/i);

    const outputPath = testInfo.outputPath(`mandala-${resolution}.png`);
    await download.saveAs(outputPath);
    const contents = await readFile(outputPath);

    expect(contents.byteLength).toBeGreaterThan(1_000);
    expect(pngDimensions(contents)).toEqual({
      width: resolution,
      height: resolution,
    });
    await expect(page.getByTestId('export-dialog')).toBeHidden();
    await expect(page.getByTestId('status-bar')).toContainText(
      `PNG ${resolution} × ${resolution} exporté`,
    );
  });
}
