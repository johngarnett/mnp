/*
   Branding comes from BRANDING_FOLDER (here the in-tree branding/example):
   league.json is validated at startup, the page frame takes its title, menus
   and footer from it, content pages and static files come from the folder,
   emails use its names and addresses, and league match keys use its prefix.
*/
const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const request = require('supertest')
const fixture = require('./helpers/fixture')

const HTTP_OK = 200
const HTTP_NOT_FOUND = 404
const HTTP_REDIRECT = 302
const EXAMPLE_FOLDER = path.join(__dirname, '..', 'branding', 'example')
const ROOT_KEY = '6143'
const SIGNUP_NAME = 'Test Person'
const SIGNUP_EMAIL = 'test.person@example.com'
const CONDUCT_SUBJECT = 'A test report'
const TEAM_KEY = 'BRT'
const ROSTER_NAME = 'Roster Player'
const SUB_NAME = 'Walk In'

fixture.setup({ season: { teams: { [TEAM_KEY]: { key: TEAM_KEY, name: 'Branding Team', roster: [{ name: ROSTER_NAME }] } } } })

const loadBranding = require('../lib/load-branding')
const brand = require('../lib/branding')
const matches = require('../model/matches')
const app = fixture.createApp()

// The sign-up PIN is today's date as YYMMDD on the server's clock.
function todaysPin() {
   const now = new Date()
   const pad = n => String(n).padStart(2, '0')
   return String(now.getFullYear() % 100) + pad(now.getMonth() + 1) + pad(now.getDate())
}

function tempBranding(league) {
   const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'branding-test-'))
   if (league !== undefined) fs.writeFileSync(path.join(folder, 'league.json'), typeof league === 'string' ? league : JSON.stringify(league))
   return folder
}

const VALID_LEAGUE = JSON.parse(fs.readFileSync(path.join(EXAMPLE_FOLDER, 'league.json')))

describe('loading a branding folder', () => {
   it('rejects a folder without league.json', () => {
      assert.throws(() => loadBranding(tempBranding()), /no league\.json/)
   })

   it('rejects invalid JSON, a missing name, a bad key prefix, and a bad menu', () => {
      assert.throws(() => loadBranding(tempBranding('{not json')), /not valid JSON/)
      assert.throws(() => loadBranding(tempBranding({ ...VALID_LEAGUE, name: '' })), /"name"/)
      assert.throws(() => loadBranding(tempBranding({ ...VALID_LEAGUE, matchKeyPrefix: 'Bad-Prefix' })), /matchKeyPrefix/)
      assert.throws(() => loadBranding(tempBranding({ ...VALID_LEAGUE, mainMenu: [{ label: 'HOME' }] })), /mainMenu\[0\]/)
   })

   it('fills in email subjects and page files', () => {
      const loaded = loadBranding(tempBranding({ ...VALID_LEAGUE, emailSubjects: undefined }))

      assert.equal(loaded.emailSubjects.verify, `${VALID_LEAGUE.shortName} - Confirm Email`)
      assert.equal(loaded.emailSubjects.forgotPassword, `${VALID_LEAGUE.shortName} - Reset Password`)
      assert.ok(loaded.pageFile('index').endsWith(path.join('pages', 'index.html')))
      assert.equal(loaded.pageFile('nope'), null)
   })

   it('is the example branding by default', () => {
      assert.equal(brand.folder, EXAMPLE_FOLDER)
      assert.equal(brand.hasPlayerMenu, true)
   })
})

describe('pages with the example branding', () => {
   after(() => fixture.cleanup())

   it('frames the home page with the title, both menus and the footer', async () => {
      const res = await request(app).get('/')

      assert.equal(res.status, HTTP_OK)
      assert.ok(res.text.includes(`<title>${brand.titlePrefix}: Home</title>`))
      assert.ok(res.text.includes('<h2>Example Pinball League</h2>'))
      assert.ok(res.text.includes('href="/leaguerules">LEAGUE RULES</a>'))
      assert.ok(res.text.includes('href="/mymatch">MY MATCH</a>'))
      assert.equal((res.text.match(/dropdown-toggle/g) || []).length, 2)
      assert.ok(res.text.includes(`&copy;${brand.copyright}`))
   })

   it('serves the content pages from the branding folder', async () => {
      const res = await request(app).get('/leaguerules')

      assert.equal(res.status, HTTP_OK)
      assert.ok(res.text.includes('<h2>League Rules</h2>'))
   })

   it('serves the branding static files and has no scoresheet', async () => {
      for (const file of ['/icon_128.png', '/favicon.ico', '/brand.css']) {
         assert.equal((await request(app).get(file)).status, HTTP_OK, file)
      }
      assert.equal((await request(app).get('/scoresheet')).status, HTTP_NOT_FOUND)
   })

   it('sends the verification email with the branding names and the request host', async () => {
      const res = await request(app).post('/signup').type('form').send({
         name: SIGNUP_NAME, email: SIGNUP_EMAIL, answerX: todaysPin(), questionX: 'pin'
      })
      const sent = fixture.sentEmails.find(e => e.to === SIGNUP_EMAIL)

      assert.equal(res.status, HTTP_OK)
      assert.ok(sent, 'a verification email was sent')
      assert.equal(sent.subject, brand.emailSubjects.verify)
      assert.ok(sent.message.includes(`Thanks for signing up for ${brand.name}!`))
      assert.ok(sent.message.includes('http://127.0.0.1/verify/'))
      assert.ok(res.text.includes(`Thanks for signing up for ${brand.name}.`))
   })

   it('sends conduct reports to the branding address', async () => {
      const res = await request(app).post('/conduct').type('form').send({ from: '', subject: CONDUCT_SUBJECT, message: 'details' })
      const sent = fixture.sentEmails.find(e => e.subject === `Player Conduct - ${CONDUCT_SUBJECT}`)

      assert.equal(res.status, HTTP_REDIRECT)
      assert.equal(sent.to, brand.conductEmail)
   })

   it('marks substitutes only in matches keyed with the branding prefix', () => {
      fixture.createPlayer({ key: ROOT_KEY, name: 'Root User' })
      const leagueMatch = new matches.Match({ key: `${brand.matchKeyPrefix}-1-1-${TEAM_KEY}-OPP`, home: { key: TEAM_KEY, name: 'Branding Team' } })
      const scrimmage = new matches.Match({ key: `other-1-1-${TEAM_KEY}-OPP`, home: { key: TEAM_KEY, name: 'Branding Team' } })

      leagueMatch.add({ ukey: ROOT_KEY, team: 'home', name: SUB_NAME })
      scrimmage.add({ ukey: ROOT_KEY, team: 'home', name: SUB_NAME })
      assert.equal(leagueMatch.home.lineup.find(p => p.name === SUB_NAME).sub, true)
      assert.equal(scrimmage.home.lineup.find(p => p.name === SUB_NAME).sub, false)
   })
})
