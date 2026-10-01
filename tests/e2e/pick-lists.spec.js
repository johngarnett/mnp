/*
   Ported from mnp f9ba89d, with player order changed for NESLP: on the picking and
   responding pages, machines are sorted by name and players are sorted by fewest
   games played, then by name.
*/
const { test, expect } = require('@playwright/test')
const fixture = require('../helpers/fixture')
const scenario = require('../helpers/pick-lists-scenario')

const FIRST_GAME = 1

// Option labels in a dropdown, without the leading "Select ..." hint option.
async function optionLabels(select) {
   const labels = await select.locator('option').allTextContents()

   return labels.slice(1)
}

test.beforeEach(async ({ page, baseURL }) => {
   await page.context().addCookies([
      { name: fixture.COOKIE_NAME, value: scenario.SESSION_ID, url: baseURL }
   ])
})

test('picking page lists machines by name', async ({ page }) => {
   await page.goto(`/matches/${scenario.PICKING_MATCH_KEY}`)
   const select = page.locator(`select[name="machine.${FIRST_GAME}"]`)

   await expect(select).toBeVisible()
   expect(await optionLabels(select)).toEqual(scenario.MACHINE_LABELS)
})

test('picking page lists players by fewest games played, then name', async ({ page }) => {
   await page.goto(`/matches/${scenario.PICKING_MATCH_KEY}`)
   const select = page.locator(`select[name="player_1.${FIRST_GAME}"]`)

   await expect(select).toBeVisible()
   expect(await optionLabels(select)).toEqual(scenario.PICKING_PLAYER_LABELS)
})

test('responding page lists players by fewest games played, then name', async ({ page }) => {
   await page.goto(`/matches/${scenario.RESPONDING_MATCH_KEY}`)
   const select = page.locator(`select[name="player_2.${FIRST_GAME}"]`)

   await expect(select).toBeVisible()
   expect(await optionLabels(select)).toEqual(scenario.RESPONDING_PLAYER_LABELS)
})
