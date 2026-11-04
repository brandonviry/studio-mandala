import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    coverage: {
      provider: 'v8',
      include: [
        'src/domain/**/*.ts',
        'src/generation/**/*.ts',
        'src/rendering/scene.ts',
        'src/rendering/hitTesting.ts',
      ],
      exclude: ['src/**/index.ts'],
      reporter: ['text', 'html', 'lcov'],
      thresholds: {
        lines: 85,
        statements: 85,
        functions: 90,
        branches: 70,
        'src/generation/layerGenerators.ts': {
          lines: 95,
          statements: 95,
          functions: 95,
          branches: 90,
        },
        'src/generation/prng.ts': {
          lines: 95,
          statements: 95,
          functions: 95,
          branches: 90,
        },
        'src/rendering/scene.ts': {
          lines: 95,
          statements: 95,
          functions: 95,
          branches: 90,
        },
      },
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'node',
          include: [
            'tests/unit/**/*.{test,spec}.ts',
            'tests/integration/**/*.test.ts',
          ],
          exclude: ['tests/integration/**/*.browser.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'renderer',
          include: ['tests/integration/**/*.browser.test.ts'],
          browser: {
            enabled: true,
            provider: 'playwright',
            headless: true,
            instances: [{ browser: 'chromium' }],
          },
        },
      },
      {
        test: {
          name: 'performance',
          environment: 'node',
          include: ['tests/performance/**/*.test.ts'],
          sequence: {
            concurrent: false,
          },
        },
      },
    ],
  },
});
