import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = dirname(fileURLToPath(import.meta.url));
const appBinaryPath = join(
  projectRoot,
  'src-tauri',
  'target',
  'debug',
  process.platform === 'win32'
    ? 'mandala-layers-studio.exe'
    : 'mandala-layers-studio',
);

if (!existsSync(appBinaryPath)) {
  throw new Error(
    `Binaire Tauri E2E introuvable : ${appBinaryPath}. Exécutez d’abord la construction E2E.`,
  );
}

export const config = {
  runner: 'local',
  specs: ['./tests/e2e-desktop/**/*.e2e.ts'],
  maxInstances: 1,
  capabilities: [
    {
      browserName: 'tauri',
      'tauri:options': {
        application: appBinaryPath,
      },
      'wdio:tauriServiceOptions': {
        appBinaryPath,
        appArgs: [],
        captureBackendLogs: true,
        captureFrontendLogs: true,
        backendLogLevel: 'warn',
        frontendLogLevel: 'warn',
      },
    },
  ],
  logLevel: process.env.CI ? 'warn' : 'info',
  bail: 0,
  waitforTimeout: 15_000,
  connectionRetryTimeout: 120_000,
  connectionRetryCount: 2,
  autoXvfb: false,
  services: [
    [
      '@wdio/tauri-service',
      {
        driverProvider: 'embedded',
      },
    ],
  ],
  framework: 'mocha',
  reporters: ['spec'],
  mochaOpts: {
    ui: 'bdd',
    timeout: 180_000,
  },
  outputDir: join(projectRoot, 'tests', 'e2e-desktop', 'logs'),
  tsConfigPath: join(projectRoot, 'tsconfig.test.json'),
};
