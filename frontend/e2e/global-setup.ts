import {chromium, FullConfig} from '@playwright/test';

async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL ?? 'http://localhost:4200';
  const token = process.env['TEST_AUTH_TOKEN'];

  if (!token) {
    throw new Error('TEST_AUTH_TOKEN environment variable is required for E2E tests');
  }

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(baseURL);
  await page.evaluate((t) => localStorage.setItem('auth_token', t), token);
  await page.context().storageState({path: 'e2e/.auth/user.json'});
  await browser.close();
}

export default globalSetup;
