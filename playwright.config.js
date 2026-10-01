const { defineConfig, devices } = require('@playwright/test')

const E2E_PORT = 6943
const SHUTDOWN_TIMEOUT_MS = 2000
const BASE_URL = `http://localhost:${E2E_PORT}`

module.exports = defineConfig({
   testDir: 'tests/e2e',
   testMatch: '**/*.spec.js',
   forbidOnly: !!process.env.CI,
   reporter: [['list'], ['html', { open: 'never' }]],
   use: {
      baseURL: BASE_URL,
      trace: 'retain-on-failure'
   },
   projects: [
      { name: 'phone', use: { ...devices['Pixel 7'] } },
      { name: 'tablet', use: { ...devices['Galaxy Tab S4'] } },
      { name: 'desktop', use: { ...devices['Desktop Chrome'] } }
   ],
   webServer: {
      command: 'node tests/e2e/server.js',
      url: `${BASE_URL}/teams/AWAY`,
      env: { E2E_PORT: String(E2E_PORT) },
      // Never attach to an already-running server: it could be using real league data.
      reuseExistingServer: false,
      // SIGTERM lets the server delete its temporary data folder; the default is SIGKILL.
      gracefulShutdown: { signal: 'SIGTERM', timeout: SHUTDOWN_TIMEOUT_MS }
   }
})
