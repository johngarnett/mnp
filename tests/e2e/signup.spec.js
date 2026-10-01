/*
   Browser check for sign-up hardening (mnp f5ba033 and NESLP changes): the PIN
   field is shown, a rejected sign-up shows the error and keeps the entered name
   and email, and the PIN is today's date in the league's time zone.
*/
const { test, expect } = require('@playwright/test')

const LEAGUE_TIME_ZONE = 'America/Los_Angeles'
const WRONG_PIN = '000000'

// Today's date in the league time zone as YYMMDD, computed independently of the app.
function todaysPin() {
   const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: LEAGUE_TIME_ZONE,
      year: '2-digit',
      month: '2-digit',
      day: '2-digit'
   }).formatToParts(new Date())
   const part = type => parts.find(p => p.type === type).value

   return part('year') + part('month') + part('day')
}

// Each project (screen size) signs up a different player.
function newPlayer(testInfo) {
   const id = `${testInfo.project.name}${testInfo.repeatEachIndex}`

   return { name: `Signup Tester ${id}`, email: `signup-${id}@example.com` }
}

async function fillSignup(page, { name, email, pin }) {
   await page.goto('/signup')
   await page.locator('#name').fill(name)
   await page.locator('#answerX').fill(pin)
   await page.locator('#email').fill(email)
   await page.locator('#needAccount').check()
   await page.getByRole('button', { name: 'SIGN UP' }).click()
}

test('signup page asks for the PIN from your captain', async ({ page }) => {
   await page.goto('/signup')

   await expect(page.locator('#questionX')).toHaveText(/PIN code \(obtained from your captain\)/)
   await expect(page.locator('#answerX')).toBeVisible()
})

test('a wrong PIN shows the error and keeps the entered name and email', async ({ page }, testInfo) => {
   const player = newPlayer(testInfo)

   await fillSignup(page, { ...player, pin: WRONG_PIN })

   const alert = page.getByRole('alert')
   await expect(alert).toBeVisible()
   await expect(alert).toContainText('Sign-up failed.')
   await expect(page.locator('#name')).toHaveValue(player.name)
   await expect(page.locator('#email')).toHaveValue(player.email)

   await testInfo.attach('signup-error', { body: await page.screenshot(), contentType: 'image/png' })
})

test("today's league-time PIN signs the player up", async ({ page }, testInfo) => {
   await fillSignup(page, { ...newPlayer(testInfo), pin: todaysPin() })

   await expect(page.getByText('Thanks for signing up')).toBeVisible()
})
