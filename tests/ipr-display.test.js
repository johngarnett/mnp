/*
   Ported from mnp 62236ff, c90dd9f, and the team-rating line of 7e52dbb: a player
   with no IPR shows a "1" badge and counts as IPR 1 in team totals on the team
   page, the match team page, and the pregame page.
*/
const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const request = require('supertest')
const fixture = require('./helpers/fixture')

const RATED_NAME = 'Rated Player'
const RATED_IPR = 3
const UNRATED_NAME = 'Unrated Player'
const UNRATED_IPR = 1
const TEAM_IPR = RATED_IPR + UNRATED_IPR
const ROSTER_SIZE = 2
const TEAM_KEY = 'AWAY'
const OPPONENT_KEY = 'HOME'
const MATCH_KEY = 'slp-test-1-AWAY-HOME'

function makeTeam(key) {
   return {
      key,
      name: `${key} Team`,
      venue: fixture.VENUE_KEY,
      roster: [{ name: RATED_NAME }, { name: UNRATED_NAME }],
      schedule: []
   }
}

fixture.setup({
   ratings: [{ name: RATED_NAME, ipr: RATED_IPR }],
   season: {
      teams: { [TEAM_KEY]: makeTeam(TEAM_KEY), [OPPONENT_KEY]: makeTeam(OPPONENT_KEY) },
      groups: { test: { key: 'test', name: 'Test', teams: [TEAM_KEY, OPPONENT_KEY] } }
   }
})

const CONST = require('../constants')
const matches = require('../model/matches')

function createPregameMatch() {
   const season = require('../model/seasons').get()
   const match = new matches.Match({
      key: MATCH_KEY,
      state: CONST.PREGAME,
      venue: fixture.VENUE_KEY,
      away: season.teams[TEAM_KEY],
      home: season.teams[OPPONENT_KEY]
   })

   match.save()
   return match
}

describe('players without an IPR count as IPR 1', () => {
   let app
   let cookie

   before(() => {
      createPregameMatch()
      app = fixture.createApp()
      cookie = fixture.login(fixture.ADMIN_KEY)
   })

   after(() => fixture.cleanup())

   it('team page shows a 1 badge and includes it in the team rating', async () => {
      const res = await request(app).get(`/teams/${TEAM_KEY}`).set('Cookie', cookie)

      assert.equal(res.status, 200)
      assert.match(res.text, new RegExp(`Team Rating:</td><td><b>${TEAM_IPR}<b>`))
      assert.match(res.text, /<span class="badge badge-0">1<\/span>/)
   })

   it('match team page shows a 1 badge and includes it in the players IPR', async () => {
      const res = await request(app).get(`/matches/${MATCH_KEY}/away`).set('Cookie', cookie)

      assert.equal(res.status, 200)
      assert.match(res.text, new RegExp(`Players IPR: ${TEAM_IPR}\\b`))
      assert.match(res.text, /<span class="badge badge-0">1<\/span>/)
   })

   it('pregame page ranks the player as 1 and includes it in the team IPR', async () => {
      const res = await request(app).get(`/matches/${MATCH_KEY}`).set('Cookie', cookie)

      assert.equal(res.status, 200)
      assert.match(res.text, new RegExp(`AWAY: ${ROSTER_SIZE} - ${TEAM_IPR}<`))
      assert.match(res.text, new RegExp(`<span class="badge badge-${UNRATED_IPR}">${UNRATED_IPR}</span> ${UNRATED_NAME}`))
   })
})
