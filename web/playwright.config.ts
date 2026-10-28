import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: './tests', timeout: 180000, expect: { timeout: 10000 }, fullyParallel: false, workers: 1, reporter: 'list', use: { baseURL: process.env.WEB_URL ?? 'http://localhost:3002', headless: true, actionTimeout: 15000, trace: 'retain-on-failure', screenshot: 'only-on-failure' } });
