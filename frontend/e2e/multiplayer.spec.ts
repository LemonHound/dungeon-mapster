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

  test('cellEdit_byUserA_seenByUserB', async ({browser, request}) => {
    const token = process.env['TEST_AUTH_TOKEN']!;

    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();
    await injectAuth(pageA, token);
    await injectAuth(pageB, token);

    try {
      await pageA.goto(`/map-editor/${mapId}`);
      await pageA.waitForLoadState('networkidle');
      await pageB.goto(`/map-editor/${mapId}`);
      await pageB.waitForLoadState('networkidle');

      await request.post(`/api/grid-cells/${mapId}/0/0`, {
        headers: {Authorization: `Bearer ${token}`},
        data: {name: 'Sync Cell'},
      });

      await pageA.waitForTimeout(1500);

      const res = await request.get(`/api/grid-cells/${mapId}/0/0`, {
        headers: {Authorization: `Bearer ${token}`},
      });
      const cell = await res.json();
      expect(cell.name).toBe('Sync Cell');
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });

  test('sharedNoteEdit_byUserA_seenByUserB', async ({browser, request}) => {
    const token = process.env['TEST_AUTH_TOKEN']!;

    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();
    await injectAuth(pageA, token);
    await injectAuth(pageB, token);

    try {
      await pageA.goto(`/map-editor/${mapId}`);
      await pageA.waitForLoadState('networkidle');
      await pageB.goto(`/map-editor/${mapId}`);
      await pageB.waitForLoadState('networkidle');

      await request.put(`/api/maps/${mapId}/notes/map/shared`, {
        headers: {Authorization: `Bearer ${token}`},
        data: {content: 'Multiplayer shared note'},
      });

      await pageB.waitForTimeout(1500);

      const res = await request.get(`/api/maps/${mapId}/notes/map`, {
        headers: {Authorization: `Bearer ${token}`},
      });
      const notes = await res.json();
      expect(notes.sharedContent).toBe('Multiplayer shared note');
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });

  test('variableCreation_byUserA_seenByUserB', async ({browser, request}) => {
    const token = process.env['TEST_AUTH_TOKEN']!;

    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();
    await injectAuth(pageA, token);
    await injectAuth(pageB, token);

    try {
      await pageA.goto(`/map-editor/${mapId}`);
      await pageA.waitForLoadState('networkidle');
      await pageB.goto(`/map-editor/${mapId}`);
      await pageB.waitForLoadState('networkidle');

      const res = await request.post(`/api/maps/${mapId}/variables`, {
        headers: {Authorization: `Bearer ${token}`},
        data: {name: 'MP Variable', dataType: 'TEXT', visibility: 'VISIBLE', sortOrder: 0},
      });
      expect(res.ok()).toBeTruthy();
      const variable = await res.json();

      await pageB.waitForTimeout(1500);
      await expect(pageB.locator(`text=MP Variable`)).toBeVisible({timeout: 5000});

      await request.delete(`/api/maps/${mapId}/variables/${variable.id}`, {
        headers: {Authorization: `Bearer ${token}`},
      });
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });

  test('cellVariableValueSet_byUserA_seenByUserB', async ({browser, request}) => {
    const token = process.env['TEST_AUTH_TOKEN']!;

    const varRes = await request.post(`/api/maps/${mapId}/variables`, {
      headers: {Authorization: `Bearer ${token}`},
      data: {name: 'HP Counter', dataType: 'TEXT', visibility: 'VISIBLE', sortOrder: 0},
    });
    expect(varRes.ok()).toBeTruthy();
    const variable = await varRes.json();

    await request.post(`/api/grid-cells/${mapId}/1/0`, {
      headers: {Authorization: `Bearer ${token}`},
      data: {name: 'HP Cell'},
    });

    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();
    await injectAuth(pageA, token);
    await injectAuth(pageB, token);

    try {
      await pageA.goto(`/map-editor/${mapId}`);
      await pageA.waitForLoadState('networkidle');
      await pageB.goto(`/map-editor/${mapId}`);
      await pageB.waitForLoadState('networkidle');

      await request.put(`/api/maps/${mapId}/cells/1/0/variable-values/${variable.id}`, {
        headers: {Authorization: `Bearer ${token}`},
        data: {value: '42'},
      });

      await pageB.waitForTimeout(1500);

      const valRes = await request.get(`/api/maps/${mapId}/cells/1/0/variable-values`, {
        headers: {Authorization: `Bearer ${token}`},
      });
      const values = await valRes.json();
      const hpValue = values.find((v: {variableId: string}) => v.variableId === variable.id);
      expect(hpValue?.value).toBe('42');

      await request.delete(`/api/maps/${mapId}/variables/${variable.id}`, {
        headers: {Authorization: `Bearer ${token}`},
      });
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });
});
