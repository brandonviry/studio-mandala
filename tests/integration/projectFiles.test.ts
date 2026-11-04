import { describe, expect, it } from 'vitest';
import { createExampleProject } from '../../src/domain';
import {
  createProjectDesktopGateway,
  MemoryDesktopGateway,
  openProjectFile,
  ProjectFileError,
  saveProjectFile,
} from '../../src/persistence';

describe('fichiers projet', () => {
  it('enregistre puis rouvre un projet sans perte', async () => {
    const project = createExampleProject();
    const memory = new MemoryDesktopGateway();
    memory.queueSave('C:\\projets\\atelier');

    const saved = await saveProjectFile(project, memory);
    expect(saved).toEqual({
      status: 'success',
      path: 'C:\\projets\\atelier.mandala.json',
    });

    memory.queueOpen('C:\\projets\\atelier.mandala.json');
    const opened = await openProjectFile(memory);

    expect(opened).toEqual({
      status: 'success',
      path: 'C:\\projets\\atelier.mandala.json',
      project,
    });
    expect(opened.status === 'success' && opened.project).not.toBe(project);
  });

  it('ne transforme pas une annulation en erreur', async () => {
    const memory = new MemoryDesktopGateway();
    memory.queueOpen(null);
    memory.queueSave(null);

    await expect(openProjectFile(memory)).resolves.toEqual({
      status: 'cancelled',
    });
    await expect(
      saveProjectFile(createExampleProject(), memory),
    ).resolves.toEqual({ status: 'cancelled' });
  });

  it('refuse un JSON invalide avec une erreur métier', async () => {
    const memory = new MemoryDesktopGateway({
      'invalide.mandala.json': '{"schemaVersion":99}',
    });
    memory.queueOpen('invalide.mandala.json');

    await expect(openProjectFile(memory)).rejects.toMatchObject({
      name: 'ProjectFileError',
      code: 'invalid-project',
    } satisfies Partial<ProjectFileError>);
  });

  it('réutilise le chemin courant pour Enregistrer', async () => {
    const project = createExampleProject();
    const memory = new MemoryDesktopGateway();
    const gateway = createProjectDesktopGateway(memory);
    memory.queueSave('premier.mandala.json');

    await expect(gateway.save(project)).resolves.toMatchObject({
      status: 'success',
      path: 'premier.mandala.json',
    });
    await expect(
      gateway.save({ ...project, title: 'Version deux' }),
    ).resolves.toMatchObject({
      status: 'success',
      path: 'premier.mandala.json',
    });

    expect(
      JSON.parse(memory.getText('premier.mandala.json') ?? '{}'),
    ).toMatchObject({ title: 'Version deux' });
  });

  it('oublie le chemin courant lors de la création d’un nouveau document', async () => {
    const project = createExampleProject();
    const memory = new MemoryDesktopGateway();
    const gateway = createProjectDesktopGateway(memory);
    memory.queueSave('ancien.mandala.json');
    await gateway.save(project);

    gateway.clearCurrentProjectPath();
    memory.queueSave('nouveau.mandala.json');
    await expect(
      gateway.save({ ...project, title: 'Nouveau document' }),
    ).resolves.toMatchObject({
      status: 'success',
      path: 'nouveau.mandala.json',
    });

    expect(memory.getText('ancien.mandala.json')).toBeDefined();
    expect(memory.getText('nouveau.mandala.json')).toContain(
      'Nouveau document',
    );
  });
});
