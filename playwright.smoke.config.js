// Config for the live-site smoke suite only. Separate from playwright.config.js
// on purpose: that one boots `vite preview` and tests the LOCAL build, this one
// tests the DEPLOYED site and must not start a server at all. See
// tests/smoke/smoke.spec.js for why the two are different jobs.
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/smoke',
  timeout: 45_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'line' : 'list',
  use: { screenshot: 'only-on-failure' },
});
