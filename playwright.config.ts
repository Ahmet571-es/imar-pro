import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 120000,
  retries: 1,
  use: {
    baseURL: 'https://balaban-imar.vercel.app',
    screenshot: 'on',
    trace: 'on-first-retry',
    locale: 'tr-TR',
  },
  projects: [
    {
      name: 'desktop',
      use: { viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile',
      use: { viewport: { width: 375, height: 812 } },
    },
  ],
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
  ],
})
