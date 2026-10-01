/*
   Browser check for substitute name rules: on the match team page, a captain adding
   a single-name substitute sees the error with the typed name kept, and a full name
   is added to the lineup.
*/
const { test, expect } = require('@playwright/test')
const fixture = require('../helpers/fixture')
const scenario = require('../helpers/sub-names-scenario')

const TEAM_PAGE = `/matches/${scenario.MATCH_KEY}/away`

async function addPlayer(page, name) {
   await page.goto(TEAM_PAGE)
   await page.locator('#name').fill(name)
   await page.getByRole('button', { name: 'ADD PLAYER' }).click()
}

test.beforeEach(async ({ page, baseURL }) => {
   await page.context().addCookies([
      { name: fixture.COOKIE_NAME, value: scenario.SESSION_ID, url: baseURL }
   ])
})

test('a single-name substitute shows the error and keeps the typed name', async ({ page }, testInfo) => {
   await addPlayer(page, 'Cher')

   const alert = page.getByRole('alert')
   await expect(alert).toBeVisible()
   await expect(alert).toContainText('Substitutes need a first and last name')
   await expect(page.locator('#name')).toHaveValue('Cher')

   await testInfo.attach('sub-name-error', { body: await page.screenshot(), contentType: 'image/png' })
})

test('a substitute with a first and last name is added to the lineup', async ({ page }, testInfo) => {
   // Each screen size adds its own player, since all projects share one server.
   const name = `Sub ${testInfo.project.name}`

   await addPlayer(page, name)

   await expect(page.getByRole('alert')).toHaveCount(0)
   await expect(page.locator('td', { hasText: name })).toBeVisible()
})
