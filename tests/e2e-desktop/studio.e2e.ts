import { $, $$, browser, expect } from '@wdio/globals';

interface E2eArtifactState {
  projectExists: boolean;
  png2048: { exists: boolean; width: number; height: number };
  png4096: { exists: boolean; width: number; height: number };
}

interface ErrorWindow extends Window {
  __mandalaE2eErrors?: string[];
}

async function addLayer(kind: 'flower' | 'disk' | 'circle-ring') {
  await $('[data-testid="add-layer"]').click();
  await $(`[data-testid="add-${kind}"]`).click();
}

async function layerRows(): Promise<WebdriverIO.Element[]> {
  return (await $$('[data-layer-id]')) as unknown as WebdriverIO.Element[];
}

describe('Studio Mandala — binaire desktop', () => {
  it('réalise le parcours génération, édition, fichier et export', async () => {
    await $('[data-testid="app-shell"]').waitForDisplayed();
    await browser.execute(() => {
      const target = window as ErrorWindow;
      target.__mandalaE2eErrors = [];
      window.addEventListener('error', (event) => {
        target.__mandalaE2eErrors?.push(event.message);
      });
      window.addEventListener('unhandledrejection', (event) => {
        target.__mandalaE2eErrors?.push(String(event.reason));
      });
    });

    const seed = $('[data-testid="seed-input"]');
    await seed.setValue('graine-desktop-e2e');
    await $('[data-testid="generate"]').click();
    await expect(seed).toHaveValue('graine-desktop-e2e');
    const generatedCount = (await layerRows()).length;

    await addLayer('flower');
    await addLayer('disk');
    await addLayer('circle-ring');
    expect((await layerRows()).length).toBe(generatedCount + 3);

    const topRow = (await layerRows())[0];
    expect(topRow).toBeDefined();
    const selectedRow = topRow!;
    const selectedId = await selectedRow.getAttribute('data-layer-id');
    await selectedRow.$('.layer-row__select').click();

    const visibility = $(`[data-testid="visibility-${selectedId}"]`);
    await visibility.click();
    await expect(visibility).toHaveAttribute('aria-pressed', 'true');
    await visibility.click();

    const lock = $(`[data-testid="lock-${selectedId}"]`);
    await lock.click();
    await expect(lock).toHaveAttribute('aria-pressed', 'true');
    await lock.click();

    const countBeforeDuplicate = (await layerRows()).length;
    await $('[aria-label^="Dupliquer "]').click();
    expect((await layerRows()).length).toBe(countBeforeDuplicate + 1);

    await $('[aria-label^="Renommer "]').click();
    const rename = $('input[aria-label^="Renommer "]');
    await rename.setValue('Anneau de contrôle');
    await browser.keys('Enter');
    await expect($('strong=Anneau de contrôle')).toBeDisplayed();

    const moveBackward = $('[aria-label="Descendre vers l’arrière-plan"]');
    if (await moveBackward.isEnabled()) await moveBackward.click();

    await $('[aria-label^="Supprimer "]').click();
    expect((await layerRows()).length).toBe(countBeforeDuplicate);
    await $('[data-testid="undo"]').click();
    expect((await layerRows()).length).toBe(countBeforeDuplicate + 1);
    await $('[data-testid="redo"]').click();
    expect((await layerRows()).length).toBe(countBeforeDuplicate);

    await $('[data-testid="save-project"]').click();
    await expect($('[role="status"]')).toHaveText(
      expect.stringContaining('enregistré'),
    );

    await seed.setValue('modification-non-enregistree');
    await $('[data-testid="generate"]').click();
    await $('[data-testid="open-project"]').click();
    await $('[data-testid="confirm-discard"]').click();
    await expect(seed).toHaveValue('graine-desktop-e2e');

    for (const resolution of [2048, 4096] as const) {
      await $('[data-testid="open-export"]').click();
      await $(`[data-testid="resolution-${resolution}"]`).click();
      await $('[data-testid="confirm-export"]').click();
      await expect($('[role="status"]')).toHaveText(
        expect.stringContaining(`PNG ${resolution}`),
      );
    }

    await seed.click();
    await browser.keys(['TAB']);
    const focusedTag = await browser.execute(
      () => document.activeElement?.tagName ?? '',
    );
    expect(['BUTTON', 'INPUT']).toContain(focusedTag);

    const artifacts = (await browser.tauri.execute(({ core }) =>
      core.invoke('e2e_artifact_state'),
    )) as E2eArtifactState;
    expect(artifacts.projectExists).toBe(true);
    expect(artifacts.png2048).toEqual({
      exists: true,
      width: 2048,
      height: 2048,
    });
    expect(artifacts.png4096).toEqual({
      exists: true,
      width: 4096,
      height: 4096,
    });

    const frontendErrors = await browser.execute(
      () => (window as ErrorWindow).__mandalaE2eErrors ?? [],
    );
    expect(frontendErrors).toEqual([]);
  });
});
