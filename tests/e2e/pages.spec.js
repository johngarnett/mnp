// The page frame and a finished match, at phone, tablet and desktop sizes.
const { test, expect } = require('@playwright/test');
const { matchKey } = require('../helpers/pages-scenario');
const format = require('../../lib/formats');
const brand = require('../../lib/branding');

test('the home page shows the branding title, menus and content', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle(`${brand.titlePrefix}: Home`);
  await expect(page.locator('h2').first()).toHaveText(brand.name);
  await expect(page.locator('.dropdown-toggle')).toHaveCount(brand.hasPlayerMenu ? 2 : 1);

  await page.locator('.dropdown-toggle').first().click();
  const labels = await page.locator('.dropdown-menu').first().locator('a').allTextContents();

  expect(labels).toEqual(brand.mainMenu.map(item => item.label));
});

test('a finished match shows its rounds, bonus and totals', async ({ page }) => {
  await page.goto(`/matches/${matchKey()}`);

  const headers = await page.locator('table').first().locator('thead td').allTextContents();
  const expected = [
    '',
    ...format.rounds.map((_, i) => String(i + 1)),
    'B',
    ...(format.handicap.enabled ? ['H'] : []),
    'Total'
  ];

  expect(headers.map(h => h.trim()).slice(1)).toEqual(expected.slice(1));
  await expect(page.locator('.round-line')).toContainText(`Round: ${format.regularRounds}`);

  // The timing section ends with each team's pick/respond totals.
  const totals = page.locator('.timing-totals');
  await expect(totals).toBeVisible();
  await expect(totals.locator('.timing-team')).toHaveCount(2);
});

test("the standings end with the format's ranking stat", async ({ page }) => {
  await page.goto('/standings');

  const table = page.locator('table').first();
  const headers = await table.locator('tr.header-row td').allTextContents();
  const lastCells = table.locator('tr:not(.header-row) td:last-child');

  expect(headers.at(-1).trim()).toBe(format.standings.rankBy === 'points' ? 'Points' : 'POPS');
  await expect(table.locator('a')).toHaveCount(2);
  await expect(lastCells).toHaveCount(2);
  for (const text of await lastCells.allTextContents()) {
    expect(text.trim()).toMatch(
      format.standings.rankBy === 'points' ? /^\d+(\.\d+)?$/ : /^\d\.\d{3}$/
    );
  }
});

test('the game page names the game type', async ({ page }) => {
  await page.goto(`/games/${matchKey()}.1.1`);

  await expect(page.locator('body')).toContainText('Game 1 · Doubles');
});
