/*
   NESLP change: a substitute added to a match lineup must follow the sign-up name
   rules (first and last name, no special characters, at most 50 characters).
   Players on the team's roster and players with accounts are exempt, since their
   names are already known to the league.
*/
const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const request = require('supertest')
const fixture = require('./helpers/fixture')
const scenario = require('./helpers/sub-names-scenario')

fixture.setup(scenario.options)

const matches = require('../model/matches')
const players = require('../model/players')

const HTTP_OK = 200
const HTTP_FOUND = 302
const MAX_NAME_LENGTH = 50
const TEAM_PAGE = `/matches/${scenario.MATCH_KEY}/away`
const ERROR_TEXT = 'Substitutes need a first and last name'

function inLineup(name) {
   const key = players.makeKey(name)

   return matches.get(scenario.MATCH_KEY).away.lineup.some(p => p.key === key)
}

describe('adding a substitute to a match lineup', () => {
   let app
   let cookie

   before(() => {
      scenario.seed()
      app = fixture.createApp()
      cookie = fixture.login(fixture.ADMIN_KEY)
   })

   after(() => fixture.cleanup())

   function addPlayer(name) {
      return request(app)
         .post(`/matches/${scenario.MATCH_KEY}/players/add`)
         .set('Cookie', cookie)
         .type('form')
         .send({ name, team: 'away' })
   }

   it('adds a new substitute with a first and last name', async () => {
      const res = await addPlayer('Sam Sub')

      assert.equal(res.status, HTTP_FOUND)
      assert.equal(res.headers.location, TEAM_PAGE)
      assert.equal(inLineup('Sam Sub'), true)
   })

   for (const [label, name] of [
      ['a single-word name', 'Cher'],
      ['a name with a comma', 'Smith, Bob'],
      ['a name with angle brackets', 'Bob <b>Smith</b>'],
      ['a name over the length limit', `Long ${'x'.repeat(MAX_NAME_LENGTH)}`]
   ]) {
      it(`rejects a new substitute with ${label}`, async () => {
         const res = await addPlayer(name)

         assert.equal(res.status, HTTP_FOUND)
         assert.equal(res.headers.location, `${TEAM_PAGE}?error=invalid_name&name=${encodeURIComponent(name)}`)
         assert.equal(inLineup(name), false)
      })
   }

   it('shows the error and keeps the typed name on the team page', async () => {
      const res = await request(app).get(`${TEAM_PAGE}?error=invalid_name&name=Cher`).set('Cookie', cookie)

      assert.equal(res.status, HTTP_OK)
      assert.match(res.text, new RegExp(ERROR_TEXT))
      assert.match(res.text, /id="name" name="name"[^>]*value="Cher"/)
   })

   it('escapes the typed name on the team page', async () => {
      const res = await request(app)
         .get(`${TEAM_PAGE}?error=invalid_name&name=${encodeURIComponent('"><script>x</script>')}`)
         .set('Cookie', cookie)

      assert.doesNotMatch(res.text, /<script>x<\/script>/)
   })

   it('ignores an unknown error code', async () => {
      const res = await request(app).get(`${TEAM_PAGE}?error=other&name=Cher`).set('Cookie', cookie)

      assert.doesNotMatch(res.text, new RegExp(ERROR_TEXT))
   })

   it('allows a single-name player on the team roster', async () => {
      const res = await addPlayer(scenario.SINGLE_NAME_ROSTER_PLAYER)

      assert.equal(res.headers.location, TEAM_PAGE)
      assert.equal(inLineup(scenario.SINGLE_NAME_ROSTER_PLAYER), true)
   })

   it('allows a registered player whose name predates the rules', async () => {
      const res = await addPlayer(scenario.LEGACY_PLAYER_NAME)

      assert.equal(res.headers.location, TEAM_PAGE)
      assert.equal(inLineup(scenario.LEGACY_PLAYER_NAME), true)
   })
})

describe('players.isValidName', () => {
   const CASES = [
      ['Sam Sub', true],
      ["Zoë O'Brien-Smith", true],
      ['  Padded Name  ', true],
      ['Cher', false],
      ['Smith, Bob', false],
      ['', false],
      [undefined, false]
   ]

   for (const [name, valid] of CASES) {
      it(`${valid ? 'accepts' : 'rejects'} ${JSON.stringify(name)}`, () => {
         assert.equal(players.isValidName(name), valid)
      })
   }
})
