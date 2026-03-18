import {test, expect} from '@playwright/test';

test.describe('map editor — single user', () => {
  let mapId: number;

  test.beforeAll(async ({request}) => {
    const token = process.env['TEST_AUTH_TOKEN']!;
    const res = await request.post('/api/maps', {
      headers: {Authorization: `Bearer ${token}`},
      data: {name: 'E2E Test Map', gridType: 'square', gridSize: 40},
    });
    expect(res.ok()).toBeTruthy();
    const map = await res.json();
    mapId = map.id;
  });

  test.afterAll(async ({request}) => {
    const token = process.env['TEST_AUTH_TOKEN']!;
    await request.delete(`/api/maps/${mapId}`, {
      headers: {Authorization: `Bearer ${token}`},
    });
  });

  test('maps list loads and shows created map', async ({page}) => {
    await page.goto('/maps');
    await expect(page.locator('text=E2E Test Map')).toBeVisible({timeout: 10000});
  });

  test('map editor opens for map', async ({page}) => {
    await page.goto(`/map-editor/${mapId}`);
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(`/map-editor/${mapId}`);
  });

  test('map name is displayed', async ({page}) => {
    await page.goto(`/map-editor/${mapId}`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('input[placeholder="Map name"]')).toHaveValue('E2E Test Map', {timeout: 10000});
  });

  test('selectCell_updatesDetailPanel', async ({page}) => {
    await page.goto(`/map-editor/${mapId}`);
    await page.waitForLoadState('networkidle');
    await page.locator('canvas').click({position: {x: 100, y: 100}});
    await expect(page.locator('[data-testid="cell-detail-panel"], .cell-detail, .admin-panel')).toBeVisible({timeout: 10000});
  });

  test('createVariable_asDm_appearsInCellPanel', async ({page, request}) => {
    const token = process.env['TEST_AUTH_TOKEN']!;
    const varRes = await request.post(`/api/maps/${mapId}/variables`, {
      headers: {Authorization: `Bearer ${token}`},
      data: {name: 'E2E Variable', dataType: 'TEXT', visibility: 'VISIBLE', sortOrder: 0},
    });
    expect(varRes.ok()).toBeTruthy();
    const variable = await varRes.json();

    await page.goto(`/map-editor/${mapId}`);
    await page.waitForLoadState('networkidle');
    await page.locator('canvas').click({position: {x: 100, y: 100}});
    await expect(page.locator('text=E2E Variable')).toBeVisible({timeout: 10000});

    await request.delete(`/api/maps/${mapId}/variables/${variable.id}`, {
      headers: {Authorization: `Bearer ${token}`},
    });
  });

  test('writeSharedCellNote_persistsAcrossNavigation', async ({page, request}) => {
    const token = process.env['TEST_AUTH_TOKEN']!;

    await request.post(`/api/grid-cells/${mapId}/2/3`, {
      headers: {Authorization: `Bearer ${token}`},
      data: {name: 'Note Cell'},
    });

    await request.put(`/api/maps/${mapId}/notes/cell/2/3/shared`, {
      headers: {Authorization: `Bearer ${token}`},
      data: {content: 'Persistent shared note'},
    });

    await page.goto(`/map-editor/${mapId}`);
    await page.waitForLoadState('networkidle');

    await page.goto('/maps');
    await page.waitForLoadState('networkidle');
    await page.goto(`/map-editor/${mapId}`);
    await page.waitForLoadState('networkidle');

    const notesRes = await request.get(`/api/maps/${mapId}/notes/cell/2/3`, {
      headers: {Authorization: `Bearer ${token}`},
    });
    const notes = await notesRes.json();
    expect(notes.sharedContent).toBe('Persistent shared note');
  });
});
