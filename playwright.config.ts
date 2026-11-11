import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:8790',
    viewport: { width: 1280, height: 720 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    launchOptions: { args: ['--enable-unsafe-swiftshader'] },
  },
  webServer: {
    command:
      'npm run build >/tmp/chromonopoly-e2e-build.log 2>&1 && ' +
      'rm -f /tmp/chromonopoly-e2e.db /tmp/chromonopoly-e2e.db-shm /tmp/chromonopoly-e2e.db-wal && ' +
      'CHROMONOPOLY_TEST=1 BOTS=0 CHROMONOPOLY_PORT=8790 CHROMONOPOLY_DB=/tmp/chromonopoly-e2e.db npm start',
    url: 'http://127.0.0.1:8790/api/health',
    reuseExistingServer: false,
    timeout: 90_000,
  },
});
