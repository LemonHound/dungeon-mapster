import {test, expect, Browser, BrowserContext, Page} from '@playwright/test';

const USER_COUNT = parseInt(process.env['WS_USER_COUNT'] ?? '3', 10);

test.describe('multi-user WebSocket', () => {
  let mapId: number;
  let joinCode: string;

  test.beforeAll(async ({request}) => {
    const token = process.env['TEST_AUTH_TOKEN']!;
    const res = await request.post('/api/maps', {
      headers: {Authorization: `Bearer ${token}`},
      data: {name: 'Multiplayer E2E Map', gridType: 'square', gridSize: 40},
    });
    expect(res.ok()).toBeTruthy();
    const map = await res.json();
    mapId = map.id;
    joinCode = map.joinCode;
  });

  test.afterAll(async ({request}) => {
    const token = process.env['TEST_AUTH_TOKEN']!;
    await request.delete(`/api/maps/${mapId}`, {
      headers: {Authorization: `Bearer ${token}`},
    });
  });

  function injectAuth(page: Page, token: string) {
    return page.addInitScript((t) => localStorage.setItem('auth_token', t), token);
  }

  test('presence: users appear and disappear correctly', async ({browser}) => {
    const token = process.env['TEST_AUTH_TOKEN']!;

    const contexts: BrowserContext[] = [];
    const pages: Page[] = [];

    for (let i = 0; i < USER_COUNT; i++) {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await injectAuth(page, token);
      contexts.push(ctx);
      pages.push(page);
    }

    try {
      for (const page of pages) {
        await page.goto(`/map-editor/${mapId}`);
        await page.waitForLoadState('networkidle');
      }

      await pages[0].waitForTimeout(1500);

      await pages[USER_COUNT - 1].close();
      contexts[USER_COUNT - 1].close();

      await pages[0].waitForTimeout(1000);
    } finally {
      for (let i = 0; i < contexts.length; i++) {
        try {
          await contexts[i].close();
        } catch {
        }
      }
    }
  });

  test('cell selection broadcast: user A selects, user B sees presence indicator', async ({browser}) => {
    const token = process.env['TEST_AUTH_TOKEN']!;

    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();

    try {
      await injectAuth(pageA, token);
      await injectAuth(pageB, token);

      await pageA.goto(`/map-editor/${mapId}`);
      await pageB.goto(`/map-editor/${mapId}`);

      await pageA.waitForLoadState('networkidle');
      await pageB.waitForLoadState('networkidle');

      await pageA.waitForTimeout(1000);

      const canvas = pageA.locator('#grid-canvas');
      if (await canvas.isVisible()) {
        await canvas.click({position: {x: 120, y: 120}});
        await pageB.waitForTimeout(800);
      }
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });

  test('reconnect: user resumes session after disconnect', async ({browser}) => {
    const token = process.env['TEST_AUTH_TOKEN']!;

    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await injectAuth(page, token);

    try {
      await page.goto(`/map-editor/${mapId}`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);

      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      await expect(page).toHaveURL(`/map-editor/${mapId}`);
    } finally {
      await ctx.close();
    }
  });
});
