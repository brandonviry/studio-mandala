import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

const browserErrors = new WeakMap<Page, string[]>();

async function canvasSignature(page: Page): Promise<string> {
  return page.getByTestId('mandala-canvas').evaluate((element) => {
    if (!(element instanceof HTMLCanvasElement)) {
      throw new Error('mandala-canvas doit être un élément <canvas>.');
    }
    const context = element.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Contexte Canvas 2D indisponible.');
    const pixels = context.getImageData(
      0,
      0,
      element.width,
      element.height,
    ).data;
    const stride = Math.max(
      4,
      Math.floor(pixels.length / 25_000 / 4) * 4,
    );
    let hash = 2_166_136_261;
    for (let index = 0; index < pixels.length; index += stride) {
      hash ^= pixels[index] ?? 0;
      hash = Math.imul(hash, 16_777_619);
      hash ^= pixels[index + 1] ?? 0;
      hash = Math.imul(hash, 16_777_619);
      hash ^= pixels[index + 2] ?? 0;
      hash = Math.imul(hash, 16_777_619);
    }
    return `${element.width}x${element.height}:${hash >>> 0}`;
  });
}

async function waitForCanvasChange(page: Page, previous: string) {
  await expect
    .poll(() => canvasSignature(page), {
      message: 'Le Canvas doit être redessiné.',
    })
    .not.toBe(previous);
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
  await expect(page.getByTestId('mandala-canvas')).toBeVisible();
  await expect(page.getByTestId('status-bar')).not.toContainText('Rendu —');
});

test.afterEach(async ({ page }) => {
  expect(browserErrors.get(page) ?? []).toEqual([]);
});

test('affiche le studio desktop et son projet initial', async ({ page }) => {
  const canvas = page.getByTestId('mandala-canvas');
  const box = await canvas.boundingBox();

  expect(box).not.toBeNull();
  expect(box?.width).toBeGreaterThanOrEqual(240);
  expect(Math.abs((box?.width ?? 0) - (box?.height ?? 0))).toBeLessThanOrEqual(
    2,
  );
  await expect(page.getByTestId('layer-list').locator('li')).toHaveCount(3);
  await expect(page.getByTestId('status-bar')).toContainText(
    '3/3 calques visibles',
  );
});

test('la génération est déterministe pour une graine', async ({ page }) => {
  const seed = page.getByTestId('seed-input');
  const initial = await canvasSignature(page);

  await seed.fill('graine-e2e-alpha');
  await page.getByTestId('generate').click();
  await waitForCanvasChange(page, initial);
  const alpha = await canvasSignature(page);

  await seed.fill('graine-e2e-beta');
  await page.getByTestId('generate').click();
  await waitForCanvasChange(page, alpha);

  await seed.fill('graine-e2e-alpha');
  await page.getByTestId('generate').click();
  await expect.poll(() => canvasSignature(page)).toBe(alpha);
});

test('ajoute, masque, verrouille, duplique et annule une couche', async ({
  page,
}) => {
  const initialSignature = await canvasSignature(page);

  await page.getByTestId('add-layer').click();
  await page.getByTestId('add-disk').click();
  await expect(page.getByTestId('layer-list').locator('li')).toHaveCount(4);
  await waitForCanvasChange(page, initialSignature);

  const addedRow = page.getByTestId('layer-row-layer-4');
  await expect(addedRow).toBeVisible();
  const withDisk = await canvasSignature(page);

  await page.getByTestId('visibility-layer-4').click();
  await waitForCanvasChange(page, withDisk);
  await expect(page.getByTestId('status-bar')).toContainText(
    '3/4 calques visibles',
  );

  await page.getByTestId('lock-layer-4').click();
  await expect(
    addedRow.getByRole('button', { name: /Supprimer/ }),
  ).toBeDisabled();
  await page.getByTestId('lock-layer-4').click();
  await addedRow.getByRole('button', { name: /Dupliquer/ }).click();
  await expect(page.getByTestId('layer-list').locator('li')).toHaveCount(5);

  await page.getByTestId('undo').click();
  await expect(page.getByTestId('layer-list').locator('li')).toHaveCount(4);
  await page.getByTestId('redo').click();
  await expect(page.getByTestId('layer-list').locator('li')).toHaveCount(5);
});

test('protège une composition modifiée avant de la remplacer', async ({
  page,
}) => {
  await page.getByTestId('add-layer').click();
  await page.getByTestId('add-flower').click();
  await page.getByTestId('new-project').click();

  await expect(page.getByTestId('unsaved-dialog')).toBeVisible();
  await page.getByTestId('confirm-discard').click();
  await expect(page.getByTestId('canvas-empty')).toBeVisible();
  await expect(page.getByTestId('empty-layers')).toBeVisible();
});

test('conserve le rendu et bloque les sorties pendant une saisie invalide', async ({
  page,
}) => {
  const before = await canvasSignature(page);
  const count = page.getByTestId('ring-count-input');

  await count.fill('999');
  await expect(count).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByTestId('save-project')).toBeDisabled();
  await expect(page.getByTestId('open-export')).toBeDisabled();
  await expect.poll(() => canvasSignature(page)).toBe(before);

  await count.fill('12');
  await count.blur();
  await expect(count).not.toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByTestId('save-project')).toBeEnabled();
  await expect(page.getByTestId('open-export')).toBeEnabled();
});

test('le parcours principal ne présente aucune violation critique ou sérieuse', async ({
  page,
}) => {
  const results = await new AxeBuilder({ page }).analyze();
  const blockingViolations = results.violations.filter((violation) =>
    ['critical', 'serious'].includes(violation.impact ?? ''),
  );

  expect(
    blockingViolations,
    blockingViolations
      .map((violation) => `${violation.id}: ${violation.help}`)
      .join('\n'),
  ).toEqual([]);
});
