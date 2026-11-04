import { describe, expect, it } from 'vitest';
import { createExampleProject } from '../../src/domain';
import {
  exportProjectPng,
  MemoryDesktopGateway,
} from '../../src/persistence';

describe('dialogue d’export PNG', () => {
  it('n’alloue pas le Canvas lorsque le choix du chemin est annulé', async () => {
    const memory = new MemoryDesktopGateway();
    memory.queueSave(null);

    await expect(
      exportProjectPng(createExampleProject(), 4096, memory),
    ).resolves.toEqual({ status: 'cancelled' });
  });
});
