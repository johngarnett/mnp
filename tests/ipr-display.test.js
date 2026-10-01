/*
   Ported from mnp 62236ff, c90dd9f, and the team-rating line of 7e52dbb: a player
   with no IPR shows a "1" badge and counts as IPR 1 in team totals on the team
   page, the match team page, and the pregame page.
*/
const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const request = require('supertest')
const fixture = require('./helpers/fixture')
const scenario = require('./helpers/ipr-scenario')

scenario.setup()

const HTTP_OK = 200

describe('players without an IPR count as IPR 1', () => {
   let app
   let cookie

   before(() => {
      scenario.createPregameMatch()
      app = fixture.createApp()
      cookie = fixture.login(fixture.ADMIN_KEY)
   })

   after(() => fixture.cleanup())

   it('team page shows a 1 badge and includes it in the team rating', async () => {
      const res = await request(app).get(`/teams/${scenario.TEAM_KEY}`).set('Cookie', cookie)

      assert.equal(res.status, HTTP_OK)
      assert.match(res.text, new RegExp(`Team Rating:</td><td><b>${scenario.TEAM_IPR}<b>`))
      assert.match(res.text, /<span class="badge badge-0">1<\/span>/)
   })

   it('match team page shows a 1 badge and includes it in the players IPR', async () => {
      const res = await request(app).get(`/matches/${scenario.MATCH_KEY}/away`).set('Cookie', cookie)

      assert.equal(res.status, HTTP_OK)
      assert.match(res.text, new RegExp(`Players IPR: ${scenario.TEAM_IPR}\\b`))
      assert.match(res.text, /<span class="badge badge-0">1<\/span>/)
   })

   it('pregame page ranks the player as 1 and includes it in the team IPR', async () => {
      const res = await request(app).get(`/matches/${scenario.MATCH_KEY}`).set('Cookie', cookie)
      const badge = `<span class="badge badge-${scenario.UNRATED_IPR}">${scenario.UNRATED_IPR}</span>`

      assert.equal(res.status, HTTP_OK)
      assert.match(res.text, new RegExp(`AWAY: ${scenario.ROSTER_SIZE} - ${scenario.TEAM_IPR}<`))
      assert.match(res.text, new RegExp(`${badge} ${scenario.UNRATED_NAME}`))
   })
})
