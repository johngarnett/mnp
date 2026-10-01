/*
   Browser check for the unknown-IPR badge (mnp 62236ff, c90dd9f): the badge shows
   "1", is visible, and unrated (badge-0) badges use the green background.
*/
const { test, expect } = require('@playwright/test')
const scenario = require('../helpers/ipr-scenario')

const UNRATED_GREEN = 'rgba(5, 75, 5, 0.5)'

// container: the element holding both the player's name and badge. The pregame
// page puts away and home players in one row, so it uses the cell.
const PAGES = [
   { name: 'team', path: `/teams/${scenario.TEAM_KEY}`, container: 'tr', badgeClass: 'badge-0' },
   { name: 'match team', path: `/matches/${scenario.MATCH_KEY}/away`, container: 'tr', badgeClass: 'badge-0' },
   { name: 'pregame', path: `/matches/${scenario.MATCH_KEY}`, container: 'td', badgeClass: `badge-${scenario.UNRATED_IPR}` }
]

for (const { name, path, container, badgeClass } of PAGES) {
   test(`${name} page shows a visible 1 badge for an unrated player`, async ({ page }, testInfo) => {
      await page.goto(path)

      const row = page.locator(container, { hasText: scenario.UNRATED_NAME }).last()
      const badge = row.locator(`.badge.${badgeClass}`)

      await expect(badge).toBeVisible()
      await expect(badge).toHaveText(String(scenario.UNRATED_IPR))
      if (badgeClass === 'badge-0') {
         await expect(badge).toHaveCSS('background-color', UNRATED_GREEN)
      }

      await testInfo.attach(`${name}-row`, {
         body: await row.screenshot(),
         contentType: 'image/png'
      })
   })
}
