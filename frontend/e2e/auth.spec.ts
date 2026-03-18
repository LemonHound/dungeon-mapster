import {test, expect} from '@playwright/test';

test.describe('authentication', () => {
  test('homePage_loadsForUnauthenticatedUser', async ({browser}) => {
    const ctx = await browser.newContext({storageState: undefined});
    const page = await ctx.newPage();
    try {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL('/');
    } finally {
      await ctx.close();
    }
  });

  test('mapsRoute_redirectsToHome_whenNotAuthenticated', async ({browser}) => {
    const ctx = await browser.newContext({storageState: undefined});
    const page = await ctx.newPage();
    try {
      await page.goto('/maps');
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL('/');
    } finally {
      await ctx.close();
    }
  });
});
