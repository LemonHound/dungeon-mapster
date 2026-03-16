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

  test('cell selection updates UI', async ({page}) => {
    await page.goto(`/map-editor/${mapId}`);
    await page.waitForLoadState('networkidle');

    const canvas = page.locator('#grid-canvas');
    await canvas.waitFor({state: 'visible', timeout: 10000});
    await canvas.click({position: {x: 100, y: 100}});
    await page.waitForTimeout(500);
  });

  test('map name is displayed', async ({page}) => {
    await page.goto(`/map-editor/${mapId}`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('input[placeholder="Map name"]')).toHaveValue('E2E Test Map', {timeout: 10000});
  });
});
