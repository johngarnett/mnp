/*
   Browser check for admin machine editing (mnp 9be307d): a league admin sees the
   add form, the code box cleans what is typed, and an added machine is listed.
   Machines are only added, since other specs use the test venue's machines.
*/
const { test, expect } = require('@playwright/test')
const fixture = require('../helpers/fixture')
const scenario = require('../helpers/machines-scenario')

test.beforeEach(async ({ page, baseURL }) => {
   await page.context().addCookies([
      { name: fixture.COOKIE_NAME, value: scenario.SESSION_ID, url: baseURL }
   ])
})

test('a league admin adds a machine and the code is cleaned up', async ({ page }, testInfo) => {
   // Each screen size adds its own machine, since all projects share one server.
   const typed = `e2e-${testInfo.project.name}!`
   const code = `E2E${testInfo.project.name.toUpperCase()}`
   const name = `E2E Machine ${testInfo.project.name}`

   await page.goto('/machines')
   const codeBox = page.locator('#mkey')
   await expect(codeBox).toBeVisible()
   await testInfo.attach('machines-form-empty', { body: await page.screenshot(), contentType: 'image/png' })

   await codeBox.fill(typed)
   await codeBox.blur()
   await expect(codeBox).toHaveValue(code)
   // The whole code and the placeholder must fit in the box at every screen size.
   expect(await codeBox.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)

   await testInfo.attach('machines-form', { body: await page.screenshot(), contentType: 'image/png' })

   await page.locator('input[name="name"]').fill(name)
   await page.getByRole('button', { name: 'ADD' }).click()

   const row = page.locator('tr', { hasText: name })
   await expect(row).toBeVisible()
   await expect(row.locator('td').first()).toHaveText(code)
})
