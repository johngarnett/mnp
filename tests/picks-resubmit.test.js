/*
   Ported from mnp 2f0a369: POST /matches/:id/picks must redirect after a successful
   submission. makePicks reports success with an empty errors array, which used to
   be treated as an error, so the match page was rendered as the POST response and
   refreshing it resubmitted the form.
*/
const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const request = require('supertest')
const fixture = require('./helpers/fixture')

fixture.setup()

const CONST = require('../constants')
const matches = require('../model/matches')

const HTTP_OK = 200
const HTTP_FOUND = 302
const MATCH_KEY = 'slp-test-1-AWAY-HOME'
const ROUND_ONE = 1

function createPickingMatch() {
   const match = new matches.Match({
      key: MATCH_KEY,
      state: CONST.PICKING,
      venue: fixture.VENUE_KEY,
      away: { key: 'AWAY', name: 'Away Team' },
      home: { key: 'HOME', name: 'Home Team' }
   })

   match.save()
   return match
}

describe('POST /matches/:id/picks', () => {
   let app
   let cookie

   before(() => {
      createPickingMatch()
      app = fixture.createApp()
      cookie = fixture.login(fixture.ADMIN_KEY)
   })

   after(() => fixture.cleanup())

   it('redirects to the match page after a successful pick', async () => {
      const res = await request(app)
         .post(`/matches/${MATCH_KEY}/picks`)
         .set('Cookie', cookie)
         .type('form')
         .send({
            state: CONST.PICKING,
            round: ROUND_ONE,
            'machine.1': fixture.VENUE_MACHINES[0]
         })

      assert.equal(res.status, HTTP_FOUND)
      assert.equal(res.headers.location, `/matches/${MATCH_KEY}`)
      assert.equal(matches.get(MATCH_KEY).getRound(ROUND_ONE).games[0].machine, fixture.VENUE_MACHINES[0])
   })

   it('renders the match page with the error when the pick is rejected', async () => {
      const res = await request(app)
         .post(`/matches/${MATCH_KEY}/picks`)
         .set('Cookie', cookie)
         .type('form')
         .send({
            state: CONST.PLAYING,
            round: ROUND_ONE
         })

      assert.equal(res.status, HTTP_OK)
      assert.match(res.text, /Not allowed to pick state picking from playing/)
   })
})
